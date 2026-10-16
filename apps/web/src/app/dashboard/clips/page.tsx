"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { clipsApi, videoApi, filesApi, type Clip, type FileItem, type SmartClip } from "@/lib/api";
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
  Sparkles,
  Download,
  Zap,
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
  const [highlightVideoId, setHighlightVideoId] = useState<string>("");
  const [highlights, setHighlights] = useState<SmartClip[]>([]);
  const [highlightsLoading, setHighlightsLoading] = useState(false);
  const [highlightsError, setHighlightsError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ clip: SmartClip; fileId: string } | null>(null);
  const [gettingClip, setGettingClip] = useState<string | null>(null);

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

  // Default the highlights section to the first ready video.
  useEffect(() => {
    if (!highlightVideoId) {
      const ready = videos.find((v) => v.status === "COMPLETED") ?? videos[0];
      if (ready) setHighlightVideoId(ready.id);
    }
  }, [videos, highlightVideoId]);

  const loadHighlights = async (fileId: string) => {
    if (!fileId) return;
    setHighlightsLoading(true);
    setHighlightsError(null);
    try {
      const data = await videoApi.getSmartClips(fileId, 6);
      setHighlights(data.clips ?? []);
    } catch {
      setHighlights([]);
      setHighlightsError("Couldn't load highlights for this video yet. Try again once processing finishes.");
    } finally {
      setHighlightsLoading(false);
    }
  };

  useEffect(() => {
    if (highlightVideoId) loadHighlights(highlightVideoId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightVideoId]);

  const handleGetHighlightClip = async (clip: SmartClip) => {
    const key = `${clip.start_sec}-${clip.end_sec}`;
    setGettingClip(key);
    try {
      const { clip: created } = await clipsApi.generate({
        fileId: highlightVideoId,
        startTime: clip.start_sec,
        endTime: clip.end_sec,
        title: clip.title,
      });
      // The server cuts in the background - wait for the real file so the
      // "ready" toast only fires when the clip can actually be played.
      const finished = await clipsApi.waitUntilReady(created.id);
      await fetchClips();
      if (finished.status === "COMPLETED") {
        toast({ title: "Clip ready", description: `"${clip.title}" was added to your clips.` });
      } else {
        toast({ title: "Clip failed", description: "Cutting failed - please try again", variant: "destructive" });
      }
    } catch {
      toast({ title: "Couldn't create clip", description: "Please try again", variant: "destructive" });
    } finally {
      setGettingClip(null);
    }
  };

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

  const highlightVideo = useMemo(
    () => videos.find((v) => v.id === highlightVideoId) ?? null,
    [videos, highlightVideoId]
  );

  const previewFile = useMemo(() => {
    if (!preview) return null;
    return fileList.find((f) => f.id === preview.fileId) ?? null;
  }, [preview, fileList]);

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

      {/* AI Highlights — pre-processed key moments with one-click clips */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              AI Highlights
            </CardTitle>
            <CardDescription>
              Key moments detected in your video — preview one, or save it as a clip
            </CardDescription>
          </div>
          {videos.length > 0 && (
            <Select value={highlightVideoId} onValueChange={setHighlightVideoId}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="Select video" />
              </SelectTrigger>
              <SelectContent>
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
          {videos.length === 0 ? (
            <div className="py-8 text-center">
              <Zap className="mx-auto h-8 w-8 text-muted-foreground/50" />
              <p className="mt-2 text-sm text-muted-foreground">
                Upload a video and highlights will appear here automatically
              </p>
              <Button asChild size="sm" className="mt-3">
                <Link href="/upload">Upload a video</Link>
              </Button>
            </div>
          ) : highlightsLoading ? (
            <div className="flex justify-center py-8">
              <Spinner size="lg" />
            </div>
          ) : highlightsError ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{highlightsError}</p>
          ) : highlights.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No highlights detected for this video yet.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {highlights.map((h, i) => {
                const key = `${h.start_sec}-${h.end_sec}`;
                return (
                  <div
                    key={key}
                    className="group overflow-hidden rounded-md border bg-card transition-colors hover:border-primary/40"
                  >
                    <button
                      className="relative block aspect-video w-full bg-muted text-left"
                      onClick={() => setPreview({ clip: h, fileId: highlightVideoId })}
                      aria-label={`Preview ${h.title}`}
                    >
                      <img
                        src={filesApi.thumbnailUrl(highlightVideoId, h.start_sec)}
                        alt={h.title}
                        loading="lazy"
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/30">
                        <Play className="h-8 w-8 fill-current text-white opacity-0 transition-opacity group-hover:opacity-100" />
                      </div>
                      <div className="absolute bottom-1.5 right-1.5 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[10px] text-white">
                        {formatDuration(h.start_sec)} – {formatDuration(h.end_sec)}
                      </div>
                      {typeof h.importance_score === "number" && (
                        <div className="absolute top-1.5 left-1.5">
                          <Badge variant="secondary">
                            {Math.round(h.importance_score * 100)}%
                          </Badge>
                        </div>
                      )}
                    </button>
                    <div className="space-y-2 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium leading-snug">{h.title}</p>
                        {h.category && (
                          <Badge variant="outline" className="shrink-0 text-[10px]">
                            {h.category}
                          </Badge>
                        )}
                      </div>
                      {highlightVideo && (
                        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <VideoIcon className="h-3 w-3 shrink-0" />
                          <span className="truncate">
                            From: {highlightVideo.originalName}
                          </span>
                        </p>
                      )}
                      {h.description && (
                        <p className="line-clamp-2 text-xs text-muted-foreground">
                          {h.description}
                        </p>
                      )}
                      <Button
                        size="sm"
                        className="w-full"
                        disabled={gettingClip === key}
                        onClick={() => handleGetHighlightClip(h)}
                      >
                        {gettingClip === key ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Download className="h-3.5 w-3.5" />
                        )}
                        Get this clip
                      </Button>
                    </div>
                  </div>
                );
              })}
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
                <p className="font-mono text-xs text-muted-foreground">
                  {formatDuration(playingClip.startTime)} – {formatDuration(playingClip.endTime)}
                  {playingFile ? ` · From: ${playingFile.originalName}` : ""}
                </p>
              </DialogHeader>
              <div className="px-6 pb-6">
                {playingFile?.url ? (
                  <VideoPlayer
                    src={playingFile.url}
                    initialTime={playingClip.startTime}
                    stopAt={playingClip.endTime}
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

      {/* Highlight preview dialog */}
      <Dialog
        open={!!preview}
        onOpenChange={(open) => !open && setPreview(null)}
      >
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          {preview && (
            <div>
              <DialogHeader className="px-6 pt-6 pb-2">
                <DialogTitle className="truncate">{preview.clip.title}</DialogTitle>
              </DialogHeader>
              <div className="px-6 pb-6 space-y-3">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <VideoIcon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">
                    From: {previewFile?.originalName ?? "source video"}
                  </span>
                  <span className="font-mono">
                    {formatDuration(preview.clip.start_sec)} – {formatDuration(preview.clip.end_sec)}
                  </span>
                </p>
                {previewFile?.url ? (
                  <VideoPlayer
                    src={previewFile.url}
                    initialTime={preview.clip.start_sec}
                    stopAt={preview.clip.end_sec}
                    className="w-full"
                  />
                ) : (
                  <div className="aspect-video bg-muted flex items-center justify-center rounded-md">
                    <p className="text-sm text-muted-foreground">Source video unavailable</p>
                  </div>
                )}
                {preview.clip.description && (
                  <p className="text-sm text-muted-foreground">{preview.clip.description}</p>
                )}
                <Button
                  className="w-full"
                  disabled={gettingClip === `${preview.clip.start_sec}-${preview.clip.end_sec}`}
                  onClick={() => handleGetHighlightClip(preview.clip)}
                >
                  <Download className="h-4 w-4" />
                  Get this clip
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
