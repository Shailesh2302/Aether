"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useUpload } from "@/hooks/useUpload";
import { ClipsList } from "@/components/clips/ClipsList";
import { ClipEditor } from "@/components/clips/ClipEditor";
import { VideoPlayer } from "@/components/video/VideoPlayer";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Upload, Scissors } from "lucide-react";
import type { Clip, File } from "@/lib/api";

export default function ClipsPage() {
  const { uploadedFiles } = useUpload();
  const [clips, setClips] = useState<Clip[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [playingClip, setPlayingClip] = useState<Clip | null>(null);

  const allFiles = Array.isArray(uploadedFiles) ? uploadedFiles : [];
  const videos = allFiles.filter((f) => f.type?.startsWith("video"));

  const handleCreateClip = (file: File) => {
    setSelectedFile(file);
  };

  const handleSaveClip = (startTime: number, endTime: number, name: string) => {
    if (!selectedFile) return;
    
    const newClip: Clip = {
      id: Date.now().toString(),
      name,
      startTime,
      endTime,
      fileId: selectedFile.id,
      createdAt: new Date().toISOString(),
    };
    
    setClips([...clips, newClip]);
    setSelectedFile(null);
  };

  const handleDeleteClip = (clip: Clip) => {
    if (confirm("Delete this clip?")) {
      setClips(clips.filter((c) => c.id !== clip.id));
    }
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Clips</h1>
          <p className="text-muted-foreground">
            Create and manage video clips
          </p>
        </div>
      </div>

      {videos.length === 0 ? (
        <div className="text-center py-12">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <Scissors className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No videos available</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Upload some videos first to create clips
          </p>
        </div>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Create New Clip</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {videos.map((video) => (
                  <div
                    key={video.id}
                    className="p-4 rounded-lg border bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                    onClick={() => handleCreateClip(video)}
                  >
                    <div className="aspect-video bg-background rounded mb-2 flex items-center justify-center">
                      <Scissors className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium truncate">{video.name}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Your Clips</CardTitle>
            </CardHeader>
            <CardContent>
              <ClipsList
                clips={clips}
                onPlay={(clip) => setPlayingClip(clip)}
                onDelete={handleDeleteClip}
                onDownload={(clip) => console.log("Download", clip)}
              />
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={!!selectedFile} onOpenChange={() => setSelectedFile(null)}>
        <DialogContent>
          {selectedFile && (
            <ClipEditor
              file={selectedFile}
              onSave={handleSaveClip}
              onCancel={() => setSelectedFile(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!playingClip} onOpenChange={() => setPlayingClip(null)}>
        <DialogContent className="max-w-4xl">
          {playingClip && (
            <div className="space-y-4">
              <h3 className="font-semibold">{playingClip.name}</h3>
              <VideoPlayer
                src={allFiles.find((f) => f.id === playingClip.fileId)?.url || ""}
                initialTime={playingClip.startTime}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}