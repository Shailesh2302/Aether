"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Loader2, Scissors, Video as VideoIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { VideoPlayer } from "@/components/video/VideoPlayer";
import { clipsApi, filesApi, type FileItem } from "@/lib/api";
import { formatDuration } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

export interface SegmentPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileId: string;
  startSec: number;
  endSec: number;
  title?: string;
  description?: string;
  /** Show a "Save as clip" action that cuts the segment asynchronously. */
  allowCreateClip?: boolean;
  onClipCreated?: () => void;
}

// Previews are often opened repeatedly for segments of the same source
// video. Keep the fetched source row for a minute so Play is instant.
const fileCache = new Map<string, { file: FileItem; expiresAt: number }>();
const FILE_CACHE_TTL_MS = 60_000;

export function SegmentPreviewDialog({
  open,
  onOpenChange,
  fileId,
  startSec,
  endSec,
  title,
  description,
  allowCreateClip = false,
  onClipCreated,
}: SegmentPreviewDialogProps) {
  const [file, setFile] = useState<FileItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const safeStart = Math.max(0, Number.isFinite(startSec) ? startSec : 0);
  const safeEnd =
    Number.isFinite(endSec) && endSec > safeStart ? endSec : safeStart + 30;

  useEffect(() => {
    if (!open || !fileId) return;

    const cached = fileCache.get(fileId);
    if (cached && cached.expiresAt > Date.now()) {
      setFile(cached.file);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setFile(null);

    filesApi
      .get(fileId)
      .then((data) => {
        if (cancelled) return;
        fileCache.set(fileId, {
          file: data,
          expiresAt: Date.now() + FILE_CACHE_TTL_MS,
        });
        // Keep this module-level cache bounded during long sessions.
        if (fileCache.size > 25) {
          const now = Date.now();
          for (const [key, entry] of fileCache) {
            if (entry.expiresAt <= now) fileCache.delete(key);
          }
          while (fileCache.size > 25) {
            const oldest = fileCache.keys().next().value;
            if (oldest === undefined) break;
            fileCache.delete(oldest);
          }
        }
        setFile(data);
      })
      .catch((err) => {
        if (cancelled) return;
        const message =
          (err as { response?: { data?: { error?: string } } })?.response?.data
            ?.error || "Could not load the source video.";
        setError(message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, fileId]);

  const handleCreateClip = async () => {
    if (!fileId || creating) return;
    setCreating(true);
    try {
      const { clip } = await clipsApi.generate({
        fileId,
        startTime: safeStart,
        endTime: safeEnd,
        title:
          title ||
          `Clip ${formatDuration(safeStart)} – ${formatDuration(safeEnd)}`,
      });
      const finished = await clipsApi.waitUntilReady(clip.id);
      if (finished.status === "COMPLETED") {
        toast({
          title: "Clip saved",
          description: "The cut clip is now available in your Clips library.",
        });
        onClipCreated?.();
      } else {
        toast({
          title: "Clip could not be cut",
          description: "The renderer reported a failure. Please try again.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Couldn't create clip",
        description: "Please try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl overflow-hidden p-0">
        <DialogHeader className="px-6 pb-2 pt-6">
          <DialogTitle className="truncate pr-8">
            {title || "Preview segment"}
          </DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            <span className="inline-flex items-center gap-1.5">
              <VideoIcon className="h-3.5 w-3.5 shrink-0" />
              <span className="max-w-[22rem] truncate">
                {file?.originalName ?? "Source video"}
              </span>
            </span>
            <span className="font-mono">
              {formatDuration(safeStart)} – {formatDuration(safeEnd)}
            </span>
            <span>({formatDuration(safeEnd - safeStart)})</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 px-6 pb-6">
          {loading ? (
            <div className="flex aspect-video items-center justify-center rounded-md bg-muted">
              <div className="text-center text-sm text-muted-foreground">
                <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                <p className="mt-2">Loading source video…</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex aspect-video flex-col items-center justify-center gap-2 rounded-md bg-muted p-6 text-center">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <p className="text-sm font-medium">Video unavailable</p>
              <p className="text-xs text-muted-foreground">{error}</p>
            </div>
          ) : file?.url ? (
            <VideoPlayer
              key={`${file.id}-${safeStart}-${safeEnd}`}
              src={file.url}
              initialTime={safeStart}
              stopAt={safeEnd}
              clipStart={safeStart}
              autoPlay
              className="w-full"
            />
          ) : (
            <div className="flex aspect-video flex-col items-center justify-center gap-2 rounded-md bg-muted p-6 text-center">
              <AlertCircle className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">No playable source yet</p>
              <p className="text-xs text-muted-foreground">
                The video may still be processing or the source file is
                unavailable.
              </p>
            </div>
          )}

          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}

          {allowCreateClip && (
            <Button
              className="w-full"
              disabled={creating || loading || !file?.url}
              onClick={handleCreateClip}
            >
              {creating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Scissors className="h-4 w-4" />
              )}
              {creating ? "Cutting clip…" : "Save this segment as a clip"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
