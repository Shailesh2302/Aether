"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { clipsApi, type Clip, type FileItem } from "@/lib/api";
import { useUpload } from "@/hooks/useUpload";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Scissors,
  Play,
  Trash2,
  Plus,
  Video as VideoIcon,
  Clock,
  Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ClipEditor } from "@/components/clips/ClipEditor";
import { VideoPlayer } from "@/components/video/VideoPlayer";
import { formatDuration, formatDate, getFileCategory, getStatusColor, getStatusLabel } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

export default function ClipsPage() {
  const { files, fetchFiles } = useUpload();
  const [clips, setClips] = useState<Clip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [playingClip, setPlayingClip] = useState<Clip | null>(null);
  const [fileFilter, setFileFilter] = useState<string>("all");

  const fileList = useMemo(() => (Array.isArray(files) ? files : []), [files]);
  const videos = useMemo(
    () => fileList.filter((f) => getFileCategory(f.mimeType) === "video"),
    [fileList]
  );

  const fetchClips = async () => {
    try {
      setIsLoading(true);
      const list = await clipsApi.list();
      setClips(list);
    } catch (err) {
      console.error(err);
      toast({
        title: "Failed to load clips",
        description: "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchClips();
    fetchFiles();
  }, [fetchFiles]);

  const handleDelete = async (clip: Clip) => {
    if (!confirm(`Delete clip "${clip.title}"?`)) return;
    try {
      await clipsApi.delete(clip.id);
      setClips((prev) => prev.filter((c) => c.id !== clip.id));
      toast({ title: "Clip deleted" });
    } catch {
      setClips((prev) => prev.filter((c) => c.id !== clip.id));
      toast({ title: "Removed locally" });
    }
  };

  const handleClipSaved = async () => {
    setSelectedFile(null);
    await fetchClips();
  };

  const filteredClips = useMemo(() => {
    if (fileFilter === "all") return clips;
    return clips.filter((c) => c.fileId === fileFilter);
  }, [clips, fileFilter]);

  const playingFile = useMemo(() => {
    if (!playingClip?.fileId) return null;
    return fileList.find((f) => f.id === playingClip.fileId) ?? null;
  }, [playingClip, fileList]);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clips</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create and manage short clips from your videos
          </p>
        </div>
      </div>

      {/* Source videos */}
      <Card>
        <CardHeader>
          <CardTitle>Create a new clip</CardTitle>
          <CardDescription>Pick a source video to start clipping</CardDescription>
        </CardHeader>
        <CardContent>
          {videos.length === 0 ? (
            <div className="py-8 text-center">
              <VideoIcon className="mx-auto h-8 w-8 text-muted-foreground/50" />
              <p className="mt-2 text-sm text-muted-foreground">
                You don&apos;t have any videos yet
              </p>
              <Button asChild size="sm" className="mt-3">
                <Link href="/upload">Upload a video</Link>
              </Button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {videos.map((video) => (
                <button
                  key={video.id}
                  onClick={() => setSelectedFile(video)}
                  className="group flex flex-col items-stretch overflow-hidden rounded-md border bg-card text-left transition-colors hover:border-primary/40"
                >
                  <div className="relative aspect-video bg-muted">
                    {video.thumbnailUrl ? (
                      <img
                        src={video.thumbnailUrl}
                        alt={video.originalName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <VideoIcon className="h-8 w-8 text-muted-foreground/50" />
                      </div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/30">
                      <Plus className="h-8 w-8 text-white opacity-0 transition-opacity group-hover:opacity-100" />
                    </div>
                    {video.duration && (
                      <div className="absolute bottom-1.5 right-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white font-mono">
                        {formatDuration(video.duration)}
                      </div>
                    )}
                  </div>
                  <div className="p-2.5">
                    <p className="truncate text-xs font-medium">
                      {video.originalName}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Existing clips */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Your clips</CardTitle>
            <CardDescription>
              {clips.length} clip{clips.length === 1 ? "" : "s"} total
            </CardDescription>
          </div>
          {clips.length > 0 && (
            <Select value={fileFilter} onValueChange={setFileFilter}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All videos</SelectItem>
                {videos.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.originalName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Spinner size="lg" />
            </div>
          ) : filteredClips.length === 0 ? (
            <div className="py-10 text-center">
              <Scissors className="mx-auto h-8 w-8 text-muted-foreground/50" />
              <p className="mt-2 text-sm font-medium">No clips yet</p>
              <p className="text-xs text-muted-foreground">
                Create your first clip from a video above.
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredClips.map((clip) => {
                const source = fileList.find((f) => f.id === clip.fileId);
                return (
                  <div
                    key={clip.id}
                    className="flex items-center gap-3 py-3"
                  >
                    <button
                      onClick={() => setPlayingClip(clip)}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors hover:bg-primary/20"
                      aria-label="Play clip"
                    >
                      <Play className="h-4 w-4 fill-current ml-0.5" />
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {clip.title}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1 font-mono">
                          <Clock className="h-3 w-3" />
                          {formatDuration(clip.startTime)} –{" "}
                          {formatDuration(clip.endTime)}
                        </span>
                        <span>·</span>
                        <span>
                          {formatDuration(clip.endTime - clip.startTime)}{" "}
                          duration
                        </span>
                        {source && (
                          <>
                            <span>·</span>
                            <span className="truncate max-w-[12rem]">
                              {source.originalName}
                            </span>
                          </>
                        )}
                        <span>·</span>
                        <span>{formatDate(clip.createdAt)}</span>
                      </div>
                    </div>
                    <Badge variant={getStatusColor(clip.status)}>
                      {getStatusLabel(clip.status)}
                    </Badge>
                    <button
                      onClick={() => handleDelete(clip)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      aria-label="Delete clip"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Editor dialog */}
      <Dialog
        open={!!selectedFile}
        onOpenChange={(open) => !open && setSelectedFile(null)}
      >
        <DialogContent className="max-w-3xl p-0">
          {selectedFile && (
            <ClipEditor
              file={selectedFile}
              onSave={handleClipSaved}
              onCancel={() => setSelectedFile(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Player dialog */}
      <Dialog
        open={!!playingClip}
        onOpenChange={(open) => !open && setPlayingClip(null)}
      >
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          {playingClip && (
            <div>
              <DialogHeader className="px-6 pt-6 pb-2">
                <DialogTitle className="truncate">
                  {playingClip.title}
                </DialogTitle>
              </DialogHeader>
              <div className="px-6 pb-6">
                {playingFile?.url ? (
                  <VideoPlayer
                    src={playingFile.url}
                    initialTime={playingClip.startTime}
                    className="w-full"
                  />
                ) : (
                  <div className="aspect-video bg-muted flex items-center justify-center rounded-md">
                    <div className="text-center text-sm text-muted-foreground">
                      <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                      <p className="mt-2">Source video unavailable</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
