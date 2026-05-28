"use client";

import { useState, useEffect, useRef } from "react";
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
  RefreshCw,
  CheckCircle,
  XCircle,
  FileText,
  Search,
  Brain,
  Zap
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

export default function VideoStatusPage() {
  const params = useParams();
  const router = useRouter();
  const fileId = params.id as string;

  const [status, setStatus] = useState<VideoStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = async () => {
    try {
      setError(null);
      const response = await api.get(`/video-features/status/${fileId}`);
      setStatus(response.data);
      return response.data;
    } catch (error) {
      console.error("Failed to fetch status:", error);
      setError("Failed to load processing status");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [fileId]);

  useEffect(() => {
    if (status && (status.status === "pending" || status.status === "processing")) {
      pollingRef.current = setInterval(async () => {
        const updated = await fetchStatus();
        if (updated && (updated.status === "completed" || updated.status === "failed")) {
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
        }
      }, 5000);
    } else {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [status?.status]);

  const getStatusColor = (s: string) => {
    switch (s) {
      case "completed": return "bg-green-500 hover:bg-green-600";
      case "processing": return "bg-yellow-500 hover:bg-yellow-600";
      case "failed": return "bg-red-500 hover:bg-red-600";
      default: return "bg-gray-500 hover:bg-gray-600";
    }
  };

  const getStatusIcon = (s: string) => {
    switch (s) {
      case "completed": return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "processing": return <Loader2 className="h-5 w-5 text-yellow-500 animate-spin" />;
      case "failed": return <XCircle className="h-5 w-5 text-red-500" />;
      default: return <Clock className="h-5 w-5 text-gray-500" />;
    }
  };

  const isActive = status && (status.status === "pending" || status.status === "processing");

  return (
    <div className="min-h-screen bg-background p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => router.push(`/dashboard/videos/${fileId}`)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2">
          <Clock className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Processing Status</h1>
          {isActive && (
            <Badge variant="outline" className="animate-pulse">
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
              Live
            </Badge>
          )}
        </div>
        <Button variant="ghost" size="icon" onClick={fetchStatus} disabled={loading}>
          <RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Loading State */}
      {loading && !status && (
        <Card className="mb-6">
          <CardContent className="py-12">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-10 w-10 animate-spin" />
              <div className="text-center">
                <h3 className="text-lg font-medium">Loading Status...</h3>
                <p className="text-muted-foreground">Fetching processing status</p>
              </div>
              <Progress value={60} className="w-80" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error State */}
      {error && !status && (
        <Card className="mb-6">
          <CardContent className="py-12 text-center">
            <XCircle className="h-16 w-16 mx-auto mb-4 text-red-500 opacity-50" />
            <h3 className="text-lg font-semibold mb-2">Failed to Load Status</h3>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={fetchStatus}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Status Card */}
      {status && (
        <div className="max-w-2xl mx-auto space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  {getStatusIcon(status.status)}
                  Processing Status
                </CardTitle>
                <Badge className={getStatusColor(status.status)}>
                  {status.status.toUpperCase()}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Progress Bar */}
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Overall Progress</span>
                  <span className="font-semibold">{Math.round(status.progress * 100)}%</span>
                </div>
                <Progress value={status.progress * 100} className="h-3" />
              </div>

              {/* Checklist */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground">Processing Steps</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className={`flex items-center gap-3 p-3 rounded-lg border ${status.transcript_ready ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800" : "bg-muted/30"}`}>
                    <div className={`p-1.5 rounded-full ${status.transcript_ready ? "bg-green-100 dark:bg-green-900/30" : "bg-gray-100 dark:bg-gray-800"}`}>
                      {status.transcript_ready ? (
                        <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                      ) : (
                        <Loader2 className="h-5 w-5 text-gray-400 animate-spin" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-sm">Transcript</p>
                      <p className="text-xs text-muted-foreground">
                        {status.transcript_ready ? "Completed" : "Processing..."}
                      </p>
                    </div>
                  </div>
                  <div className={`flex items-center gap-3 p-3 rounded-lg border ${status.indexed ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800" : "bg-muted/30"}`}>
                    <div className={`p-1.5 rounded-full ${status.indexed ? "bg-green-100 dark:bg-green-900/30" : "bg-gray-100 dark:bg-gray-800"}`}>
                      {status.indexed ? (
                        <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                      ) : (
                        <Loader2 className="h-5 w-5 text-gray-400 animate-spin" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-sm">Indexed</p>
                      <p className="text-xs text-muted-foreground">
                        {status.indexed ? "Completed" : "Processing..."}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                    <div className="p-1.5 rounded-full bg-blue-100 dark:bg-blue-900/30">
                      <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Moments Detected</p>
                      <p className="text-xs text-muted-foreground">
                        {status.moments_detected > 0 ? `${status.moments_detected} moments` : "Not yet"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                    <div className="p-1.5 rounded-full bg-purple-100 dark:bg-purple-900/30">
                      <Zap className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Highlights Generated</p>
                      <p className="text-xs text-muted-foreground">
                        {status.highlights_generated > 0 ? `${status.highlights_generated} highlights` : "Not yet"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-center gap-3 pt-2">
                <Button variant="outline" onClick={fetchStatus} disabled={loading} className="gap-2">
                  <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                  {isActive ? "Refresh" : "Refresh Status"}
                </Button>
                {status.status === "completed" && (
                  <Button variant="default" onClick={() => router.push(`/dashboard/videos/${fileId}/intelligence`)} className="gap-2">
                    <Brain className="h-4 w-4" />
                    View AI Features
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Quick Links */}
          {status.status === "completed" && (
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" className="justify-start gap-3 h-auto py-3" onClick={() => router.push(`/dashboard/videos/${fileId}/moments`)}>
                <Clock className="h-5 w-5 text-primary" />
                <div className="text-left">
                  <p className="font-medium text-sm">Moments</p>
                  <p className="text-xs text-muted-foreground">View detected moments</p>
                </div>
              </Button>
              <Button variant="outline" className="justify-start gap-3 h-auto py-3" onClick={() => router.push(`/dashboard/videos/${fileId}/highlights`)}>
                <Zap className="h-5 w-5 text-yellow-500" />
                <div className="text-left">
                  <p className="font-medium text-sm">Highlights</p>
                  <p className="text-xs text-muted-foreground">View generated highlights</p>
                </div>
              </Button>
              <Button variant="outline" className="justify-start gap-3 h-auto py-3" onClick={() => router.push(`/dashboard/videos/${fileId}/topics`)}>
                <Search className="h-5 w-5 text-blue-500" />
                <div className="text-left">
                  <p className="font-medium text-sm">Topics</p>
                  <p className="text-xs text-muted-foreground">View detected topics</p>
                </div>
              </Button>
              <Button variant="outline" className="justify-start gap-3 h-auto py-3" onClick={() => router.push(`/dashboard/videos/${fileId}/summary`)}>
                <FileText className="h-5 w-5 text-green-500" />
                <div className="text-left">
                  <p className="font-medium text-sm">Summary</p>
                  <p className="text-xs text-muted-foreground">View video summary</p>
                </div>
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
