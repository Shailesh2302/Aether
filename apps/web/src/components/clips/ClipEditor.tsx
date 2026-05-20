"use client";

import { useState, useRef, useEffect } from "react";
import { cn, formatDuration } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Play, Check, X, Loader2 } from "lucide-react";
import type { File } from "@/lib/api";
import { ClipTimeline } from "@/components/video/ClipTimeline";
import { toast } from "@/hooks/use-toast";

interface ClipEditorProps {
  file: File;
  onSave: (startTime: number, endTime: number, name: string) => void;
  onCancel: () => void;
}

export function ClipEditor({ file, onSave, onCancel }: ClipEditorProps) {
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(file.duration || 60);
  const [name, setName] = useState("");
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const duration = file.duration || endTime;

  const handleSave = async () => {
    if (!name.trim() || endTime <= startTime) return;
    
    setIsSaving(true);
    try {
      const { clipsApi } = await import("@/lib/api");
      await clipsApi.generate(file.id, startTime, endTime, name.trim());
      toast({
        title: "Clip generated",
        description: "Your clip is being processed and will be available shortly.",
      });
    } catch (error) {
      console.log("API not available, continuing with local save");
    } finally {
      setIsSaving(false);
    }
    
    if (onSave) {
      onSave(startTime, endTime, name.trim());
    }
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (time: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = time;
    setCurrentTime(time);
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      if (video.currentTime >= endTime) {
        video.pause();
        setIsPlaying(false);
      }
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    return () => video.removeEventListener("timeupdate", handleTimeUpdate);
  }, [endTime]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Create Clip</h3>
        <Button variant="ghost" size="icon" onClick={onCancel}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {file.url && (
        <div className="relative rounded-lg overflow-hidden bg-black">
          <video
            ref={videoRef}
            src={file.url}
            className="w-full aspect-video"
            onClick={togglePlay}
          />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            {!isPlaying && (
              <div className="h-12 w-12 rounded-full bg-white/80 flex items-center justify-center">
                <Play className="h-6 w-6 text-black ml-1" />
              </div>
            )}
          </div>
        </div>
      )}

      <ClipTimeline
        duration={duration}
        startTime={startTime}
        endTime={endTime}
        onStartChange={setStartTime}
        onEndChange={setEndTime}
        onSeek={handleSeek}
        currentTime={currentTime}
      />

      <div className="space-y-2">
        <Label htmlFor="clip-name">Clip Name</Label>
        <Input
          id="clip-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter clip name"
        />
      </div>

      <div className="text-sm text-muted-foreground text-center bg-muted p-2 rounded">
        Duration: {formatDuration(endTime - startTime)}
      </div>

      <div className="flex gap-2">
        <Button variant="outline" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={!name.trim() || endTime <= startTime || isSaving}
          className="flex-1"
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Check className="h-4 w-4 mr-2" />
          )}
          Generate Clip
        </Button>
      </div>
    </div>
  );
}