"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { cn, formatDuration } from "@/lib/utils";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  SkipBack,
  SkipForward,
  Loader2,
} from "lucide-react";

export interface VideoPlayerHandle {
  currentTime: number;
  duration: number;
  seekTo: (time: number) => void;
  play: () => void;
  pause: () => void;
}

interface VideoPlayerProps {
  src: string;
  poster?: string;
  onTimeUpdate?: (time: number) => void;
  initialTime?: number;
  className?: string;
  onReady?: (handle: VideoPlayerHandle) => void;
  autoPlay?: boolean;
}

export function VideoPlayer({
  src,
  poster,
  onTimeUpdate,
  initialTime = 0,
  className,
  onReady,
  autoPlay = false,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(initialTime);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const seekTo = useCallback(
    (time: number) => {
      const video = videoRef.current;
      if (!video) return;
      const t = Math.max(0, Math.min(time, video.duration || time));
      video.currentTime = t;
      setCurrentTime(t);
    },
    []
  );

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoaded = () => {
      setDuration(video.duration || 0);
      setIsLoading(false);
      if (initialTime > 0) {
        video.currentTime = initialTime;
      }
      onReady?.({
        currentTime: video.currentTime,
        duration: video.duration,
        seekTo,
        play: () => video.play(),
        pause: () => video.pause(),
      });
    };

    const handleTime = () => {
      setCurrentTime(video.currentTime);
      onTimeUpdate?.(video.currentTime);
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleWaiting = () => setIsLoading(true);
    const handlePlaying = () => setIsLoading(false);
    const handleVolume = () => {
      setVolume(video.volume);
      setIsMuted(video.muted);
    };

    video.addEventListener("loadedmetadata", handleLoaded);
    video.addEventListener("timeupdate", handleTime);
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("waiting", handleWaiting);
    video.addEventListener("playing", handlePlaying);
    video.addEventListener("volumechange", handleVolume);

    return () => {
      video.removeEventListener("loadedmetadata", handleLoaded);
      video.removeEventListener("timeupdate", handleTime);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("waiting", handleWaiting);
      video.removeEventListener("playing", handlePlaying);
      video.removeEventListener("volumechange", handleVolume);
    };
  }, [initialTime, onReady, onTimeUpdate, seekTo]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play();
    else video.pause();
  };

  const skip = (delta: number) => {
    const video = videoRef.current;
    if (!video) return;
    seekTo(video.currentTime + delta);
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    seekTo(parseFloat(e.target.value));
  };

  const handleVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = parseFloat(e.target.value);
    if (video.volume > 0 && video.muted) video.muted = false;
  };

  const toggleFullscreen = () => {
    const video = videoRef.current;
    if (!video) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      video.requestFullscreen?.();
    }
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 2500);
  };

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-lg bg-black",
        className
      )}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        className="aspect-video w-full"
        onClick={togglePlay}
        autoPlay={autoPlay}
        playsInline
      />

      {isLoading && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/30">
          <Loader2 className="h-8 w-8 animate-spin text-white/80" />
        </div>
      )}

      {!isPlaying && !isLoading && (
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center"
          aria-label="Play"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 text-black">
            <Play className="h-6 w-6 fill-current ml-0.5" />
          </span>
        </button>
      )}

      <div
        className={cn(
          "absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-3 py-2 transition-opacity",
          showControls ? "opacity-100" : "opacity-0"
        )}
      >
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={currentTime}
          onChange={handleSeek}
          className="h-1 w-full cursor-pointer appearance-none rounded-full bg-white/30 accent-white"
          aria-label="Seek"
        />
        <div className="mt-1.5 flex items-center justify-between text-xs text-white">
          <div className="flex items-center gap-1">
            <button
              onClick={() => skip(-10)}
              className="inline-flex h-7 w-7 items-center justify-center rounded hover:bg-white/10"
              aria-label="Back 10s"
            >
              <SkipBack className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={togglePlay}
              className="inline-flex h-7 w-7 items-center justify-center rounded hover:bg-white/10"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4 fill-current" />
              )}
            </button>
            <button
              onClick={() => skip(10)}
              className="inline-flex h-7 w-7 items-center justify-center rounded hover:bg-white/10"
              aria-label="Forward 10s"
            >
              <SkipForward className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={toggleMute}
              className="inline-flex h-7 w-7 items-center justify-center rounded hover:bg-white/10"
              aria-label={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="h-3.5 w-3.5" />
              ) : (
                <Volume2 className="h-3.5 w-3.5" />
              )}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={isMuted ? 0 : volume}
              onChange={handleVolume}
              className="h-1 w-16 cursor-pointer appearance-none rounded-full bg-white/30 accent-white"
              aria-label="Volume"
            />
            <span className="ml-1 font-mono tabular-nums">
              {formatDuration(currentTime)} / {formatDuration(duration)}
            </span>
          </div>
          <button
            onClick={toggleFullscreen}
            className="inline-flex h-7 w-7 items-center justify-center rounded hover:bg-white/10"
            aria-label="Fullscreen"
          >
            <Maximize className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
