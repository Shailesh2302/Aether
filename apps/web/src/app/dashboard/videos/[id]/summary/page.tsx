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
  FileText, 
  Sparkles,
  Clock,
  Target,
  BookOpen,
  RefreshCw,
  Copy,
  Check
} from "lucide-react";

interface VideoSummary {
  file_id: string;
  summary: string;
  topics: string[];
  key_themes: string[];
  duration_sec: number;
}

export default function VideoSummaryPage() {
  const params = useParams();
  const router = useRouter();
  const fileId = params.id as string;

  const [summary, setSummary] = useState<VideoSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  const generateSummary = async () => {
    setGenerating(true);
    try {
      const response = await api.post("/video-features/summary", { fileId });
      setSummary({
        ...response.data,
        duration_sec: response.data.duration_sec || 0,
        topics: response.data.topics || [],
        key_themes: response.data.key_themes || [],
      });
    } catch (error) {
      console.error("Failed to generate summary:", error);
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = () => {
    if (summary) {
      navigator.clipboard.writeText(summary.summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  useEffect(() => {
    generateSummary();
  }, [fileId]);

  return (
    <div className="min-h-screen bg-background p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => router.push(`/dashboard/videos/${fileId}`)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2">
          <FileText className="h-6 w-6 text-green-500" />
          <h1 className="text-2xl font-bold">Video Summary</h1>
        </div>
        <Button variant="ghost" size="icon" onClick={generateSummary} disabled={generating}>
          <RefreshCw className={`h-5 w-5 ${generating ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Controls */}
      <div className="flex gap-4 mb-6">
        <Button onClick={generateSummary} disabled={generating} className="gap-2">
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Regenerate Summary
        </Button>
      </div>

      {/* Loading State */}
      {generating && (
        <Card className="mb-6">
          <CardContent className="py-12">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-10 w-10 animate-spin" />
              <div className="text-center">
                <h3 className="text-lg font-medium">Generating Summary...</h3>
                <p className="text-muted-foreground">Analyzing video content and creating a comprehensive summary</p>
              </div>
              <Progress value={45} className="w-80" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!generating && !summary && (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold mb-2">No Summary Available</h3>
            <p className="text-muted-foreground mb-4">
              Click &quot;Generate Summary&quot; to analyze the video and create a summary
            </p>
            <Button onClick={generateSummary}>
              <Sparkles className="h-4 w-4 mr-2" />
              Generate Summary
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Summary Content */}
      {summary && (
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Clock className="h-4 w-4" />
                  <span className="text-sm">Duration</span>
                </div>
                <div className="text-2xl font-bold">{formatDuration(summary.duration_sec)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <BookOpen className="h-4 w-4" />
                  <span className="text-sm">Topics</span>
                </div>
                <div className="text-2xl font-bold">{summary.topics.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Target className="h-4 w-4" />
                  <span className="text-sm">Key Themes</span>
                </div>
                <div className="text-2xl font-bold">{summary.key_themes.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <FileText className="h-4 w-4" />
                  <span className="text-sm">Word Count</span>
                </div>
                <div className="text-2xl font-bold">{summary.summary.split(" ").length}</div>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="summary">Summary</TabsTrigger>
              <TabsTrigger value="topics">Topics</TabsTrigger>
              <TabsTrigger value="themes">Key Themes</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Video Overview
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Summary */}
                  <div>
                    <h4 className="font-medium mb-2">Summary</h4>
                    <div className="relative">
                      <p className="text-muted-foreground leading-relaxed bg-muted p-4 rounded-lg">
                        {summary.summary || "No summary available"}
                      </p>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2"
                        onClick={copyToClipboard}
                      >
                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  {/* Quick Info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <BookOpen className="h-4 w-4" />
                        Topics Covered
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {summary.topics.length > 0 ? summary.topics.map((topic, i) => (
                          <Badge key={i} variant="outline">{topic}</Badge>
                        )) : (
                          <span className="text-muted-foreground">No topics</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <Target className="h-4 w-4" />
                        Key Themes
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {summary.key_themes.length > 0 ? summary.key_themes.map((theme, i) => (
                          <Badge key={i} variant="secondary">{theme}</Badge>
                        )) : (
                          <span className="text-muted-foreground">No themes</span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="summary">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Full Summary
                    </span>
                    <Button variant="outline" size="sm" onClick={copyToClipboard}>
                      {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                      {copied ? "Copied" : "Copy"}
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="prose max-w-none">
                    <p className="text-lg leading-relaxed whitespace-pre-wrap">
                      {summary.summary || "No summary available"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="topics">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5" />
                    Topics Covered
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {summary.topics.length > 0 ? (
                    <div className="space-y-3">
                      {summary.topics.map((topic, i) => (
                        <div key={i} className="flex items-center gap-3 p-3 border rounded-lg">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="font-medium text-primary">{i + 1}</span>
                          </div>
                          <span className="font-medium">{topic}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No topics identified
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="themes">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    Key Themes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {summary.key_themes.length > 0 ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      {summary.key_themes.map((theme, i) => (
                        <div key={i} className="flex items-center gap-3 p-4 border rounded-lg bg-secondary/20">
                          <div className="w-2 h-2 rounded-full bg-primary" />
                          <span className="font-medium">{theme}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No key themes identified
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}