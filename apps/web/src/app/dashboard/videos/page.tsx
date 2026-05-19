"use client";

import { useEffect, useState } from "react";
import { useUpload } from "@/hooks/useUpload";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { VideoThumbnail } from "@/components/video/VideoThumbnail";
import { VideoPlayer } from "@/components/video/VideoPlayer";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Upload, Play, Scissors } from "lucide-react";
import Link from "next/link";

export default function VideosPage() {
  const { uploadedFiles, fetchFiles, deleteFile, isLoading } = useUpload();
  const [selectedVideo, setSelectedVideo] = useState<typeof uploadedFiles[0] | null>(null);
  const [clipVideo, setClipVideo] = useState<typeof uploadedFiles[0] | null>(null);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const videos = (Array.isArray(uploadedFiles) ? uploadedFiles : []).filter((f) => f.type?.startsWith("video"));

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this video?")) {
      await deleteFile(id);
    }
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
            <VideoThumbnail
              key={video.id}
              file={video}
              onPlay={() => setSelectedVideo(video)}
              onDelete={() => handleDelete(video.id)}
              onCreateClip={() => setClipVideo(video)}
            />
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