"use client";

import { useRef, useState, useEffect } from "react";
import { cn, formatDuration } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  SkipBack,
  SkipForward,
  Settings,
} from "lucide-react";

interface VideoPlayerProps {
  src: string;
  poster?: string;
  onTimeUpdate?: (time: number) => void;
  initialTime?: number;
  className?: string;
}

export function VideoPlayer({
  src,
  poster,
  onTimeUpdate,
  initialTime = 0,
  className,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(initialTime);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [buffered, setBuffered] = useState(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      if (initialTime > 0) {
        video.currentTime = initialTime;
      }
    };

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      onTimeUpdate?.(video.currentTime);
    };

    const handleProgress = () => {
      if (video.buffered.length > 0) {
        setBuffered((video.buffered.end(video.buffered.length - 1) / video.duration) * 100);
      }
    };

    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("progress", handleProgress);

    return () => {
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("progress", handleProgress);
    };
  }, [initialTime, onTimeUpdate]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    
    if (isPlaying) {
      video.pause();
    } else {
      video.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (value: number[]) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = value[0];
    setCurrentTime(value[0]);
  };

  const handleVolumeChange = (value: number[]) => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = value[0];
    setVolume(value[0]);
    setIsMuted(value[0] === 0);
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const skip = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(duration, video.currentTime + seconds));
  };

  const toggleFullscreen = () => {
    const video = videoRef.current;
    if (!video) return;
    
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      video.requestFullscreen();
    }
  };

  return (
    <div
      className={cn("relative bg-black rounded-lg overflow-hidden group", className)}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        className="w-full aspect-video"
        onClick={togglePlay}
      />

      <div
        className={cn(
          "absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 transition-opacity",
          showControls ? "opacity-100" : "opacity-0"
        )}
      >
        <div className="relative h-1 bg-white/30 rounded-full mb-4">
          <div
            className="absolute h-full bg-white/60 rounded-full"
            style={{ width: `${buffered}%` }}
          />
          <Slider
            value={[currentTime]}
            max={duration || 100}
            step={0.1}
            onValueChange={handleSeek}
            className="absolute inset-0 h-full cursor-pointer"
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => skip(-10)}>
              <SkipBack className="h-4 w-4 text-white" />
            </Button>
            <Button variant="ghost" size="icon" onClick={togglePlay}>
              {isPlaying ? (
                <Pause className="h-5 w-5 text-white" />
              ) : (
                <Play className="h-5 w-5 text-white" />
              )}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => skip(10)}>
              <SkipForward className="h-4 w-4 text-white" />
            </Button>

            <div className="flex items-center gap-2 ml-2">
              <Button variant="ghost" size="icon" onClick={toggleMute}>
                {isMuted ? (
                  <VolumeX className="h-4 w-4 text-white" />
                ) : (
                  <Volume2 className="h-4 w-4 text-white" />
                )}
              </Button>
              <Slider
                value={[isMuted ? 0 : volume]}
                max={1}
                step={0.1}
                onValueChange={handleVolumeChange}
                className="w-20"
              />
            </div>

            <span className="text-sm text-white ml-4">
              {formatDuration(currentTime)} / {formatDuration(duration)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon">
              <Settings className="h-4 w-4 text-white" />
            </Button>
            <Button variant="ghost" size="icon" onClick={toggleFullscreen}>
              <Maximize className="h-4 w-4 text-white" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}