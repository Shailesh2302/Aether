"use client";

import { useRef, useState, useEffect } from "react";
import { cn, formatDuration } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface ClipTimelineProps {
  duration: number;
  startTime: number;
  endTime: number;
  onStartChange: (time: number) => void;
  onEndChange: (time: number) => void;
  onSeek: (time: number) => void;
  currentTime: number;
}

export function ClipTimeline({
  duration,
  startTime,
  endTime,
  onStartChange,
  onEndChange,
  onSeek,
  currentTime,
}: ClipTimelineProps) {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState<"start" | "end" | null>(null);

  const getPositionFromTime = (time: number) => {
    return (time / duration) * 100;
  };

  const getTimeFromPosition = (e: MouseEvent) => {
    if (!timelineRef.current) return 0;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    return percentage * duration;
  };

  const handleMouseDown = (type: "start" | "end") => (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(type);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!timelineRef.current) return;
      const rect = timelineRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, x / rect.width));
      const time = percentage * duration;
      
      if (isDragging === "start") {
        onStartChange(Math.min(time, endTime - 1));
      } else {
        onEndChange(Math.max(time, startTime + 1));
      }
    };

    const handleMouseUp = () => {
      setIsDragging(null);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, startTime, endTime, duration, onStartChange, onEndChange]);

  const handleTimelineClick = (e: React.MouseEvent) => {
    if (!timelineRef.current) return;
    const time = getTimeFromPosition(e.nativeEvent);
    onSeek(time);
  };

  return (
    <div className="space-y-4">
      <div className="relative h-8 bg-muted rounded-lg overflow-hidden" ref={timelineRef} onClick={handleTimelineClick}>
        <div
          className="absolute h-full bg-primary/30"
          style={{
            left: `${getPositionFromTime(startTime)}%`,
            width: `${getPositionFromTime(endTime - startTime)}%`,
          }}
        />

        <div
          className={cn(
            "absolute top-0 h-full w-1 bg-primary cursor-ew-resize group",
            isDragging === "start" && "bg-primary/80"
          )}
          style={{ left: `${getPositionFromTime(startTime)}%` }}
          onMouseDown={handleMouseDown("start")}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="absolute -top-1 -left-2 w-4 h-8 bg-primary rounded-l flex items-center justify-center">
            <div className="w-0.5 h-3 bg-white rounded-full" />
          </div>
        </div>

        <div
          className={cn(
            "absolute top-0 h-full w-1 bg-primary cursor-ew-resize group",
            isDragging === "end" && "bg-primary/80"
          )}
          style={{ left: `${getPositionFromTime(endTime)}%` }}
          onMouseDown={handleMouseDown("end")}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="absolute -top-1 -right-2 w-4 h-8 bg-primary rounded-r flex items-center justify-center">
            <div className="w-0.5 h-3 bg-white rounded-full" />
          </div>
        </div>

        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white border-2 border-primary rounded-full"
          style={{ left: `calc(${getPositionFromTime(currentTime)}% - 6px)` }}
        />
      </div>

      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onStartChange(currentTime)}
            className="text-xs"
          >
            Set Start
          </Button>
          <span className="text-muted-foreground font-mono">
            {formatDuration(startTime)}
          </span>
        </div>

        <span className="text-muted-foreground">
          Duration: {formatDuration(endTime - startTime)}
        </span>

        <div className="flex items-center gap-2">
          <span className="text-muted-foreground font-mono">
            {formatDuration(endTime)}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEndChange(currentTime)}
            className="text-xs"
          >
            Set End
          </Button>
        </div>
      </div>
    </div>
  );
}