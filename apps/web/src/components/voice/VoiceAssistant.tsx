"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Mic, MicOff, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { filesApi, getToken, type FileItem } from "@/lib/api";

// Minimal Web Speech API typings (not in TS DOM lib for webkit prefix).
interface SpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: { transcript: string };
}
interface SpeechRecognitionEvent {
  results: SpeechRecognitionResult[];
  resultIndex: number;
}
interface SpeechRecognitionInstance {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  }
}

type Phase = "idle" | "listening" | "working";

function speak(text: string) {
  try {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1.05;
    window.speechSynthesis.speak(utter);
  } catch {
    // audio feedback is best-effort
  }
}

function normalize(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

function scoreMatch(query: string, name: string): number {
  const q = normalize(query);
  const n = normalize(name);
  if (!q) return 0;
  if (n.includes(q)) return 100 + q.length;
  const words = q.split(" ").filter((w) => w.length > 2);
  if (words.length === 0) return 0;
  const hits = words.filter((w) => n.includes(w)).length;
  return (hits / words.length) * 90;
}

const NAV_TARGETS: Array<{ keys: string[]; href: string; label: string }> = [
  { keys: ["dashboard", "home", "overview"], href: "/dashboard", label: "dashboard" },
  { keys: ["upload"], href: "/upload", label: "upload page" },
  { keys: ["search"], href: "/search", label: "search page" },
  { keys: ["clip"], href: "/dashboard/clips", label: "clips" },
  { keys: ["file", "library"], href: "/dashboard/files", label: "files" },
  { keys: ["video"], href: "/dashboard/videos", label: "videos" },
  { keys: ["chat"], href: "/dashboard/chat", label: "chat" },
  { keys: ["setting"], href: "/dashboard/settings", label: "settings" },
  { keys: ["billing", "subscription", "payment"], href: "/dashboard/billing", label: "billing" },
  { keys: ["pricing", "plan", "price"], href: "/pricing", label: "pricing" },
];

export function VoiceAssistant() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [transcript, setTranscript] = useState("");
  const [reply, setReply] = useState("Ask me to open a file, e.g. “open docker bind mounts”.");
  const [supported, setSupported] = useState(true);
  const [visible, setVisible] = useState(false);
  const recogRef = useRef<SpeechRecognitionInstance | null>(null);
  const openRef = useRef(open);
  openRef.current = open;

  useEffect(() => {
    setVisible(!!getToken());
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) setSupported(false);
  }, []);

  const stopListening = useCallback(() => {
    try {
      recogRef.current?.stop();
    } catch {
      // already stopped
    }
    setPhase((p) => (p === "listening" ? "idle" : p));
  }, []);

  const handleCommand = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text) {
        setPhase("idle");
        return;
      }
      setPhase("working");
      const lower = text.toLowerCase();

      // "go to X" navigation
      const goMatch = lower.match(/^(go to|open page|show page)\s+(.+)$/);
      if (goMatch) {
        const dest = goMatch[2];
        const target = NAV_TARGETS.find((t) => t.keys.some((k) => dest.includes(k)));
        if (target) {
          const msg = `Opening ${target.label}.`;
          setReply(msg);
          speak(msg);
          router.push(target.href);
          setPhase("idle");
          return;
        }
      }

      // "search for X" -> search page
      const searchMatch = lower.match(/^search(\s+for)?\s+(.+)$/);
      if (searchMatch) {
        const q = searchMatch[2].trim();
        const msg = `Searching for ${q}.`;
        setReply(msg);
        speak(msg);
        router.push(`/search?q=${encodeURIComponent(q)}`);
        setPhase("idle");
        return;
      }

      if (/^(help|what can you do|commands)$/.test(lower)) {
        const msg =
          "You can say: open, find or play followed by a file name. Or go to, followed by dashboard, upload, search, clips, files, videos, chat, settings or billing.";
        setReply(msg);
        speak(msg);
        setPhase("idle");
        return;
      }

      // "open/find/show/play/get/bring X" -> locate the file
      const openMatch = lower.match(/^(open|find|show|play|get|bring)(\s+me)?\s+(.+)$/);
      // bare file-name-ish query also tries a lookup
      const query = openMatch ? openMatch[3].replace(/\s+(file|video|pdf|document)$/, "").trim() : lower;

      try {
        const files: FileItem[] = await filesApi.list();
        const ranked = files
          .map((f) => ({ file: f, score: scoreMatch(query, f.originalName) }))
          .filter((r) => r.score > 0)
          .sort((a, b) => b.score - a.score);

        if (ranked.length === 0) {
          const msg = `I couldn't find anything matching ${query}.`;
          setReply(msg);
          speak(msg);
        } else {
          const best = ranked[0].file;
          const isVideo = best.mimeType.startsWith("video/");
          if (isVideo) {
            const msg = `Opening ${best.originalName}.`;
            setReply(msg);
            speak(msg);
            router.push(`/dashboard/videos/${best.id}`);
          } else {
            const msg =
              ranked.length > 1
                ? `I found ${ranked.length} matches. Opening the best one: ${best.originalName}.`
                : `Opening ${best.originalName}.`;
            setReply(msg);
            speak(msg);
            if (best.url) window.open(best.url, "_blank", "noopener");
          }
        }
      } catch {
        const msg = "I couldn't reach your library. Please check you're signed in.";
        setReply(msg);
        speak(msg);
      }
      setPhase("idle");
    },
    [router]
  );

  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setSupported(false);
      setReply("Voice input isn't supported in this browser. Try Chrome.");
      return;
    }
    try {
      recogRef.current?.abort();
    } catch {
      // first run
    }
    const recog = new SR();
    recog.lang = "en-US";
    recog.interimResults = true;
    recog.continuous = false;
    recog.onresult = (e: SpeechRecognitionEvent) => {
      let interim = "";
      let final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const part = e.results[i][0]?.transcript ?? "";
        if (e.results[i].isFinal) final += part;
        else interim += part;
      }
      const combined = (final || interim).trim();
      if (combined) setTranscript(combined);
      if (final.trim()) handleCommand(final.trim());
    };
    recog.onerror = (e: { error: string }) => {
      if (e.error === "not-allowed") {
        setReply("Microphone access was denied. Allow it in the browser address bar and try again.");
      } else if (e.error !== "aborted" && e.error !== "no-speech") {
        setReply("I didn't catch that. Tap the mic and try again.");
      }
      setPhase("idle");
    };
    recog.onend = () => {
      if (openRef.current) setPhase((p) => (p === "listening" ? "idle" : p));
    };
    recogRef.current = recog;
    setTranscript("");
    setPhase("listening");
    try {
      recog.start();
    } catch {
      setPhase("idle");
    }
  }, [handleCommand]);

  useEffect(() => {
    return () => {
      try {
        recogRef.current?.abort();
      } catch {
        // unmounting
      }
    };
  }, []);

  if (!visible) return null;

  return (
    <>
      {/* Floating mic button */}
      <button
        onClick={() => {
          if (!supported) {
            setOpen(true);
            setReply("Voice input isn't supported in this browser. Try Chrome.");
            return;
          }
          setOpen((v) => !v);
        }}
        aria-label="Voice assistant"
        className={cn(
          "fixed bottom-6 right-6 z-50 grid h-12 w-12 place-items-center rounded-full shadow-lg transition-colors",
          phase === "listening"
            ? "bg-red-500 text-white animate-pulse"
            : "bg-primary text-primary-foreground hover:bg-primary/90"
        )}
      >
        {phase === "listening" ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
      </button>

      {open && (
        <div className="fixed bottom-20 right-6 z-50 w-80 rounded-lg border bg-card p-4 shadow-xl">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Voice assistant</p>
            <button
              onClick={() => {
                stopListening();
                setOpen(false);
              }}
              aria-label="Close voice assistant"
              className="rounded p-1 text-muted-foreground hover:bg-accent"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3 min-h-16 rounded-md bg-muted/60 p-3 text-sm">
            {transcript ? (
              <p>
                <span className="text-muted-foreground">You said: </span>“{transcript}”
              </p>
            ) : (
              <p className="text-muted-foreground">{reply}</p>
            )}
            {phase === "working" && (
              <p className="mt-2 flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Working on it…
              </p>
            )}
          </div>

          <button
            onClick={() => (phase === "listening" ? stopListening() : startListening())}
            className={cn(
              "mt-3 flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              phase === "listening"
                ? "bg-red-500 text-white hover:bg-red-600"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
            )}
          >
            {phase === "listening" ? (
              <>
                <MicOff className="h-4 w-4" /> Stop listening
              </>
            ) : (
              <>
                <Mic className="h-4 w-4" /> Tap & speak
              </>
            )}
          </button>
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            Try “open docker bind mounts”, “search hot reloading”, or “go to clips”.
          </p>
        </div>
      )}
    </>
  );
}
