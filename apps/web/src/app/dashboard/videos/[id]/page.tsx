"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useUpload } from "@/hooks/useUpload";
import { useVideoChat } from "@/hooks/useVideoChat";
import { useVideoIntelligence } from "@/hooks/useVideoIntelligence";
import { VideoPlayer } from "@/components/video/VideoPlayer";
import { VideoTimeline } from "@/components/video/VideoTimeline";
import { AIFeaturesPanel } from "@/components/video/AIFeaturesPanel";
import { AskAboutVideo } from "@/components/chat/AskAboutVideo";
import { SmartClipsList } from "@/components/video/SmartClipsList";
import { VideoSummary } from "@/components/video/VideoSummary";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ArrowLeft, 
  Loader2, 
  Sparkles, 
  MessageSquare, 
  Scissors,
  FileText,
  Settings,
  Brain,
  Clock,
  Zap,
  Lightbulb
} from "lucide-react";

type SidebarTab = "ai" | "summary" | "ask" | "clips";

export default function VideoDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const fileId = params.id as string;
  const seekTime = searchParams.get("t");
  const { uploadedFiles } = useUpload();
  
  const { currentTime, setCurrentTime } = useVideoChat();
  
  const {
    moments,
    highlights,
    topics,
    loading: aiLoading,
    detectMoments,
    generateHighlights,
    detectTopics,
  } = useVideoIntelligence();

  const [playerState, setPlayerState] = useState<{
    currentTime: number;
    duration: number;
    seekTo: (time: number) => void;
  } | null>(null);
  
  const [activeSidebarTab, setActiveSidebarTab] = useState<SidebarTab>("ai");
  const [summary, setSummary] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<"idle" | "processing" | "completed" | "failed">("idle");

  const allFiles = Array.isArray(uploadedFiles) ? uploadedFiles : [];
  const file = allFiles.find((f) => f.id === fileId);

  const handlePlayerReady = useCallback((player: {
    currentTime: number;
    duration: number;
    seekTo: (time: number) => void;
  }) => {
    setPlayerState(player);
    if (seekTime) {
      const t = parseFloat(seekTime);
      if (!isNaN(t)) {
        player.seekTo(t);
        setCurrentTime(t);
      }
    }
  }, [seekTime, setCurrentTime]);

  const handleSeek = useCallback((time: number) => {
    playerState?.seekTo(time);
    setCurrentTime(time);
  }, [playerState, setCurrentTime]);

  const handleTimeUpdate = useCallback((time: number) => {
    setCurrentTime(time);
  }, [setCurrentTime]);

  const handleFindMoments = async () => {
    setProcessingStatus("processing");
    try {
      await detectMoments(fileId, undefined, 10);
    } finally {
      setProcessingStatus("idle");
    }
  };

  const handleGenerateHighlights = async () => {
    setProcessingStatus("processing");
    try {
      const response = await generateHighlights(fileId, undefined, 5);
      setSummary(response.video_summary);
    } finally {
      setProcessingStatus("idle");
    }
  };

  const handleDetectTopics = async () => {
    setProcessingStatus("processing");
    try {
      await detectTopics(fileId);
    } finally {
      setProcessingStatus("idle");
    }
  };

  const handleGenerateSummary = async () => {
    setSummaryLoading(true);
    try {
      const response = await generateHighlights(fileId, undefined, 5);
      setSummary(response.video_summary);
      setActiveSidebarTab("summary");
    } finally {
      setSummaryLoading(false);
    }
  };

  if (!file) {
    return (
      <div className="p-6 lg:p-8">
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold mb-2">Video not found</h2>
          <p className="text-muted-foreground mb-4">
            The requested video could not be found.
          </p>
          <Button variant="outline" onClick={() => router.push("/dashboard/videos")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Videos
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      {/* Header */}
      <div className="p-4 border-b flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard/videos")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold truncate">{file.name}</h1>
          <p className="text-sm text-muted-foreground">
            {file.duration ? `${Math.floor(file.duration / 60)}:${String(Math.floor(file.duration % 60)).padStart(2, '0')}` : '--:--'}
          </p>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => router.push(`/dashboard/videos/${fileId}/moments`)}
            className="gap-1 shrink-0"
          >
            <Clock className="h-4 w-4" />
            Moments
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => router.push(`/dashboard/videos/${fileId}/highlights`)}
            className="gap-1 shrink-0"
          >
            <Zap className="h-4 w-4" />
            Highlights
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => router.push(`/dashboard/videos/${fileId}/topics`)}
            className="gap-1 shrink-0"
          >
            <Lightbulb className="h-4 w-4" />
            Topics
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => router.push(`/dashboard/videos/${fileId}/summary`)}
            className="gap-1 shrink-0"
          >
            <FileText className="h-4 w-4" />
            Summary
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => router.push(`/dashboard/videos/${fileId}/ask`)}
            className="gap-1 shrink-0"
          >
            <MessageSquare className="h-4 w-4" />
            Ask
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => router.push(`/dashboard/videos/${fileId}/smart-clips`)}
            className="gap-1 shrink-0"
          >
            <Scissors className="h-4 w-4" />
            Smart Clips
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => router.push(`/dashboard/videos/${fileId}/status`)}
            className="gap-1 shrink-0"
          >
            <Clock className="h-4 w-4" />
            Status
          </Button>
          <Button 
            variant="default" 
            size="sm"
            onClick={() => router.push(`/dashboard/videos/${fileId}/intelligence`)}
            className="gap-1 shrink-0"
          >
            <Brain className="h-4 w-4" />
            All AI
          </Button>
        </div>
        <Button variant="ghost" size="icon">
          <Settings className="h-5 w-5" />
        </Button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Video Section */}
        <div className="flex-1 flex flex-col">
          {/* Video Player */}
          <div className="p-4">
            {file.url ? (
              <VideoPlayer
                src={file.url}
                initialTime={0}
                onTimeUpdate={handleTimeUpdate}
                onReady={handlePlayerReady}
                className="w-full"
              />
            ) : (
              <div className="w-full aspect-video bg-muted flex items-center justify-center rounded-lg">
                <div className="text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Loading video...</p>
                </div>
              </div>
            )}
          </div>

          {/* AI Timeline */}
          <div className="px-4 pb-4">
            <VideoTimeline
              duration={file.duration || 0}
              currentTime={currentTime}
              onSeek={handleSeek}
              moments={moments}
              highlights={highlights}
              topics={topics}
            />
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-[400px] border-l flex flex-col">
          {/* Sidebar Tabs */}
          <Tabs value={activeSidebarTab} onValueChange={(v) => setActiveSidebarTab(v as SidebarTab)}>
            <TabsList className="w-full grid grid-cols-4 rounded-none">
              <TabsTrigger value="ai" className="text-xs">
                <Sparkles className="h-4 w-4" />
              </TabsTrigger>
              <TabsTrigger value="summary" className="text-xs">
                <FileText className="h-4 w-4" />
              </TabsTrigger>
              <TabsTrigger value="ask" className="text-xs">
                <MessageSquare className="h-4 w-4" />
              </TabsTrigger>
              <TabsTrigger value="clips" className="text-xs">
                <Scissors className="h-4 w-4" />
              </TabsTrigger>
            </TabsList>

            <TabsContent value="ai" className="m-0 flex-1 overflow-hidden">
              <AIFeaturesPanel
                fileId={fileId}
                fileName={file.name}
                duration={file.duration || 0}
                moments={moments}
                highlights={highlights}
                topics={topics}
                summary={summary}
                processingStatus={processingStatus}
                momentsLoading={aiLoading}
                highlightsLoading={aiLoading}
                topicsLoading={aiLoading}
                summaryLoading={summaryLoading}
                onFindMoments={handleFindMoments}
                onGenerateHighlights={handleGenerateHighlights}
                onDetectTopics={handleDetectTopics}
                onGenerateSummary={handleGenerateSummary}
                onSeek={handleSeek}
                onAskQuestion={() => setActiveSidebarTab("ask")}
              />
            </TabsContent>

            <TabsContent value="summary" className="m-0 flex-1 overflow-hidden">
              <VideoSummary
                summary={summary}
                topics={highlights.length > 0 ? highlights.map(h => h.title).slice(0, 5) : []}
                duration={file.duration || 0}
                loading={summaryLoading}
                onRegenerate={handleGenerateSummary}
              />
            </TabsContent>

            <TabsContent value="ask" className="m-0 flex-1 overflow-hidden">
              <AskAboutVideo
                fileId={fileId}
                onSeek={handleSeek}
              />
            </TabsContent>

            <TabsContent value="clips" className="m-0 flex-1 overflow-hidden">
              <SmartClipsList
                fileId={fileId}
                onPlayClip={(clip) => {
                  handleSeek(clip.startTime);
                }}
                onSeekToTime={handleSeek}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
