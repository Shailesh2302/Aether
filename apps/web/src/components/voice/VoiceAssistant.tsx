"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Mic, MicOff, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getToken, type FileItem } from "@/lib/api";
import { filesApi } from "@/lib/api";
import { parseVoiceCommand, rankFiles } from "@/lib/voiceCommands";
import { useAuthStore } from "@/store/useAuthStore";

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
  maxAlternatives: number;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: { error: string; message?: string }) => void) | null;
  onend: (() => void) | null;
  onsoundstart: (() => void) | null;
  onspeechstart: (() => void) | null;
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

function recognitionCtor() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export function VoiceAssistant() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [transcript, setTranscript] = useState("");
  const [reply, setReply] = useState("Ask me to open a file, e.g. “open docker bind mounts”.");
  const [supported, setSupported] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [hearing, setHearing] = useState(false);
  const [debug, setDebug] = useState("idle");
  const recogRef = useRef<SpeechRecognitionInstance | null>(null);
  // True while the user wants the mic hot. onend auto-restarts only then,
  // so intentional stops (final result, close button) stay stopped.
  const wantRef = useRef(false);
  const restartTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cycleRef = useRef(0);

  // Client-only: zustand-persist rehydrates auth from localStorage after
  // mount, so the server render (signed-out) would mismatch a logged-in
  // client. Render nothing until mounted to keep hydration identical.
  useEffect(() => {
    setMounted(true);
  }, []);

  const visible = mounted && (isAuthenticated || !!getToken());

  useEffect(() => {
    if (!recognitionCtor()) setSupported(false);
  }, []);

  const stopListening = useCallback(() => {
    wantRef.current = false;
    if (restartTimer.current) {
      clearTimeout(restartTimer.current);
      restartTimer.current = null;
    }
    setPhase("idle");
    setHearing(false);
    setDebug("stopped by user");
    try {
      recogRef.current?.abort();
    } catch {
      // already stopped
    }
    recogRef.current = null;
  }, []);

  const handleCommand = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text) {
        setPhase("idle");
        return;
      }
      setPhase("working");
      const intent = parseVoiceCommand(text);

      if (!intent) {
        const msg = `Sorry, I didn't understand “${text}”. Try “open” plus a file name, or “go to clips”.`;
        setReply(msg);
        speak(msg);
        setPhase("idle");
        return;
      }

      if (intent.type === "help") {
        const msg =
          "You can say: open, find or play followed by a file name. Or go to, followed by dashboard, upload, search, clips, files, videos, chat, settings or billing.";
        setReply(msg);
        speak(msg);
        setPhase("idle");
        return;
      }

      if (intent.type === "navigate") {
        const msg = `Opening ${intent.label}.`;
        setReply(msg);
        speak(msg);
        router.push(intent.href);
        setPhase("idle");
        return;
      }

      if (intent.type === "search") {
        const msg = `Searching for ${intent.q}.`;
        setReply(msg);
        speak(msg);
        router.push(`/search?q=${encodeURIComponent(intent.q)}`);
        setPhase("idle");
        return;
      }

      // openFile
      try {
        const files: FileItem[] = await filesApi.list();
        const ranked = rankFiles(intent.query, files);

        if (ranked.length === 0) {
          const msg = `I couldn't find anything matching ${intent.query}.`;
          setReply(msg);
          speak(msg);
        } else {
          const best = ranked[0].file;
          if (best.mimeType.startsWith("video/")) {
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
    const SR = recognitionCtor();
    if (!SR) {
      setSupported(false);
      setReply("Voice input isn't supported in this browser. Try Chrome.");
      return;
    }
    // Abort any zombie instance so rapid taps can't leave two recognizers
    // fighting over the mic (one of them starves and dies in ~1s).
    try {
      recogRef.current?.abort();
    } catch {
      // first run
    }
    if (restartTimer.current) {
      clearTimeout(restartTimer.current);
      restartTimer.current = null;
    }
    setTranscript("");
    setHearing(false);
    wantRef.current = true;
    setPhase("listening");
    setDebug("starting…");
    spawnCycle(SR);
  }, []);

  /**
   * Start one recognition cycle with a FRESH instance. Chrome recycles
   * recognizers aggressively; reusing one across onend restarts is what
   * made listening die after 1-2s. Each cycle ends -> brief pause ->
   * next fresh cycle, until the user stops us or a final result lands.
   */
  function spawnCycle(SR: NonNullable<ReturnType<typeof recognitionCtor>>) {
    if (!wantRef.current) return;
    const cycle = ++cycleRef.current;
    const recog = new SR();
    recog.lang = "en-US";
    recog.interimResults = true;
    recog.continuous = true;
    recog.maxAlternatives = 1;
    recogRef.current = recog;
    setDebug(`cycle ${cycle}: started`);
    recog.onsoundstart = () => {
      // Mic is capturing audio - if the user never sees this, the OS mic
      // is muted / wrong device, and no code can fix that.
      setHearing(true);
      setDebug(`cycle ${cycle}: hearing sound`);
    };
    recog.onspeechstart = () => {
      setDebug(`cycle ${cycle}: speech detected`);
    };
    recog.onresult = (e: SpeechRecognitionEvent) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const part = e.results[i][0]?.transcript ?? "";
        if (e.results[i].isFinal) {
          const said = part.trim();
          setTranscript(said);
          setDebug(`cycle ${cycle}: final “${said.slice(0, 40)}”`);
          if (said) {
            // Final answer received - stand down before acting so onend
            // doesn't restart us.
            wantRef.current = false;
            if (restartTimer.current) {
              clearTimeout(restartTimer.current);
              restartTimer.current = null;
            }
            setHearing(false);
            try {
              recog.stop();
            } catch {
              // stopping after a final result
            }
            handleCommand(said);
            return;
          }
        } else {
          interim += part;
        }
      }
      if (interim.trim()) setTranscript(interim.trim());
    };
    recog.onerror = (e: { error: string }) => {
      setDebug(`cycle ${cycle}: error ${e.error}`);
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        wantRef.current = false;
        setHearing(false);
        setReply("Microphone access was denied. Allow it in the browser address bar and try again.");
        setPhase("idle");
      } else if (e.error === "audio-capture") {
        wantRef.current = false;
        setHearing(false);
        setReply("No microphone found. Check your device and try again.");
        setPhase("idle");
      } else if (e.error === "network") {
        wantRef.current = false;
        setHearing(false);
        setReply("The speech service is unreachable. Check your internet connection and try again.");
        setPhase("idle");
      } else if (e.error === "aborted" || e.error === "no-speech" || e.error === "language-not-supported") {
        if (e.error === "language-not-supported") {
          wantRef.current = false;
          setReply("This browser's speech language isn't supported. Try Chrome in English.");
          setPhase("idle");
        }
        // "aborted"/"no-speech" are benign: onend below starts a fresh cycle.
      } else {
        setReply("I didn't catch that. Keep talking - I'm still listening.");
      }
    };
    recog.onend = () => {
      // Chrome ends a cycle on silence or after ~a minute. Start a FRESH
      // cycle (never reuse the ended instance) while the user is still talking.
      setHearing(false);
      if (!wantRef.current) {
        setDebug(`cycle ${cycle}: ended (stopped)`);
        return;
      }
      setDebug(`cycle ${cycle}: ended → restarting…`);
      if (restartTimer.current) clearTimeout(restartTimer.current);
      restartTimer.current = setTimeout(() => {
        if (!wantRef.current) return;
        spawnCycle(SR);
      }, 150);
    };
    try {
      recog.start();
      setDebug(`cycle ${cycle}: live`);
    } catch {
      // Mic not released yet - retry this cycle once shortly.
      if (restartTimer.current) clearTimeout(restartTimer.current);
      restartTimer.current = setTimeout(() => {
        if (!wantRef.current) return;
        spawnCycle(SR);
      }, 400);
    }
  }

  useEffect(() => {
    return () => {
      wantRef.current = false;
      setPhase("idle");
      if (restartTimer.current) clearTimeout(restartTimer.current);
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
      {/* Floating mic button - opens the panel AND starts listening right away */}
      <button
        onClick={() => {
          if (!supported) {
            setOpen(true);
            setReply("Voice input isn't supported in this browser. Try Chrome.");
            return;
          }
          if (open) {
            stopListening();
            setOpen(false);
          } else {
            setOpen(true);
            startListening();
          }
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
            {phase === "listening" && !transcript && (
              <p className="mt-2 text-muted-foreground">
                {hearing ? "Hearing you… keep talking." : "Listening… speak now."}
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
          <p className="mt-1 font-mono text-[10px] text-muted-foreground/70">
            mic: {debug}
          </p>
        </div>
      )}
    </>
  );
}
