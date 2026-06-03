"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useUpload } from "@/hooks/useUpload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Upload,
  Search,
  Play,
  Clock,
  Zap,
  Lightbulb,
  FileText,
  MessageSquare,
  Scissors,
  Activity,
  Video as VideoIcon,
  MoreHorizontal,
} from "lucide-react";
import {
  formatDuration,
  formatRelativeTime,
  getStatusColor,
  getStatusLabel,
  getFileCategory,
} from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { VideoPlayer } from "@/components/video/VideoPlayer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { FileItem } from "@/lib/api";

type StatusFilter = "all" | "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

export default function VideosPage() {
  const router = useRouter();
  const { files, fetchFiles, isFetching } = useUpload();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedVideo, setSelectedVideo] = useState<FileItem | null>(null);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const videos = useMemo(() => {
    const list = Array.isArray(files) ? files : [];
    return list
      .filter((f) => getFileCategory(f.mimeType) === "video")
      .filter((v) => {
        const matchesSearch = v.originalName
          .toLowerCase()
          .includes(search.trim().toLowerCase());
        const matchesStatus =
          statusFilter === "all" || v.status === statusFilter;
        return matchesSearch && matchesStatus;
      })
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  }, [files, search, statusFilter]);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Videos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Browse and analyze your video library
          </p>
        </div>
        <Button asChild>
          <Link href="/upload">
            <Upload className="h-4 w-4" />
            Upload video
          </Link>
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search videos…"
            className="pl-9"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as StatusFilter)}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="COMPLETED">Ready</SelectItem>
            <SelectItem value="PROCESSING">Processing</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="FAILED">Failed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isFetching && videos.length === 0 ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : videos.length === 0 ? (
        <EmptyState hasFiles={(files?.length ?? 0) > 0} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {videos.map((video) => (
            <VideoCard
              key={video.id}
              video={video}
              onPlay={() => setSelectedVideo(video)}
              onOpen={() => router.push(`/dashboard/videos/${video.id}`)}
              onNavigate={(path) => router.push(path)}
            />
          ))}
        </div>
      )}

      <Dialog
        open={!!selectedVideo}
        onOpenChange={(open) => !open && setSelectedVideo(null)}
      >
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle className="truncate">
              {selectedVideo?.originalName}
            </DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6">
            {selectedVideo?.url && (
              <VideoPlayer
                src={selectedVideo.url}
                initialTime={0}
                className="w-full"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function VideoCard({
  video,
  onPlay,
  onOpen,
  onNavigate,
}: {
  video: FileItem;
  onPlay: () => void;
  onOpen: () => void;
  onNavigate: (path: string) => void;
}) {
  return (
    <div className="group overflow-hidden rounded-lg border bg-card transition-colors hover:border-primary/40">
      <div className="relative aspect-video bg-muted">
        {video.thumbnailUrl ? (
          <img
            src={video.thumbnailUrl}
            alt={video.originalName}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <VideoIcon className="h-10 w-10 text-muted-foreground/50" />
          </div>
        )}
        <button
          onClick={onPlay}
          className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/30"
          aria-label="Play video"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-black opacity-0 transition-opacity group-hover:opacity-100">
            <Play className="h-5 w-5 fill-current ml-0.5" />
          </span>
        </button>
        <div className="absolute top-2 left-2">
          <Badge variant={getStatusColor(video.status)}>
            {getStatusLabel(video.status)}
          </Badge>
        </div>
        {video.duration ? (
          <div className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-xs text-white font-mono">
            {formatDuration(video.duration)}
          </div>
        ) : null}
      </div>
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <button
            onClick={onOpen}
            className="min-w-0 flex-1 text-left"
          >
            <p className="truncate text-sm font-medium">{video.originalName}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {formatRelativeTime(video.createdAt)}
            </p>
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label="More actions"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={onOpen}>
                <MessageSquare className="h-4 w-4" />
                Open & chat
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  onNavigate(`/dashboard/videos/${video.id}/moments`)
                }
              >
                <Clock className="h-4 w-4" />
                Moments
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  onNavigate(`/dashboard/videos/${video.id}/highlights`)
                }
              >
                <Zap className="h-4 w-4" />
                Highlights
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  onNavigate(`/dashboard/videos/${video.id}/topics`)
                }
              >
                <Lightbulb className="h-4 w-4" />
                Topics
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  onNavigate(`/dashboard/videos/${video.id}/summary`)
                }
              >
                <FileText className="h-4 w-4" />
                Summary
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  onNavigate(`/dashboard/videos/${video.id}/smart-clips`)
                }
              >
                <Scissors className="h-4 w-4" />
                Smart clips
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  onNavigate(`/dashboard/videos/${video.id}/status`)
                }
              >
                <Activity className="h-4 w-4" />
                Status
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ hasFiles }: { hasFiles: boolean }) {
  return (
    <div className="rounded-lg border bg-card py-16 text-center">
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <VideoIcon className="h-5 w-5" />
      </div>
      <h3 className="text-sm font-medium">
        {hasFiles ? "No videos match your filters" : "No videos yet"}
      </h3>
      <p className="mx-auto mt-1 max-w-xs text-xs text-muted-foreground">
        {hasFiles
          ? "Try a different search or status."
          : "Upload a video to start analyzing it with AI."}
      </p>
      {!hasFiles && (
        <Button asChild size="sm" className="mt-4">
          <Link href="/upload">
            <Upload className="h-3 w-3" />
            Upload video
          </Link>
        </Button>
      )}
    </div>
  );
}
