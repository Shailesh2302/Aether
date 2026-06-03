import { cn, formatDuration, formatFileSize } from "@/lib/utils";
import { Play, MoreVertical, Download, Trash2, Scissors, Loader2, CheckCircle, XCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { FileItem } from "@/lib/api";

interface VideoThumbnailProps {
  file: FileItem;
  onPlay?: () => void;
  onDelete?: () => void;
  onCreateClip?: () => void;
  onDownload?: () => void;
  className?: string;
}

function StatusBadge({ status }: { status?: string }) {
  switch (status) {
    case "pending":
      return (
        <div className="absolute top-2 left-2 flex items-center gap-1 bg-yellow-500/90 text-white px-2 py-1 rounded text-xs">
          <Clock className="h-3 w-3 animate-pulse" />
          Pending
        </div>
      );
    case "processing":
      return (
        <div className="absolute top-2 left-2 flex items-center gap-1 bg-blue-500/90 text-white px-2 py-1 rounded text-xs">
          <Loader2 className="h-3 w-3 animate-spin" />
          Processing
        </div>
      );
    case "completed":
      return (
        <div className="absolute top-2 left-2 flex items-center gap-1 bg-green-500/90 text-white px-2 py-1 rounded text-xs">
          <CheckCircle className="h-3 w-3" />
          Ready
        </div>
      );
    case "failed":
      return (
        <div className="absolute top-2 left-2 flex items-center gap-1 bg-red-500/90 text-white px-2 py-1 rounded text-xs">
          <XCircle className="h-3 w-3" />
          Failed
        </div>
      );
    default:
      return null;
  }
}

export function VideoThumbnail({
  file,
  onPlay,
  onDelete,
  onCreateClip,
  onDownload,
  className,
}: VideoThumbnailProps) {
  return (
    <div
      className={cn(
        "group relative rounded-lg overflow-hidden border bg-card hover:border-primary/50 transition-colors",
        className
      )}
    >
      <div
        className="aspect-video bg-muted relative cursor-pointer"
        onClick={onPlay}
      >
        {file.thumbnailUrl ? (
          <img
            src={file.thumbnailUrl}
            alt={file.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Play className="h-12 w-12 text-muted-foreground" />
          </div>
        )}
        
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
          <div className="h-12 w-12 rounded-full bg-white/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Play className="h-6 w-6 text-black ml-1" />
          </div>
        </div>

        {file.duration && (
          <div className="absolute bottom-2 right-2 bg-black/70 px-2 py-1 rounded text-xs text-white">
            {formatDuration(file.duration)}
          </div>
        )}

        <StatusBadge status={file.status} />
      </div>

      <div className="p-3">
        <h3 className="font-medium text-sm truncate">{file.name}</h3>
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs text-muted-foreground">
            {formatFileSize(file.size)}
          </span>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onDownload}>
              <Download className="h-3 w-3" />
            </Button>
            {onCreateClip && (
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onCreateClip}>
                <Scissors className="h-3 w-3" />
              </Button>
            )}
            {onDelete && (
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onDelete}>
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}