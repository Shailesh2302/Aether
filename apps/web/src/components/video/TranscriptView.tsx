"use client";

import { useState } from "react";
import { cn, formatDuration } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import type { TranscriptSegment } from "@/lib/api";

interface TranscriptViewProps {
  transcript: TranscriptSegment[];
  currentTime: number;
  onSeek: (time: number) => void;
  isLoading?: boolean;
}

export function TranscriptView({
  transcript,
  currentTime,
  onSeek,
  isLoading,
}: TranscriptViewProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredTranscript = searchQuery
    ? transcript.filter((seg) =>
        seg.text.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : transcript;

  const getCurrentSegmentIndex = () => {
    return transcript.findIndex(
      (seg) => currentTime >= seg.startTime && currentTime <= seg.endTime
    );
  };

  const currentIndex = getCurrentSegmentIndex();

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <div className="text-center text-muted-foreground">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-sm">Loading transcript...</p>
        </div>
      </div>
    );
  }

  if (transcript.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <div className="text-center text-muted-foreground">
          <p className="text-sm">No transcript available</p>
          <p className="text-xs mt-1">Transcript will appear here once processed</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search transcript..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filteredTranscript.map((segment, index) => {
          const isActive = index === currentIndex;
          const isPast = currentTime > segment.endTime;

          return (
            <button
              key={segment.id}
              onClick={() => onSeek(segment.startTime)}
              className={cn(
                "w-full text-left p-2 rounded-lg transition-colors",
                isActive
                  ? "bg-primary/10 border-l-2 border-primary"
                  : "hover:bg-muted/50"
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={cn(
                    "text-xs font-mono",
                    isActive
                      ? "text-primary"
                      : isPast
                      ? "text-muted-foreground"
                      : "text-muted-foreground"
                  )}
                >
                  {formatDuration(segment.startTime)}
                </span>
              </div>
              <p
                className={cn(
                  "text-sm",
                  isActive && "font-medium",
                  isPast && "opacity-60"
                )}
              >
                {segment.text}
              </p>
            </button>
          );
        })}
      </div>

      {searchQuery && filteredTranscript.length === 0 && (
        <div className="p-4 text-center text-muted-foreground text-sm">
          No matching text found
        </div>
      )}
    </div>
  );
}