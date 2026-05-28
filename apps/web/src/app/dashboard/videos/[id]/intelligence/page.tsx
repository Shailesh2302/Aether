"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, SmartClip } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { 
  ArrowLeft, 
  Loader2, 
  Sparkles, 
  Clock, 
  Zap, 
  Lightbulb, 
  FileText, 
  Scissors,
  Play,
  CheckCircle,
  XCircle,
  RefreshCw
} from "lucide-react";

interface VideoStatus {
  file_id: string;
  status: string;
  progress: number;
  transcript_ready: boolean;
  indexed: boolean;
  moments_detected: number;
  highlights_generated: number;
}

interface VideoMoment {
  start_sec: number;
  end_sec: number;
  description: string;
  importance_score: number;
}

interface VideoHighlight {
  start_sec: number;
  end_sec: number;
  title: string;
  summary: string;
  importance_score: number;
  category: string;
}

interface VideoTopic {
  topic: string;
  timestamp_sec: number;
  keywords: string[];
  relevance_score: number;
}

interface VideoSummary {
  summary: string;
  topics: string[];
  key_themes: string[];
  duration_sec: number;
}

export default function VideoIntelligencePage() {
  const params = useParams();
  const router = useRouter();
  const fileId = params.id as string;

  const [status, setStatus] = useState<VideoStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  
  const [moments, setMoments] = useState<VideoMoment[]>([]);
  const [momentsLoading, setMomentsLoading] = useState(false);
  
  const [highlights, setHighlights] = useState<VideoHighlight[]>([]);
  const [highlightsLoading, setHighlightsLoading] = useState(false);
  
  const [topics, setTopics] = useState<VideoTopic[]>([]);
  const [topicsLoading, setTopicsLoading] = useState(false);
  
  const [summary, setSummary] = useState<VideoSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  
  const [smartClips, setSmartClips] = useState<SmartClip[]>([]);
  const [clipsLoading, setClipsLoading] = useState(false);

  const fetchStatus = async () => {
    try {
      const response = await api.get(`/video-features/status/${fileId}`);
      setStatus(response.data);
    } catch (error) {
      console.error("Failed to fetch status:", error);
    } finally {
      setStatusLoading(false);
    }
  };

  const detectMoments = async () => {
    setMomentsLoading(true);
    try {
      const response = await api.post("/video/moments", { fileId, topK: 10 });
      setMoments(response.data.moments);
      await fetchStatus();
    } catch (error) {
      console.error("Failed to detect moments:", error);
    } finally {
      setMomentsLoading(false);
    }
  };

  const generateHighlights = async () => {
    setHighlightsLoading(true);
    try {
      const response = await api.post("/video/highlights", { fileId, maxHighlights: 5 });
      setHighlights(response.data.highlights);
      await fetchStatus();
    } catch (error) {
      console.error("Failed to generate highlights:", error);
    } finally {
      setHighlightsLoading(false);
    }
  };

  const detectTopics = async () => {
    setTopicsLoading(true);
    try {
      const response = await api.get("/video/topics", { params: { fileId } });
      setTopics(response.data.topics);
    } catch (error) {
      console.error("Failed to detect topics:", error);
    } finally {
      setTopicsLoading(false);
    }
  };

  const generateSummary = async () => {
    setSummaryLoading(true);
    try {
      const response = await api.post("/video-features/summary", { fileId });
      setSummary({
        summary: response.data.summary,
        topics: response.data.topics || [],
        key_themes: response.data.key_themes || [],
        duration_sec: response.data.duration_sec || 0,
      });
    } catch (error) {
      console.error("Failed to generate summary:", error);
    } finally {
      setSummaryLoading(false);
    }
  };

  const generateSmartClips = async () => {
    setClipsLoading(true);
    try {
      const response = await api.post("/video-features/smart-clips", { fileId, maxClips: 10 });
      setSmartClips(response.data.clips);
      await fetchStatus();
    } catch (error) {
      console.error("Failed to generate smart clips:", error);
    } finally {
      setClipsLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    detectTopics();
  }, [fileId]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getStatusColor = (s: string) => {
    switch (s) {
      case "completed": return "bg-green-500";
      case "processing": return "bg-yellow-500";
      case "failed": return "bg-red-500";
      default: return "bg-gray-500";
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => router.push(`/dashboard/videos/${fileId}`)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Video Intelligence</h1>
        </div>
      </div>

      {/* Status Card */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              Processing Status
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={fetchStatus}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </CardTitle>
            {status && (
              <Badge className={getStatusColor(status.status)}>
                {status.status.toUpperCase()}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {statusLoading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading status...</span>
            </div>
          ) : status ? (
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Progress</span>
                  <span>{Math.round(status.progress * 100)}%</span>
                </div>
                <Progress value={status.progress * 100} />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  {status.transcript_ready ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-gray-400" />
                  )}
                  <span>Transcript</span>
                </div>
                <div className="flex items-center gap-2">
                  {status.indexed ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-gray-400" />
                  )}
                  <span>Indexed</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Moments: </span>
                  <span className="font-medium">{status.moments_detected}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Highlights: </span>
                  <span className="font-medium">{status.highlights_generated}</span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground">No status available</p>
          )}
        </CardContent>
      </Card>

      {/* Features Tabs */}
      <Tabs defaultValue="moments" className="w-full">
        <TabsList className="w-full grid grid-cols-5 mb-4">
          <TabsTrigger value="moments" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Moments
          </TabsTrigger>
          <TabsTrigger value="highlights" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Highlights
          </TabsTrigger>
          <TabsTrigger value="topics" className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4" />
            Topics
          </TabsTrigger>
          <TabsTrigger value="summary" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Summary
          </TabsTrigger>
          <TabsTrigger value="clips" className="flex items-center gap-2">
            <Scissors className="h-4 w-4" />
            Smart Clips
          </TabsTrigger>
        </TabsList>

        {/* Moments Tab */}
        <TabsContent value="moments">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle>Important Moments</CardTitle>
                <Button onClick={detectMoments} disabled={momentsLoading}>
                  {momentsLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                  Detect Moments
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {momentsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : moments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No moments detected yet</p>
                  <p className="text-sm">Click &quot;Detect Moments&quot; to analyze the video</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {moments.map((moment, i) => (
                    <div key={i} className="p-4 border rounded-lg hover:bg-accent cursor-pointer transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <Badge variant={moment.importance_score >= 0.8 ? "destructive" : "secondary"}>
                            {Math.round(moment.importance_score * 100)}%
                          </Badge>
                          <span className="font-mono text-sm bg-muted px-2 py-1 rounded">
                            {formatTime(moment.start_sec)} - {formatTime(moment.end_sec)}
                          </span>
                        </div>
                        <Button size="sm" variant="ghost">
                          <Play className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-sm">{moment.description}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Highlights Tab */}
        <TabsContent value="highlights">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle>AI Highlights</CardTitle>
                <Button onClick={generateHighlights} disabled={highlightsLoading}>
                  {highlightsLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />}
                  Generate Highlights
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {highlightsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : highlights.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Zap className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No highlights generated yet</p>
                  <p className="text-sm">Click &quot;Generate Highlights&quot; to analyze the video</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {highlights.map((highlight, i) => (
                    <div key={i} className="p-4 border rounded-lg hover:bg-accent cursor-pointer transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="capitalize">
                            {highlight.category.replace(/_/g, " ")}
                          </Badge>
                          <span className="font-mono text-sm bg-muted px-2 py-1 rounded">
                            {formatTime(highlight.start_sec)} - {formatTime(highlight.end_sec)}
                          </span>
                        </div>
                        <Button size="sm" variant="ghost">
                          <Play className="h-4 w-4" />
                        </Button>
                      </div>
                      <h4 className="font-medium mb-1">{highlight.title}</h4>
                      <p className="text-sm text-muted-foreground">{highlight.summary}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Topics Tab */}
        <TabsContent value="topics">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle>Detected Topics</CardTitle>
                <Button onClick={detectTopics} disabled={topicsLoading}>
                  {topicsLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Lightbulb className="h-4 w-4 mr-2" />}
                  Detect Topics
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {topicsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : topics.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Lightbulb className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No topics detected yet</p>
                  <p className="text-sm">Click &quot;Detect Topics&quot; to analyze the video</p>
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {topics.map((topic, i) => (
                    <div key={i} className="p-4 border rounded-lg hover:bg-accent cursor-pointer transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">{topic.topic}</h4>
                        <span className="font-mono text-sm bg-muted px-2 py-1 rounded">
                          {formatTime(topic.timestamp_sec)}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1 mb-2">
                        {(topic.keywords ?? []).map((keyword, j) => (
                          <Badge key={j} variant="secondary" className="text-xs">
                            {keyword}
                          </Badge>
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Relevance:</span>
                        <Progress value={topic.relevance_score * 100} className="flex-1 h-2" />
                        <span className="text-xs font-medium">{Math.round(topic.relevance_score * 100)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Summary Tab */}
        <TabsContent value="summary">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle>Video Summary</CardTitle>
                <Button onClick={generateSummary} disabled={summaryLoading}>
                  {summaryLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileText className="h-4 w-4 mr-2" />}
                  Generate Summary
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {summaryLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : !summary ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No summary generated yet</p>
                  <p className="text-sm">Click &quot;Generate Summary&quot; to analyze the video</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">Summary</h4>
                    <p className="text-sm text-muted-foreground">{summary.summary}</p>
                  </div>
                  {summary.topics.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">Topics Covered</h4>
                      <div className="flex flex-wrap gap-2">
                        {summary.topics.map((topic, i) => (
                          <Badge key={i} variant="outline">{topic}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {summary.key_themes.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">Key Themes</h4>
                      <div className="flex flex-wrap gap-2">
                        {summary.key_themes.map((theme, i) => (
                          <Badge key={i} variant="secondary">{theme}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Smart Clips Tab */}
        <TabsContent value="clips">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle>Smart Clips</CardTitle>
                <Button onClick={generateSmartClips} disabled={clipsLoading}>
                  {clipsLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Scissors className="h-4 w-4 mr-2" />}
                  Generate Clips
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {clipsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : smartClips.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Scissors className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No smart clips generated yet</p>
                  <p className="text-sm">Click &quot;Generate Clips&quot; to analyze the video</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {smartClips.map((clip, i) => (
                    <div key={i} className="p-4 border rounded-lg hover:bg-accent cursor-pointer transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="capitalize">
                            {clip.category.replace(/_/g, " ")}
                          </Badge>
                          <Badge variant={clip.importance_score >= 0.9 ? "destructive" : "secondary"}>
                            {Math.round(clip.importance_score * 100)}%
                          </Badge>
                          <span className="font-mono text-sm bg-muted px-2 py-1 rounded">
                            {formatTime(clip.start_sec)} - {formatTime(clip.end_sec)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="ghost">
                            <Play className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <h4 className="font-medium mb-1">{clip.title}</h4>
                      <p className="text-sm text-muted-foreground">{clip.description}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}