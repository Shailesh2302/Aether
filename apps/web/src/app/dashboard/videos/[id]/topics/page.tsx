"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  ArrowLeft, 
  Loader2, 
  Lightbulb, 
  Sparkles,
  Play,
  Tag,
  Clock,
  BarChart3
} from "lucide-react";

interface VideoTopic {
  topic: string;
  timestamp_sec: number;
  keywords: string[];
  relevance_score: number;
}

interface TopicsResponse {
  file_id: string;
  topics: VideoTopic[];
  total_duration_sec: number;
  summary: string;
}

export default function VideoTopicsPage() {
  const params = useParams();
  const router = useRouter();
  const fileId = params.id as string;

  const [topics, setTopics] = useState<VideoTopic[]>([]);
  const [loading, setLoading] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [sortBy, setSortBy] = useState<"time" | "relevance">("relevance");

  const detectTopics = async () => {
    setDetecting(true);
    try {
      const response = await api.get("/video/topics", { params: { fileId } });
      setTopics(response.data.topics);
    } catch (error) {
      console.error("Failed to detect topics:", error);
    } finally {
      setDetecting(false);
    }
  };

  const sortedTopics = [...topics].sort((a, b) => {
    if (sortBy === "relevance") return b.relevance_score - a.relevance_score;
    return a.timestamp_sec - b.timestamp_sec;
  });

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getRelevanceColor = (score: number) => {
    if (score >= 0.8) return "text-green-500";
    if (score >= 0.6) return "text-yellow-500";
    return "text-gray-500";
  };

  const getAllKeywords = topics.flatMap((t) => t.keywords);
  const uniqueKeywords = [...new Set(getAllKeywords)];

  useEffect(() => {
    detectTopics();
  }, [fileId]);

  return (
    <div className="min-h-screen bg-background p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => router.push(`/dashboard/videos/${fileId}`)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2">
          <Lightbulb className="h-6 w-6 text-blue-500" />
          <h1 className="text-2xl font-bold">Video Topics</h1>
          <Badge variant="outline">{topics.length} topics</Badge>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-4 mb-6">
        <Button onClick={detectTopics} disabled={detecting} className="gap-2">
          {detecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Detect Topics
        </Button>
        
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-sm text-muted-foreground">Sort by:</span>
          <select 
            className="border rounded px-2 py-1 text-sm"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
          >
            <option value="relevance">Relevance</option>
            <option value="time">Time</option>
          </select>
        </div>
      </div>

      {/* Stats */}
      {topics.length > 0 && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{topics.length}</div>
              <div className="text-sm text-muted-foreground">Total Topics</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{uniqueKeywords.length}</div>
              <div className="text-sm text-muted-foreground">Unique Keywords</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-green-500">
                {topics.filter(t => t.relevance_score >= 0.8).length}
              </div>
              <div className="text-sm text-muted-foreground">High Relevance</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">
                {Math.round(topics.reduce((acc, t) => acc + t.relevance_score, 0) / topics.length * 100)}%
              </div>
              <div className="text-sm text-muted-foreground">Avg Relevance</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Keywords Cloud */}
      {uniqueKeywords.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Tag className="h-5 w-5" />
              All Keywords
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {uniqueKeywords.map((keyword, i) => (
                <Badge key={i} variant="secondary" className="text-sm">
                  {keyword}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {detecting && (
        <Card className="mb-6">
          <CardContent className="py-8">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin" />
              <div className="text-center">
                <h3 className="font-medium">Detecting Topics...</h3>
                <p className="text-sm text-muted-foreground">Analyzing video content and structure</p>
              </div>
              <Progress value={30} className="w-64" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!detecting && topics.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Lightbulb className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold mb-2">No Topics Detected</h3>
            <p className="text-muted-foreground mb-4">
              Click &quot;Detect Topics&quot; to analyze the video and identify key topics
            </p>
            <Button onClick={detectTopics}>
              <Sparkles className="h-4 w-4 mr-2" />
              Detect Topics
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Topics List */}
      {topics.length > 0 && (
        <div className="space-y-3">
          {sortedTopics.map((topic, i) => (
            <Card key={i} className="hover:bg-accent cursor-pointer transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="flex flex-col items-center gap-1 min-w-[60px]">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="font-mono text-sm bg-muted px-2 py-1 rounded">
                      {formatTime(topic.timestamp_sec)}
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-medium text-lg">{topic.topic}</h4>
                      <div className="flex items-center gap-1">
                        <BarChart3 className={`h-4 w-4 ${getRelevanceColor(topic.relevance_score)}`} />
                        <span className={`text-sm font-medium ${getRelevanceColor(topic.relevance_score)}`}>
                          {Math.round(topic.relevance_score * 100)}%
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {topic.keywords.map((keyword, j) => (
                        <Badge key={j} variant="outline" className="text-xs">
                          {keyword}
                        </Badge>
                      ))}
                    </div>
                    <div className="mt-2">
                      <Progress value={topic.relevance_score * 100} className="h-2" />
                    </div>
                  </div>
                  <Button size="sm" variant="ghost">
                    <Play className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}