"use client";

import { useState, useEffect, useCallback } from "react";
import { Play, Edit2, Trash2, Download, Scissors, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Clip, clipsApi } from "@/lib/api";

interface SmartClipsListProps {
  fileId: string;
  onPlayClip: (clip: Clip) => void;
  onSeekToTime: (time: number) => void;
  className?: string;
}

export function SmartClipsList({
  fileId,
  onPlayClip,
  onSeekToTime,
  className,
}: SmartClipsListProps) {
  const [clips, setClips] = useState<Clip[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadClips = useCallback(async () => {
    try {
      setLoading(true);
      const data = await clipsApi.list(fileId);
      setClips(data.clips || data || []);
    } catch (error) {
      console.error("Failed to load clips:", error);
    } finally {
      setLoading(false);
    }
  }, [fileId]);

  useEffect(() => {
    loadClips();
  }, [loadClips]);

  const handleDelete = async (clipId: string) => {
    try {
      setDeletingId(clipId);
      await clipsApi.delete(clipId);
      setClips((prev) => prev.filter((c) => c.id !== clipId));
    } catch (error) {
      console.error("Failed to delete clip:", error);
    } finally {
      setDeletingId(null);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getDuration = (clip: Clip) => {
    return clip.endTime - clip.startTime;
  };

  if (loading) {
    return (
      <div className={cn("flex items-center justify-center p-8", className)}>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Scissors className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Smart Clips</h3>
        </div>
        <span className="text-xs text-muted-foreground">{clips.length} clips</span>
      </div>

      {/* Clips List */}
      <div className="flex-1 overflow-y-auto">
        {clips.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <Scissors className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-sm">No clips yet</p>
            <p className="text-xs mt-2">Create clips from moments or highlights</p>
          </div>
        ) : (
          <div className="p-2 space-y-2">
            {clips.map((clip) => (
              <div
                key={clip.id}
                className="p-3 rounded-lg border hover:bg-accent group transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium text-sm">{clip.title}</h4>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>
                        {formatTime(clip.startTime)} - {formatTime(clip.endTime)}
                      </span>
                      <span className="text-muted">({getDuration(clip)}s)</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => onSeekToTime(clip.startTime)}
                      className="p-1.5 hover:bg-primary/10 rounded"
                      title="Seek to start"
                    >
                      <Play className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => onPlayClip(clip)}
                      className="p-1.5 hover:bg-primary/10 rounded"
                      title="Play clip"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(clip.id)}
                      disabled={deletingId === clip.id}
                      className="p-1.5 hover:bg-red-100 rounded"
                      title="Delete clip"
                    >
                      {deletingId === clip.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4 text-red-500" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
