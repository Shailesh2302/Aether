"use client";

import { useMemo } from "react";
import { Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { VideoMoment, VideoHighlight, VideoTopic } from "@/lib/api";

interface TimelineMarker {
  id: string;
  position: number;
  type: "moment" | "highlight" | "topic";
  label: string;
  timestamp: number;
  score: number;
}

interface VideoTimelineProps {
  duration: number;
  currentTime: number;
  onSeek: (time: number) => void;
  moments?: VideoMoment[];
  highlights?: VideoHighlight[];
  topics?: VideoTopic[];
  className?: string;
}

export function VideoTimeline({
  duration,
  currentTime,
  onSeek,
  moments = [],
  highlights = [],
  topics = [],
  className,
}: VideoTimelineProps) {
  const markers = useMemo(() => {
    const markerList: TimelineMarker[] = [];
    const totalDuration = duration || 1;

    moments.forEach((m, i) => {
      markerList.push({
        id: `moment-${i}`,
        position: (m.start_sec / totalDuration) * 100,
        type: "moment",
        label: m.description.substring(0, 30),
        timestamp: m.start_sec,
        score: m.importance_score,
      });
    });

    highlights.forEach((h, i) => {
      markerList.push({
        id: `highlight-${i}`,
        position: (h.start_sec / totalDuration) * 100,
        type: "highlight",
        label: h.title.substring(0, 30),
        timestamp: h.start_sec,
        score: h.importance_score,
      });
    });

    topics.forEach((t, i) => {
      markerList.push({
        id: `topic-${i}`,
        position: (t.timestamp_sec / totalDuration) * 100,
        type: "topic",
        label: t.topic.substring(0, 30),
        timestamp: t.timestamp_sec,
        score: t.relevance_score,
      });
    });

    return markerList.sort((a, b) => a.position - b.position);
  }, [moments, highlights, topics, duration]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getMarkerColor = (type: string) => {
    switch (type) {
      case "moment":
        return "bg-red-500";
      case "highlight":
        return "bg-yellow-500";
      case "topic":
        return "bg-blue-500";
      default:
        return "bg-gray-500";
    }
  };

  const getMarkerBorder = (type: string) => {
    switch (type) {
      case "moment":
        return "border-red-500";
      case "highlight":
        return "border-yellow-500";
      case "topic":
        return "border-blue-500";
      default:
        return "border-gray-500";
    }
  };

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const newTime = percentage * duration;
    onSeek(newTime);
  };

  return (
    <div className={cn("w-full p-4 bg-card rounded-lg", className)}>
      <div className="relative" onClick={handleClick}>
        <div className="h-2 bg-muted rounded-full cursor-pointer relative overflow-hidden">
          <div
            className="absolute left-0 top-0 h-full bg-primary rounded-full transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-primary rounded-full shadow-lg cursor-pointer"
            style={{ left: `${progress}%`, transform: "translateX(-50%)" }}
          />
        </div>

        <div className="absolute top-0 left-0 w-full h-8 -mt-1">
          {markers.map((marker) => (
            <div
              key={marker.id}
              className={cn(
                "absolute w-3 h-3 rounded-full border-2 cursor-pointer transition-transform hover:scale-125",
                getMarkerColor(marker.type),
                getMarkerBorder(marker.type)
              )}
              style={{
                left: `${marker.position}%`,
                top: "50%",
                transform: "translate(-50%, -50%)",
              }}
              title={`${marker.label} - ${formatTime(marker.timestamp)}`}
              onClick={(e) => {
                e.stopPropagation();
                onSeek(marker.timestamp);
              }}
            />
          ))}
        </div>
      </div>

      <div className="flex justify-between mt-2 text-xs text-muted-foreground">
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>

      <div className="flex items-center gap-4 mt-3 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <span>Moments ({moments.length})</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-yellow-500" />
          <span>Highlights ({highlights.length})</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-blue-500" />
          <span>Topics ({topics.length})</span>
        </div>
      </div>
    </div>
  );
}
