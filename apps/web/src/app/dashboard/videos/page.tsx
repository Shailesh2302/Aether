"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUpload } from "@/hooks/useUpload";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { VideoThumbnail } from "@/components/video/VideoThumbnail";
import { VideoPlayer } from "@/components/video/VideoPlayer";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Upload,
  Play,
  Scissors,
  MessageSquare,
  MoreVertical,
  Clock,
  Zap,
  Lightbulb,
  FileText,
  Activity,
} from "lucide-react";
import Link from "next/link";

export default function VideosPage() {
  const router = useRouter();
  const { uploadedFiles, fetchFiles, deleteFile, isLoading, error } = useUpload();
  const [selectedVideo, setSelectedVideo] = useState<typeof uploadedFiles[0] | null>(null);
  const [clipVideo, setClipVideo] = useState<typeof uploadedFiles[0] | null>(null);

  useEffect(() => {
    console.log("Videos page mounted, fetching files...");
    fetchFiles();
  }, []);

  const videos = (Array.isArray(uploadedFiles) ? uploadedFiles : []).filter((f) => f.type?.startsWith("video"));

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this video?")) {
      await deleteFile(id);
    }
  };

  const handleVideoChat = (id: string) => {
    router.push(`/dashboard/videos/${id}`);
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Videos</h1>
          <p className="text-muted-foreground">
            Browse and manage your videos
          </p>
        </div>
        <Button asChild>
          <Link href="/upload">
            <Upload className="h-4 w-4 mr-2" />
            Upload Video
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading videos...</div>
      ) : error ? (
        <div className="text-center py-12">
          <div className="text-red-500 mb-4">Error: {error}</div>
          <Button onClick={() => fetchFiles()}>Retry</Button>
        </div>
      ) : videos.length === 0 ? (
        <div className="text-center py-12">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <Play className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No videos yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Upload your first video to get started
          </p>
          <Button asChild>
            <Link href="/upload">Upload Video</Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {videos.map((video) => (
            <div key={video.id} className="relative group">
              <VideoThumbnail
                file={video}
                onPlay={() => setSelectedVideo(video)}
                onDelete={() => handleDelete(video.id)}
                onCreateClip={() => setClipVideo(video)}
              />
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="secondary" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem onClick={() => setSelectedVideo(video)}>
                      <Play className="h-4 w-4 mr-2" />
                      Play
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.push(`/dashboard/videos/${video.id}/moments`)}>
                      <Clock className="h-4 w-4 mr-2" />
                      Moments
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.push(`/dashboard/videos/${video.id}/highlights`)}>
                      <Zap className="h-4 w-4 mr-2" />
                      Highlights
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.push(`/dashboard/videos/${video.id}/topics`)}>
                      <Lightbulb className="h-4 w-4 mr-2" />
                      Topics
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.push(`/dashboard/videos/${video.id}/summary`)}>
                      <FileText className="h-4 w-4 mr-2" />
                      Summary
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.push(`/dashboard/videos/${video.id}/ask`)}>
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Ask
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.push(`/dashboard/videos/${video.id}/smart-clips`)}>
                      <Scissors className="h-4 w-4 mr-2" />
                      Smart Clips
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.push(`/dashboard/videos/${video.id}/status`)}>
                      <Activity className="h-4 w-4 mr-2" />
                      Status
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.push(`/dashboard/videos/${video.id}`)}>
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Chat
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <Button
                variant="secondary"
                size="sm"
                className="absolute bottom-14 right-3 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => handleVideoChat(video.id)}
              >
                <MessageSquare className="h-3 w-3 mr-1" />
                Chat
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!selectedVideo} onOpenChange={() => setSelectedVideo(null)}>
        <DialogContent className="max-w-4xl">
          {selectedVideo && (
            <VideoPlayer
              src={selectedVideo.url}
              initialTime={0}
              onTimeUpdate={(time) => console.log(time)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}