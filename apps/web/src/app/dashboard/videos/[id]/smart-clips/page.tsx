"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, SmartClip } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  ArrowLeft, 
  Loader2, 
  Scissors, 
  Sparkles,
  Clock,
  Play,
  RefreshCw,
  Star,
  AlertCircle
} from "lucide-react";

export default function SmartClipsPage() {
  const params = useParams();
  const router = useRouter();
  const fileId = params.id as string;

  const [clips, setClips] = useState<SmartClip[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const generateSmartClips = useCallback(async () => {
    setGenerating(true);
    setError(null);
    try {
      const response = await api.post("/video-features/smart-clips", { fileId, maxClips: 10 });
      setClips(response.data.clips || []);
    } catch (error: any) {
      const msg = error?.response?.data?.error || error?.message || "Failed to generate smart clips";
      setError(msg);
      console.error("Failed to generate smart clips:", error);
    } finally {
      setGenerating(false);
      setLoading(false);
    }
  }, [fileId]);

  useEffect(() => {
    generateSmartClips();
  }, [generateSmartClips]);

  const categories = [...new Set(clips.map((c) => c.category))];

  const filteredClips = categoryFilter === "all"
    ? clips
    : clips.filter((c) => c.category === categoryFilter);

  const averageDuration = clips.length > 0
    ? Math.round(clips.reduce((acc, c) => acc + (c.end_sec - c.start_sec), 0) / clips.length)
    : 0;

  const totalDuration = clips.reduce((acc, c) => acc + (c.end_sec - c.start_sec), 0);

  const avgScore = clips.length > 0
    ? Math.round(clips.reduce((acc, c) => acc + c.importance_score, 0) / clips.length * 100)
    : 0;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      introduction: "bg-blue-500",
      explanation: "bg-green-500",
      example: "bg-purple-500",
      demonstration: "bg-orange-500",
      summary: "bg-yellow-500",
      question: "bg-pink-500",
      key_point: "bg-red-500",
      conclusion: "bg-cyan-500",
    };
    return colors[category] || "bg-gray-500";
  };

  return (
    <div className="min-h-screen bg-background p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => router.push(`/dashboard/videos/${fileId}`)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2">
          <Scissors className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Smart Clips</h1>
          <Badge variant="outline">{clips.length} clips</Badge>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={generateSmartClips} disabled={generating}>
            <RefreshCw className={`h-5 w-5 ${generating ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-4 mb-6">
        <Button onClick={generateSmartClips} disabled={generating} className="gap-2">
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Regenerate Clips
        </Button>
      </div>

      {/* Generating State */}
      {generating && (
        <Card className="mb-6">
          <CardContent className="py-12">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-10 w-10 animate-spin" />
              <div className="text-center">
                <h3 className="text-lg font-medium">Generating Smart Clips...</h3>
                <p className="text-muted-foreground">Analyzing video and extracting key segments</p>
              </div>
              <Progress value={45} className="w-80" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error State */}
      {error && !generating && (
        <Card className="mb-6 border-red-200 dark:border-red-900">
          <CardContent className="py-8 text-center">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
            <h3 className="text-lg font-semibold mb-2">Failed to Generate Clips</h3>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={generateSmartClips} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!generating && !error && clips.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Scissors className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold mb-2">No Smart Clips Generated</h3>
            <p className="text-muted-foreground mb-4">
              Click &quot;Regenerate Clips&quot; to analyze the video and extract key segments
            </p>
            <Button onClick={generateSmartClips}>
              <Sparkles className="h-4 w-4 mr-2" />
              Generate Smart Clips
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      {clips.length > 0 && !error && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{clips.length}</div>
              <div className="text-sm text-muted-foreground">Total Clips</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{formatDuration(averageDuration)}</div>
              <div className="text-sm text-muted-foreground">Avg Duration</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{formatDuration(totalDuration)}</div>
              <div className="text-sm text-muted-foreground">Total Duration</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold flex items-center gap-1">
                <Star className="h-4 w-4 text-yellow-500" />
                {avgScore}%
              </div>
              <div className="text-sm text-muted-foreground">Avg Importance</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Category Filter */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          <Button
            variant={categoryFilter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setCategoryFilter("all")}
          >
            All
          </Button>
          {categories.map((cat) => (
            <Button
              key={cat}
              variant={categoryFilter === cat ? "default" : "outline"}
              size="sm"
              onClick={() => setCategoryFilter(cat)}
              className="capitalize"
            >
              {cat.replace(/_/g, " ")}
            </Button>
          ))}
        </div>
      )}

      {/* Clips List */}
      {filteredClips.length > 0 && !error && (
        <div className="space-y-3">
          {filteredClips.map((clip, i) => (
            <Card key={i} className="hover:bg-accent cursor-pointer transition-colors"
              onClick={() => router.push(`/dashboard/videos/${fileId}?t=${clip.start_sec}`)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className={`w-1 h-full min-h-[4rem] rounded-full ${getCategoryColor(clip.category)}`} />
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Badge variant="outline" className="capitalize">
                        {clip.category.replace(/_/g, " ")}
                      </Badge>
                      <Badge variant={clip.importance_score >= 0.8 ? "destructive" : "secondary"}>
                        {Math.round(clip.importance_score * 100)}%
                      </Badge>
                      <span className="font-mono text-sm bg-muted px-2 py-1 rounded">
                        {formatTime(clip.start_sec)} - {formatTime(clip.end_sec)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        ({Math.round(clip.end_sec - clip.start_sec)}s)
                      </span>
                    </div>
                    <h4 className="font-medium mb-1">{clip.title}</h4>
                    <p className="text-sm text-muted-foreground">{clip.description}</p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/dashboard/videos/${fileId}?t=${clip.start_sec}`);
                  }}>
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
