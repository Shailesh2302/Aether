import { cn, formatDuration, formatFileSize } from "@/lib/utils";
import { Play, MoreVertical, Download, Trash2, Scissors } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { File } from "@/lib/api";

interface VideoThumbnailProps {
  file: File;
  onPlay?: () => void;
  onDelete?: () => void;
  onCreateClip?: () => void;
  onDownload?: () => void;
  className?: string;
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