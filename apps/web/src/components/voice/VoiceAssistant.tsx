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
  const recogRef = useRef<SpeechRecognitionInstance | null>(null);
  // True while the user wants the mic hot. onend auto-restarts only then,
  // so intentional stops (final result, close button) stay stopped.
  const wantRef = useRef(false);
  const restartTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    try {
      recogRef.current?.stop();
    } catch {
      // already stopped
    }
  }, []);

  /** (Re)start the recognizer now; safe to call repeatedly. */
  const kickRecognition = useCallback((recog: SpeechRecognitionInstance) => {
    try {
      recog.start();
      return true;
    } catch {
      // InvalidStateError when Chrome hasn't released the mic yet -
      // retry shortly instead of giving up (this was the 1-2s cutoff).
      if (restartTimer.current) clearTimeout(restartTimer.current);
      restartTimer.current = setTimeout(() => {
        if (!wantRef.current) return;
        try {
          recog.start();
        } catch {
          wantRef.current = false;
          setPhase("idle");
          setReply("The microphone stopped unexpectedly. Tap the mic to try again.");
        }
      }, 300);
      return false;
    }
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
    try {
      recogRef.current?.abort();
    } catch {
      // first run
    }
    const recog = new SR();
    recog.lang = "en-US";
    recog.interimResults = true;
    // Continuous mode + auto-restart keeps listening across natural pauses
    // instead of cutting the user off mid-sentence.
    recog.continuous = true;
    recog.onresult = (e: SpeechRecognitionEvent) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const part = e.results[i][0]?.transcript ?? "";
        if (e.results[i].isFinal) {
          const said = part.trim();
          setTranscript(said);
          if (said) {
            // Final answer received - stand down before acting so onend
            // doesn't restart us.
            wantRef.current = false;
            if (restartTimer.current) {
              clearTimeout(restartTimer.current);
              restartTimer.current = null;
            }
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
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        wantRef.current = false;
        setReply("Microphone access was denied. Allow it in the browser address bar and try again.");
        setPhase("idle");
      } else if (e.error === "audio-capture") {
        wantRef.current = false;
        setReply("No microphone found. Check your device and try again.");
        setPhase("idle");
      } else if (e.error === "network") {
        wantRef.current = false;
        setReply("The speech service is unreachable. Check your internet connection and try again.");
        setPhase("idle");
      } else if (e.error === "aborted" || e.error === "no-speech") {
        // Benign: onend below restarts while the user still wants to talk.
      } else {
        setReply("I didn't catch that. Keep talking - I'm still listening.");
      }
    };
    recog.onend = () => {
      // Chrome ends recognition on silence or after ~a minute - resume
      // automatically while the user still wants to talk.
      if (!wantRef.current) return;
      if (restartTimer.current) clearTimeout(restartTimer.current);
      restartTimer.current = setTimeout(() => {
        if (!wantRef.current) return;
        kickRecognition(recog);
      }, 150);
    };
    recogRef.current = recog;
    setTranscript("");
    wantRef.current = true;
    setPhase("listening");
    kickRecognition(recog);
  }, [handleCommand, kickRecognition]);

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
              <p className="mt-2 text-muted-foreground">Listening… speak now.</p>
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
