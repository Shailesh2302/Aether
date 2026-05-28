"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  ArrowLeft, 
  Loader2, 
  Clock, 
  Sparkles,
  Play,
  Video,
  Filter
} from "lucide-react";

interface VideoMoment {
  start_sec: number;
  end_sec: number;
  description: string;
  importance_score: number;
}

interface MomentsResponse {
  file_id: string;
  moments: VideoMoment[];
  total_duration_sec: number;
  transcript_segments: Array<{
    start: number;
    end: number;
    text: string;
  }>;
}

export default function VideoMomentsPage() {
  const params = useParams();
  const router = useRouter();
  const fileId = params.id as string;

  const [moments, setMoments] = useState<VideoMoment[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [filter, setFilter] = useState<"all" | "high" | "medium" | "low">("all");
  const [sortBy, setSortBy] = useState<"time" | "importance">("importance");

  const detectMoments = async (topK: number = 10) => {
    setAnalyzing(true);
    try {
      const response = await api.post("/video/moments", { fileId, topK });
      setMoments(response.data.moments);
    } catch (error) {
      console.error("Failed to detect moments:", error);
    } finally {
      setAnalyzing(false);
    }
  };

  const filteredMoments = moments.filter((m) => {
    if (filter === "all") return true;
    if (filter === "high") return m.importance_score >= 0.8;
    if (filter === "medium") return m.importance_score >= 0.5 && m.importance_score < 0.8;
    if (filter === "low") return m.importance_score < 0.5;
    return true;
  }).sort((a, b) => {
    if (sortBy === "importance") return b.importance_score - a.importance_score;
    return a.start_sec - b.start_sec;
  });

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getImportanceColor = (score: number) => {
    if (score >= 0.8) return "bg-red-500";
    if (score >= 0.6) return "bg-orange-500";
    if (score >= 0.4) return "bg-yellow-500";
    return "bg-blue-500";
  };

  const getImportanceBadge = (score: number) => {
    if (score >= 0.8) return "destructive";
    if (score >= 0.6) return "default";
    if (score >= 0.4) return "secondary";
    return "outline";
  };

  const groupedByMinute = filteredMoments.reduce((acc, moment) => {
    const minute = Math.floor(moment.start_sec / 60);
    if (!acc[minute]) acc[minute] = [];
    acc[minute].push(moment);
    return acc;
  }, {} as Record<number, VideoMoment[]>);

  return (
    <div className="min-h-screen bg-background p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => router.push(`/dashboard/videos/${fileId}`)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2">
          <Clock className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Video Moments</h1>
          <Badge variant="outline">{moments.length} moments</Badge>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-4 mb-6">
        <Button onClick={() => detectMoments(10)} disabled={analyzing} className="gap-2">
          {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Detect Moments
        </Button>
        <Button variant="outline" onClick={() => detectMoments(20)} disabled={analyzing}>
          Detect More (20)
        </Button>
        
        <div className="flex items-center gap-2 ml-auto">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select 
            className="border rounded px-2 py-1 text-sm"
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
          >
            <option value="all">All</option>
            <option value="high">High (80%+)</option>
            <option value="medium">Medium (50-80%)</option>
            <option value="low">Low (&lt;50%)</option>
          </select>
          
          <select 
            className="border rounded px-2 py-1 text-sm"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
          >
            <option value="importance">Sort by Importance</option>
            <option value="time">Sort by Time</option>
          </select>
        </div>
      </div>

      {/* Stats */}
      {moments.length > 0 && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{moments.length}</div>
              <div className="text-sm text-muted-foreground">Total Moments</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-red-500">
                {moments.filter(m => m.importance_score >= 0.8).length}
              </div>
              <div className="text-sm text-muted-foreground">High Priority</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-orange-500">
                {moments.filter(m => m.importance_score >= 0.5 && m.importance_score < 0.8).length}
              </div>
              <div className="text-sm text-muted-foreground">Medium Priority</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">
                {Math.round(moments.reduce((acc, m) => acc + m.importance_score, 0) / moments.length * 100)}%
              </div>
              <div className="text-sm text-muted-foreground">Avg Importance</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Loading State */}
      {analyzing && (
        <Card className="mb-6">
          <CardContent className="py-8">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin" />
              <div className="text-center">
                <h3 className="font-medium">Analyzing Video...</h3>
                <p className="text-sm text-muted-foreground">Detecting important moments</p>
              </div>
              <Progress value={45} className="w-64" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!analyzing && moments.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Clock className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold mb-2">No Moments Detected</h3>
            <p className="text-muted-foreground mb-4">
              Click &quot;Detect Moments&quot; to analyze the video and find important segments
            </p>
            <Button onClick={() => detectMoments(10)}>
              <Sparkles className="h-4 w-4 mr-2" />
              Detect Moments
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Moments List */}
      {moments.length > 0 && (
        <div className="space-y-6">
          {/* Timeline View */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Video className="h-5 w-5" />
                Timeline View
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative h-16 bg-muted rounded-lg overflow-hidden">
                {moments.map((moment, i) => (
                  <div
                    key={i}
                    className={`absolute h-full ${getImportanceColor(moment.importance_score)} opacity-70 hover:opacity-100 cursor-pointer transition-opacity`}
                    style={{
                      left: `${(moment.start_sec / 600) * 100}%`,
                      width: `${((moment.end_sec - moment.start_sec) / 600) * 100}%`,
                    }}
                    title={`${formatTime(moment.start_sec)} - ${formatTime(moment.end_sec)}`}
                  />
                ))}
              </div>
              <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                <span>0:00</span>
                <span>5:00</span>
                <span>10:00</span>
              </div>
            </CardContent>
          </Card>

          {/* Grouped by Minute */}
          {Object.entries(groupedByMinute).map(([minute, minsMoments]) => (
            <div key={minute}>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Badge variant="outline">Minute {minute}</Badge>
                <span className="text-sm font-normal text-muted-foreground">
                  {minsMoments.length} moment{minsMoments.length !== 1 ? "s" : ""}
                </span>
              </h3>
              <div className="space-y-3">
                {minsMoments.map((moment, i) => (
                  <Card key={i} className="hover:bg-accent cursor-pointer transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <Badge variant={getImportanceBadge(moment.importance_score)}>
                              {Math.round(moment.importance_score * 100)}%
                            </Badge>
                            <span className="font-mono text-sm bg-muted px-2 py-1 rounded">
                              {formatTime(moment.start_sec)} - {formatTime(moment.end_sec)}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              ({Math.round(moment.end_sec - moment.start_sec)}s)
                            </span>
                          </div>
                          <p className="text-sm">{moment.description}</p>
                        </div>
                        <Button size="sm" variant="ghost">
                          <Play className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}