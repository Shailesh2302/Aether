import { cn, formatDuration, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Play, Download, Trash2, Scissors } from "lucide-react";
import type { Clip } from "@/lib/api";

interface ClipsListProps {
  clips: Clip[];
  onPlay: (clip: Clip) => void;
  onDelete: (clip: Clip) => void;
  onDownload: (clip: Clip) => void;
}

export function ClipsList({ clips, onPlay, onDelete, onDownload }: ClipsListProps) {
  if (clips.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
          <Scissors className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2">No clips yet</h3>
        <p className="text-sm text-muted-foreground">
          Create clips from your videos to save specific moments
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {clips.map((clip) => (
        <div
          key={clip.id}
          className="flex items-center gap-4 p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
        >
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-full bg-primary/10 hover:bg-primary/20"
            onClick={() => onPlay(clip)}
          >
            <Play className="h-4 w-4 text-primary" />
          </Button>

          <div className="flex-1 min-w-0">
            <h4 className="font-medium truncate">{clip.title}</h4>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span>{formatDuration(clip.endTime - clip.startTime)}</span>
              <span>
                {formatDuration(clip.startTime)} - {formatDuration(clip.endTime)}
              </span>
              <span>{formatDate(clip.createdAt)}</span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => onDownload(clip)}>
              <Download className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onDelete(clip)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}