"use client";

import { ListVideo } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { VideoHighlight, VideoMoment } from "@/lib/api";
import { formatDuration } from "@/lib/utils";

interface ChaptersListProps {
  highlights: VideoHighlight[];
  moments: VideoMoment[];
  onSeek: (time: number) => void;
  className?: string;
}

export function ChaptersList({ highlights, moments, onSeek, className }: ChaptersListProps) {
  const chapters = (highlights.length > 0
    ? highlights.map((h) => ({ time: h.start_sec, title: h.title || "Highlight" }))
    : moments.map((m) => ({
        time: m.start_sec,
        title: m.description ? m.description.slice(0, 60) : "Moment",
      }))
  ).sort((a, b) => a.time - b.time);

  if (chapters.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Chapters appear once highlights or moments are generated.
      </p>
    );
  }

  return (
    <div className={className}>
      <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <ListVideo className="h-3.5 w-3.5" />
        Chapters ({chapters.length})
      </p>
      <div className="space-y-1">
        {chapters.map((c, i) => (
          <button
            key={`${c.time}-${i}`}
            onClick={() => onSeek(c.time)}
            className="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent"
          >
            <span className="font-mono text-xs text-primary">{formatDuration(c.time)}</span>
            <span className="min-w-0 flex-1 truncate text-xs">{c.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
