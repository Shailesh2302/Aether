"use client";

import { useState, useCallback } from "react";
import { 
  Sparkles, 
  Clock, 
  Zap, 
  Lightbulb, 
  MessageSquare, 
  Scissors,
  FileText,
  Loader2,
  ChevronDown,
  ChevronRight,
  Play
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { 
  VideoMoment, 
  VideoHighlight, 
  VideoTopic,
  clipsApi
} from "@/lib/api";

interface AIFeaturesPanelProps {
  fileId: string;
  fileName: string;
  duration: number;
  
  moments: VideoMoment[];
  highlights: VideoHighlight[];
  topics: VideoTopic[];
  summary: string;
  processingStatus: "idle" | "processing" | "completed" | "failed";
  
  momentsLoading: boolean;
  highlightsLoading: boolean;
  topicsLoading: boolean;
  summaryLoading: boolean;
  
  onFindMoments: () => void;
  onGenerateHighlights: () => void;
  onDetectTopics: () => void;
  onGenerateSummary: () => void;
  onSeek: (time: number) => void;
  onAskQuestion?: () => void;
  onCreateClip?: (start: number, end: number) => void;
  
  className?: string;
}

export function AIFeaturesPanel({
  fileId,
  fileName,
  duration,
  moments,
  highlights,
  topics,
  summary,
  processingStatus,
  momentsLoading,
  highlightsLoading,
  topicsLoading,
  summaryLoading,
  onFindMoments,
  onGenerateHighlights,
  onDetectTopics,
  onGenerateSummary,
  onSeek,
  onAskQuestion,
  onCreateClip,
  className,
}: AIFeaturesPanelProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>("moments");

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getImportanceColor = (score: number) => {
    if (score >= 0.8) return "text-red-500";
    if (score >= 0.6) return "text-orange-500";
    if (score >= 0.4) return "text-yellow-500";
    return "text-blue-500";
  };

  const handleCreateClip = async (startSec: number, endSec: number) => {
    if (onCreateClip) {
      onCreateClip(startSec, endSec);
      return;
    }
    try {
      await clipsApi.create({
        fileId,
        startTime: startSec,
        endTime: endSec,
        title: `Clip ${formatTime(startSec)} - ${formatTime(endSec)}`,
      });
    } catch (err) {
      console.error("Failed to create clip:", err);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  return (
    <div className={cn("flex flex-col h-full bg-card", className)}>
      <div className="p-4 border-b">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">AI Video Features</h3>
        </div>
        
        <div className="grid grid-cols-2 gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={onFindMoments}
            disabled={momentsLoading || processingStatus === "processing"}
            className="w-full"
          >
            {momentsLoading ? <Spinner size="sm" /> : <Clock className="h-4 w-4 mr-1" />}
            Moments
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onGenerateHighlights}
            disabled={highlightsLoading || processingStatus === "processing"}
            className="w-full"
          >
            {highlightsLoading ? <Spinner size="sm" /> : <Zap className="h-4 w-4 mr-1" />}
            Highlights
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onDetectTopics}
            disabled={topicsLoading || processingStatus === "processing"}
            className="w-full"
          >
            {topicsLoading ? <Spinner size="sm" /> : <Lightbulb className="h-4 w-4 mr-1" />}
            Topics
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onGenerateSummary}
            disabled={summaryLoading || processingStatus === "processing"}
            className="w-full"
          >
            {summaryLoading ? <Spinner size="sm" /> : <FileText className="h-4 w-4 mr-1" />}
            Summary
          </Button>
        </div>

        {onAskQuestion && (
          <Button
            size="sm"
            className="w-full mt-2"
            onClick={onAskQuestion}
            disabled={processingStatus === "processing"}
          >
            <MessageSquare className="h-4 w-4 mr-1" />
            Ask About Video
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="border-b">
          <button
            onClick={() => toggleSection("moments")}
            className="w-full p-3 flex items-center justify-between hover:bg-accent"
          >
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span className="font-medium text-sm">Important Moments</span>
              <span className="text-xs text-muted-foreground">({moments.length})</span>
            </div>
            {expandedSection === "moments" ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
          {expandedSection === "moments" && (
            <div className="px-3 pb-3 space-y-2">
              {momentsLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Detecting moments...</span>
                </div>
              ) : moments.length === 0 ? (
                <p className="text-sm text-muted-foreground">Click &quot;Moments&quot; to detect</p>
              ) : (
                moments.map((moment, i) => (
                  <div
                    key={i}
                    className="p-2 rounded border hover:bg-accent cursor-pointer group"
                    onClick={() => onSeek(moment.start_sec)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={cn("text-xs font-medium", getImportanceColor(moment.importance_score))}>
                          {Math.round(moment.importance_score * 100)}%
                        </span>
                        <span className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                          {formatTime(moment.start_sec)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCreateClip(moment.start_sec, moment.end_sec);
                          }}
                          className="p-1 hover:bg-primary/10 rounded"
                          title="Create clip"
                        >
                          <Scissors className="h-3 w-3" />
                        </button>
                        <Play className="h-3 w-3" />
                      </div>
                    </div>
                    <p className="text-xs mt-1 line-clamp-2">{moment.description}</p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <div className="border-b">
          <button
            onClick={() => toggleSection("highlights")}
            className="w-full p-3 flex items-center justify-between hover:bg-accent"
          >
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-yellow-500" />
              <span className="font-medium text-sm">AI Highlights</span>
              <span className="text-xs text-muted-foreground">({highlights.length})</span>
            </div>
            {expandedSection === "highlights" ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
          {expandedSection === "highlights" && (
            <div className="px-3 pb-3 space-y-2">
              {highlightsLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Generating highlights...</span>
                </div>
              ) : highlights.length === 0 ? (
                <p className="text-sm text-muted-foreground">Click &quot;Highlights&quot; to generate</p>
              ) : (
                highlights.map((highlight, i) => (
                  <div
                    key={i}
                    className="p-2 rounded border hover:bg-accent cursor-pointer group"
                    onClick={() => onSeek(highlight.start_sec)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={cn("text-xs font-medium", getImportanceColor(highlight.importance_score))}>
                          {Math.round(highlight.importance_score * 100)}%
                        </span>
                        <span className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                          {formatTime(highlight.start_sec)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCreateClip(highlight.start_sec, highlight.end_sec);
                          }}
                          className="p-1 hover:bg-primary/10 rounded"
                          title="Create clip"
                        >
                          <Scissors className="h-3 w-3" />
                        </button>
                        <Play className="h-3 w-3" />
                      </div>
                    </div>
                    <p className="text-sm font-medium mt-1">{highlight.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{highlight.summary}</p>
                    <span className="text-xs text-muted-foreground mt-1 capitalize">
                      {highlight.category.replace(/_/g, " ")}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <div className="border-b">
          <button
            onClick={() => toggleSection("topics")}
            className="w-full p-3 flex items-center justify-between hover:bg-accent"
          >
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="font-medium text-sm">Topics</span>
              <span className="text-xs text-muted-foreground">({topics.length})</span>
            </div>
            {expandedSection === "topics" ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
          {expandedSection === "topics" && (
            <div className="px-3 pb-3 space-y-2">
              {topicsLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Detecting topics...</span>
                </div>
              ) : topics.length === 0 ? (
                <p className="text-sm text-muted-foreground">Click &quot;Topics&quot; to detect</p>
              ) : (
                topics.map((topic, i) => (
                  <div
                    key={i}
                    className="p-2 rounded border hover:bg-accent cursor-pointer group"
                    onClick={() => onSeek(topic.timestamp_sec)}
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium">{topic.topic}</h4>
                      <span className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                        {formatTime(topic.timestamp_sec)}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {topic.keywords.slice(0, 3).map((keyword, idx) => (
                        <span key={idx} className="text-xs bg-secondary/50 px-2 py-0.5 rounded">
                          {keyword}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs text-muted-foreground">Relevance:</span>
                      <span className={cn("text-xs font-medium", getImportanceColor(topic.relevance_score))}>
                        {Math.round(topic.relevance_score * 100)}%
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      <div className="p-3 border-t bg-muted/50">
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div>
            <div className="font-semibold">{moments.length}</div>
            <div className="text-muted-foreground">Moments</div>
          </div>
          <div>
            <div className="font-semibold">{highlights.length}</div>
            <div className="text-muted-foreground">Highlights</div>
          </div>
          <div>
            <div className="font-semibold">{topics.length}</div>
            <div className="text-muted-foreground">Topics</div>
          </div>
        </div>
      </div>
    </div>
  );
}
