"use client";

import { useState, useCallback, useEffect } from "react";
import { useVideoIntelligence } from "@/hooks/useVideoIntelligence";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Spinner } from "@/components/ui/spinner";
import {
  Play,
  Sparkles,
  MessageSquare,
  Clock,
  Zap,
  Lightbulb,
  Search,
  X,
} from "lucide-react";

interface VideoIntelligencePanelProps {
  fileId: string;
  duration: number;
  onSeek: (time: number) => void;
}

export function VideoIntelligencePanel({ fileId, duration, onSeek }: VideoIntelligencePanelProps) {
  const [query, setQuery] = useState("");
  const [topK, setTopK] = useState(5);
  const [videoSummary, setVideoSummary] = useState("");
  const [topicsCovered, setTopicsCovered] = useState<string[]>([]);
  
  const {
    moments,
    highlights,
    topics,
    loading,
    error,
    detectMoments,
    generateHighlights,
    detectTopics,
    clearResults,
  } = useVideoIntelligence();

  const handleDetectMoments = useCallback(async () => {
    try {
      const response = await detectMoments(fileId, query || undefined, topK);
      if (response.transcript_segments?.length) {
        return response;
      }
    } catch (err) {
      console.error("Failed to detect moments:", err);
    }
  }, [fileId, query, topK, detectMoments]);

  const handleGenerateHighlights = useCallback(async () => {
    try {
      const response = await generateHighlights(fileId, undefined, 5);
      setVideoSummary(response.video_summary);
      setTopicsCovered(response.topics_covered || []);
    } catch (err) {
      console.error("Failed to generate highlights:", err);
    }
  }, [fileId, generateHighlights]);

  const handleDetectTopics = useCallback(async () => {
    try {
      await detectTopics(fileId);
    } catch (err) {
      console.error("Failed to detect topics:", err);
    }
  }, [fileId, detectTopics]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleMomentClick = (startSec: number) => {
    onSeek(startSec);
  };

  const handleHighlightClick = (startSec: number) => {
    onSeek(startSec);
  };

  const getImportanceColor = (score: number) => {
    if (score >= 0.8) return "text-red-500";
    if (score >= 0.6) return "text-orange-500";
    if (score >= 0.4) return "text-yellow-500";
    return "text-blue-500";
  };

  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case "explanation":
        return <Lightbulb className="h-4 w-4" />;
      case "key_insight":
        return <Zap className="h-4 w-4" />;
      case "important_moment":
        return <Sparkles className="h-4 w-4" />;
      case "discussion":
        return <MessageSquare className="h-4 w-4" />;
      case "action":
        return <Play className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b space-y-3">
        <h3 className="font-semibold flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          Video Intelligence
        </h3>
        
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleDetectMoments}
            disabled={loading}
            className="flex-1"
          >
            {loading ? <Spinner size="sm" /> : <Clock className="h-4 w-4 mr-1" />}
            Find Moments
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleGenerateHighlights}
            disabled={loading}
            className="flex-1"
          >
            {loading ? <Spinner size="sm" /> : <Zap className="h-4 w-4 mr-1" />}
            Highlights
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleDetectTopics}
            disabled={loading}
            className="flex-1"
          >
            {loading ? <Spinner size="sm" /> : <Lightbulb className="h-4 w-4 mr-1" />}
            Topics
          </Button>
        </div>

        {error && (
          <div className="text-sm text-red-500 bg-red-50 p-2 rounded">
            {error}
          </div>
        )}
      </div>

      <Tabs defaultValue="moments" className="flex-1 flex flex-col min-h-0">
        <TabsList className="w-full grid grid-cols-3 rounded-none border-b">
          <TabsTrigger value="moments" className="text-xs">
            Moments ({moments.length})
          </TabsTrigger>
          <TabsTrigger value="highlights" className="text-xs">
            Highlights ({highlights.length})
          </TabsTrigger>
          <TabsTrigger value="topics" className="text-xs">
            Topics ({topics.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="moments" className="flex-1 overflow-y-auto p-3 space-y-2">
          {moments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Click &quot;Find Moments&quot; to detect important moments</p>
            </div>
          ) : (
            moments.map((moment, index) => (
              <button
                key={index}
                onClick={() => handleMomentClick(moment.start_sec)}
                className="w-full text-left p-3 rounded-lg border hover:bg-accent transition-colors group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium ${getImportanceColor(moment.importance_score)}`}>
                      {Math.round(moment.importance_score * 100)}%
                    </span>
                    <span className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                      {formatTime(moment.start_sec)}
                    </span>
                  </div>
                  <Play className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="text-sm mt-1 line-clamp-2">{moment.description}</p>
              </button>
            ))
          )}
        </TabsContent>

        <TabsContent value="highlights" className="flex-1 overflow-y-auto p-3 space-y-2">
          {highlights.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Zap className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Click &quot;Highlights&quot; to generate video highlights</p>
            </div>
          ) : (
            <>
              {videoSummary && (
                <div className="p-3 bg-muted/50 rounded-lg mb-3">
                  <p className="text-sm font-medium mb-1">Video Summary</p>
                  <p className="text-xs text-muted-foreground">{videoSummary}</p>
                </div>
              )}
              {topicsCovered.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {topicsCovered.map((topic, index) => (
                    <span key={index} className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                      {topic}
                    </span>
                  ))}
                </div>
              )}
              {highlights.map((highlight, index) => (
                <button
                  key={index}
                  onClick={() => handleHighlightClick(highlight.start_sec)}
                  className="w-full text-left p-3 rounded-lg border hover:bg-accent transition-colors group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {getCategoryIcon(highlight.category)}
                      <span className={`text-xs font-medium ${getImportanceColor(highlight.importance_score)}`}>
                        {Math.round(highlight.importance_score * 100)}%
                      </span>
                      <span className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                        {formatTime(highlight.start_sec)}
                      </span>
                    </div>
                    <Play className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <p className="text-sm font-medium mt-1">{highlight.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{highlight.summary}</p>
                  <span className="text-xs text-muted-foreground mt-1 inline-block capitalize">
                    {highlight.category.replace(/_/g, " ")}
                  </span>
                </button>
              ))}
            </>
          )}
        </TabsContent>

        <TabsContent value="topics" className="flex-1 overflow-y-auto p-3 space-y-2">
          {topics.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Lightbulb className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Click &quot;Topics&quot; to detect video topics</p>
            </div>
          ) : (
            <>
              <div className="text-xs text-muted-foreground mb-2">
                {topics.length} topics detected
              </div>
              {topics.map((topic, index) => (
                <div key={index} className="p-3 rounded-lg border">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium">{topic.topic}</h4>
                    <span className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                      {formatTime(topic.timestamp_sec)}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {topic.keywords.map((keyword, idx) => (
                      <span key={idx} className="text-xs bg-secondary/50 px-2 py-0.5 rounded">
                        {keyword}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-muted-foreground">Relevance:</span>
                    <span className={`text-xs font-medium ${getImportanceColor(topic.relevance_score)}`}>
                      {Math.round(topic.relevance_score * 100)}%
                    </span>
                  </div>
                </div>
              ))}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}