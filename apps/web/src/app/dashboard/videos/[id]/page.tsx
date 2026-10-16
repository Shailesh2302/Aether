"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useUpload } from "@/hooks/useUpload";
import { useVideoChat } from "@/hooks/useVideoChat";
import { useVideoIntelligence } from "@/hooks/useVideoIntelligence";
import { videoApi, type SubtitleTrack } from "@/lib/api";
import { NotesPanel } from "@/components/notes/NotesPanel";
import { ShareDialog } from "@/components/share/ShareDialog";
import { ChaptersList } from "@/components/video/ChaptersList";
import { TranslateBar } from "@/components/video/TranslateBar";
import { ExportMenu } from "@/components/video/ExportMenu";
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
  Lightbulb,
  StickyNote,
  Share2,
} from "lucide-react";

type SidebarTab = "ai" | "summary" | "ask" | "clips" | "notes";

export default function VideoDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const fileId = params.id as string;
  const seekTime = searchParams.get("t");
  const { files: uploadedFiles } = useUpload();
  
  const { currentTime, setCurrentTime } = useVideoChat();
  
  const {
    moments,
    highlights,
    topics,
    momentsLoading,
    highlightsLoading,
    topicsLoading,
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
  const [summaryTopics, setSummaryTopics] = useState<string[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [subtitles, setSubtitles] = useState<SubtitleTrack[]>([]);
  const [shareOpen, setShareOpen] = useState(false);

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
    try {
      await detectMoments(fileId, undefined, 10);
    } catch {
      // error state lives in the hook
    }
  };

  const handleGenerateHighlights = async () => {
    try {
      await generateHighlights(fileId, undefined, 5);
    } catch {
      // error state lives in the hook
    }
  };

  const handleDetectTopics = async () => {
    try {
      await detectTopics(fileId);
    } catch {
      // error state lives in the hook
    }
  };

  const handleGenerateSummary = async () => {
    setSummaryLoading(true);
    try {
      // Dedicated summary endpoint (cached server-side) - never the
      // highlights call, which used to overwrite this tab as a side effect.
      const response = await videoApi.getSummary(fileId);
      setSummary(response.summary || "");
      setSummaryTopics([
        ...(response.topics ?? []),
        ...(response.key_themes ?? []),
      ].slice(0, 8));
      setActiveSidebarTab("summary");
    } catch {
      setSummary("");
      setSummaryTopics([]);
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShareOpen(true)}
            className="gap-1 shrink-0"
          >
            <Share2 className="h-4 w-4" />
            Share
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
                subtitles={subtitles}
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
          <TabsList className="w-full grid grid-cols-5 rounded-none">
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
            <TabsTrigger value="notes" className="text-xs">
              <StickyNote className="h-4 w-4" />
            </TabsTrigger>
          </TabsList>

            <TabsContent value="ai" className="m-0 flex-1 overflow-hidden">
              <div className="flex h-full flex-col">
                <div className="min-h-0 flex-1 overflow-hidden">
                  <AIFeaturesPanel
                    fileId={fileId}
                    fileName={file.name}
                    duration={file.duration || 0}
                    moments={moments}
                    highlights={highlights}
                    topics={topics}
                    summary={summary}
                    processingStatus="idle"
                    momentsLoading={momentsLoading}
                    highlightsLoading={highlightsLoading}
                    topicsLoading={topicsLoading}
                    summaryLoading={summaryLoading}
                    onFindMoments={handleFindMoments}
                    onGenerateHighlights={handleGenerateHighlights}
                    onDetectTopics={handleDetectTopics}
                    onGenerateSummary={handleGenerateSummary}
                    onSeek={handleSeek}
                    onAskQuestion={() => setActiveSidebarTab("ask")}
                  />
                </div>
                <div className="space-y-3 border-t p-3">
                  <ChaptersList highlights={highlights} moments={moments} onSeek={handleSeek} />
                  <TranslateBar
                    fileId={fileId}
                    onSubtitles={(track) => setSubtitles(track ? [track] : [])}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="summary" className="m-0 flex-1 overflow-hidden">
              <div className="flex h-full flex-col">
                <div className="border-b p-3">
                  <ExportMenu fileId={fileId} hasSummary={summary.length > 0} />
                </div>
                <div className="flex-1 overflow-hidden">
                  <VideoSummary
                    summary={summary}
                    topics={summaryTopics}
                    duration={file.duration || 0}
                    loading={summaryLoading}
                    onRegenerate={handleGenerateSummary}
                  />
                </div>
              </div>
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

            <TabsContent value="notes" className="m-0 flex-1 overflow-hidden">
              <div className="h-full overflow-y-auto p-3">
                <NotesPanel fileId={fileId} currentTime={currentTime} onSeek={handleSeek} />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
      <ShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        fileId={fileId}
        title={file.originalName}
      />
    </div>
  );
}
