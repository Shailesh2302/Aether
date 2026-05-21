"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ArrowLeft, 
  Loader2, 
  Zap, 
  Sparkles,
  Play,
  Video,
  LayoutGrid,
  List,
  TrendingUp,
  Star
} from "lucide-react";

interface VideoHighlight {
  start_sec: number;
  end_sec: number;
  title: string;
  summary: string;
  importance_score: number;
  category: string;
}

interface HighlightsResponse {
  file_id: string;
  highlights: VideoHighlight[];
  video_summary: string;
  topics_covered: string[];
}

export default function VideoHighlightsPage() {
  const params = useParams();
  const router = useRouter();
  const fileId = params.id as string;

  const [highlights, setHighlights] = useState<VideoHighlight[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const generateHighlights = async (maxHighlights: number = 5) => {
    setGenerating(true);
    try {
      const response = await api.post("/video/highlights", { fileId, maxHighlights });
      setHighlights(response.data.highlights);
    } catch (error) {
      console.error("Failed to generate highlights:", error);
    } finally {
      setGenerating(false);
    }
  };

  const filteredHighlights = highlights.filter((h) => {
    if (categoryFilter === "all") return true;
    return h.category === categoryFilter;
  });

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
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

  const categories = [...new Set(highlights.map((h) => h.category))];
  const avgScore = highlights.length > 0 
    ? Math.round(highlights.reduce((acc, h) => acc + h.importance_score, 0) / highlights.length * 100)
    : 0;

  return (
    <div className="min-h-screen bg-background p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => router.push(`/dashboard/videos/${fileId}`)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2">
          <Zap className="h-6 w-6 text-yellow-500" />
          <h1 className="text-2xl font-bold">AI Highlights</h1>
          <Badge variant="outline">{highlights.length} highlights</Badge>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-4 mb-6">
        <Button onClick={() => generateHighlights(5)} disabled={generating} className="gap-2">
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Generate Highlights
        </Button>
        <Button variant="outline" onClick={() => generateHighlights(10)} disabled={generating}>
          More Highlights (10)
        </Button>
        <Button variant="outline" onClick={() => generateHighlights(15)} disabled={generating}>
          All Highlights (15)
        </Button>
        
        <div className="flex items-center gap-2 ml-auto">
          <Button 
            variant={viewMode === "grid" ? "default" : "ghost"} 
            size="icon"
            onClick={() => setViewMode("grid")}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button 
            variant={viewMode === "list" ? "default" : "ghost"} 
            size="icon"
            onClick={() => setViewMode("list")}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Stats */}
      {highlights.length > 0 && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{highlights.length}</div>
              <div className="text-sm text-muted-foreground">Total Highlights</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold flex items-center gap-1">
                <Star className="h-4 w-4 text-yellow-500" />
                {avgScore}%
              </div>
              <div className="text-sm text-muted-foreground">Avg Quality</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{categories.length}</div>
              <div className="text-sm text-muted-foreground">Categories</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">
                {Math.round(highlights.reduce((acc, h) => acc + (h.end_sec - h.start_sec), 0) / 60)}m
              </div>
              <div className="text-sm text-muted-foreground">Total Duration</div>
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

      {/* Loading State */}
      {generating && (
        <Card className="mb-6">
          <CardContent className="py-8">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin" />
              <div className="text-center">
                <h3 className="font-medium">Generating Highlights...</h3>
                <p className="text-sm text-muted-foreground">Analyzing video content</p>
              </div>
              <Progress value={60} className="w-64" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!generating && highlights.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Zap className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold mb-2">No Highlights Generated</h3>
            <p className="text-muted-foreground mb-4">
              Click &quot;Generate Highlights&quot; to analyze the video and extract key segments
            </p>
            <Button onClick={() => generateHighlights(5)}>
              <Sparkles className="h-4 w-4 mr-2" />
              Generate Highlights
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Highlights Grid */}
      {highlights.length > 0 && viewMode === "grid" && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredHighlights.map((highlight, i) => (
            <Card key={i} className="hover:bg-accent cursor-pointer transition-colors">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <Badge variant="outline" className="capitalize">
                    {highlight.category.replace(/_/g, " ")}
                  </Badge>
                  <div className="flex items-center gap-1">
                    <Star className="h-3 w-3 text-yellow-500" />
                    <span className="text-sm font-medium">{Math.round(highlight.importance_score * 100)}%</span>
                  </div>
                </div>
                <CardTitle className="text-base">{highlight.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3 line-clamp-3">{highlight.summary}</p>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm bg-muted px-2 py-1 rounded">
                    {formatTime(highlight.start_sec)} - {formatTime(highlight.end_sec)}
                  </span>
                  <Button size="sm" variant="ghost">
                    <Play className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Highlights List */}
      {highlights.length > 0 && viewMode === "list" && (
        <div className="space-y-3">
          {filteredHighlights.map((highlight, i) => (
            <Card key={i} className="hover:bg-accent cursor-pointer transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className={`w-1 h-16 rounded-full ${getCategoryColor(highlight.category)}`} />
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <Badge variant="outline" className="capitalize">
                        {highlight.category.replace(/_/g, " ")}
                      </Badge>
                      <span className="font-mono text-sm bg-muted px-2 py-1 rounded">
                        {formatTime(highlight.start_sec)} - {formatTime(highlight.end_sec)}
                      </span>
                      <div className="flex items-center gap-1">
                        <Star className="h-3 w-3 text-yellow-500" />
                        <span className="text-sm">{Math.round(highlight.importance_score * 100)}%</span>
                      </div>
                    </div>
                    <h4 className="font-medium mb-1">{highlight.title}</h4>
                    <p className="text-sm text-muted-foreground">{highlight.summary}</p>
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