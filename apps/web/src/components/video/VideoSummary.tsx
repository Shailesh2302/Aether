"use client";

import { FileText, Clock, Lightbulb, MessageSquare, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface VideoSummaryProps {
  summary: string;
  topics?: string[];
  duration: number;
  loading: boolean;
  onRegenerate: () => void;
  className?: string;
}

export function VideoSummary({
  summary,
  topics = [],
  duration,
  loading,
  onRegenerate,
  className,
}: VideoSummaryProps) {
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  if (loading) {
    return (
      <div className={cn("p-6 flex items-center justify-center", className)}>
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
          <p className="text-sm text-muted-foreground">Generating summary...</p>
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className={cn("p-6 text-center", className)}>
        <FileText className="h-12 w-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
        <p className="text-sm text-muted-foreground mb-4">
          Click &quot;Summary&quot; to generate an AI-powered summary of this video
        </p>
        <Button onClick={onRegenerate} variant="outline" size="sm">
          Generate Summary
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Video Summary</h3>
        </div>
        <Button onClick={onRegenerate} variant="ghost" size="sm">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Summary Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Summary Text */}
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{summary}</p>
        </div>

        {/* Topics Covered */}
        {topics.length > 0 && (
          <div className="mt-6">
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
              <Lightbulb className="h-4 w-4" />
              Topics Covered
            </h4>
            <div className="flex flex-wrap gap-2">
              {topics.map((topic, i) => (
                <span
                  key={i}
                  className="px-2 py-1 bg-primary/10 text-primary text-xs rounded-full"
                >
                  {topic}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Video Info */}
        <div className="mt-6 pt-4 border-t">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>Duration: {formatDuration(duration)}</span>
            </div>
            <div className="flex items-center gap-1">
              <MessageSquare className="h-4 w-4" />
              <span>{topics.length} topics</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
