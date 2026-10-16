"use client";

import { useCallback, useEffect, useState } from "react";
import { commentsApi, type FileComment } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, MessageSquarePlus, Trash2 } from "lucide-react";
import { formatDuration } from "@/lib/utils";

interface NotesPanelProps {
  fileId: string;
  /** Current playback time; attached to new notes when provided. */
  currentTime?: number;
  onSeek?: (time: number) => void;
  className?: string;
}

function stamp(t: number) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function NotesPanel({ fileId, currentTime, onSeek, className }: NotesPanelProps) {
  const [notes, setNotes] = useState<FileComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [useTimestamp, setUseTimestamp] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setNotes(await commentsApi.list(fileId));
    } catch {
      setNotes([]);
    } finally {
      setLoading(false);
    }
  }, [fileId]);

  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    const text = input.trim();
    if (!text || saving) return;
    setSaving(true);
    try {
      const created = await commentsApi.create(
        fileId,
        text,
        useTimestamp && currentTime !== undefined ? Math.floor(currentTime) : undefined
      );
      setNotes((prev) => [...prev, created].sort((a, b) => (a.timestampSec ?? 1e12) - (b.timestampSec ?? 1e12)));
      setInput("");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await commentsApi.remove(id);
      setNotes((prev) => prev.filter((n) => n.id !== id));
    } catch {
      // keep local state on failure
    }
  };

  return (
    <div className={className}>
      <div className="space-y-2">
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : notes.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No notes yet — capture the first one below.
          </p>
        ) : (
          notes.map((n) => (
            <div key={n.id} className="rounded-md border p-2.5">
              <div className="flex items-center justify-between gap-2">
                {n.timestampSec !== null && n.timestampSec !== undefined && onSeek ? (
                  <button
                    onClick={() => onSeek(n.timestampSec as number)}
                    className="font-mono text-xs text-primary hover:underline"
                  >
                    {stamp(n.timestampSec)}
                  </button>
                ) : (
                  <span className="font-mono text-xs text-muted-foreground">
                    {n.timestampSec !== null && n.timestampSec !== undefined
                      ? stamp(n.timestampSec)
                      : "note"}
                  </span>
                )}
                <button
                  onClick={() => remove(n.id)}
                  className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Delete note"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
              <p className="mt-1 text-sm whitespace-pre-wrap">{n.text}</p>
            </div>
          ))
        )}
      </div>
      <div className="mt-3 space-y-2">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void add();
              }
            }}
            placeholder={
              currentTime !== undefined
                ? `Note at ${formatDuration(Math.floor(currentTime))}…`
                : "Write a note…"
            }
          />
          <Button onClick={add} disabled={!input.trim() || saving} size="icon" aria-label="Add note">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquarePlus className="h-4 w-4" />}
          </Button>
        </div>
        {currentTime !== undefined && (
          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={useTimestamp}
              onChange={(e) => setUseTimestamp(e.target.checked)}
              className="h-3.5 w-3.5"
            />
            Attach current timestamp ({formatDuration(Math.floor(currentTime))})
          </label>
        )}
      </div>
    </div>
  );
}
