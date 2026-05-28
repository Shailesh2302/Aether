"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useUpload } from "@/hooks/useUpload";
import { ClipsList } from "@/components/clips/ClipsList";
import { ClipEditor } from "@/components/clips/ClipEditor";
import { VideoPlayer } from "@/components/video/VideoPlayer";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Scissors, Loader2 } from "lucide-react";
import { clipsApi, type Clip, type File } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

export default function ClipsPage() {
  const { uploadedFiles } = useUpload();
  const [clips, setClips] = useState<Clip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [playingClip, setPlayingClip] = useState<Clip | null>(null);

  const allFiles = Array.isArray(uploadedFiles) ? uploadedFiles : [];
  const videos = allFiles.filter((f) => f.type?.startsWith("video"));

  const fetchClips = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await clipsApi.list();
      const fetchedClips = Array.isArray(data) ? data : (data.clips ?? []);
      setClips(fetchedClips);
    } catch (error) {
      console.error("Failed to fetch clips:", error);
      toast({
        title: "Error",
        description: "Failed to load clips. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClips();
  }, [fetchClips]);

  const handleCreateClip = (file: File) => {
    setSelectedFile(file);
  };

  const handleClipSaved = async (startTime: number, endTime: number, name: string) => {
    if (!selectedFile) return;
    
    try {
      await clipsApi.create(selectedFile.id, startTime, endTime, name.trim());
      await fetchClips();
      
      toast({
        title: "Clip created",
        description: `"${name}" has been saved successfully.`,
      });
    } catch (error) {
      const newClip: Clip = {
        id: `local-${Date.now()}`,
        title: name,
        startTime,
        endTime,
        fileId: selectedFile.id,
        createdAt: new Date().toISOString(),
      };
      setClips([...clips, newClip]);
      
      toast({
        title: "Clip saved locally",
        description: `"${name}" has been saved (API unavailable).`,
      });
    }
    
    setSelectedFile(null);
  };

  const handleDeleteClip = async (clip: Clip) => {
    if (!confirm("Delete this clip?")) return;
    
    try {
      if (!clip.id.startsWith("local-")) {
        await clipsApi.delete(clip.id);
      }
      setClips(clips.filter((c) => c.id !== clip.id));
      toast({
        title: "Clip deleted",
        description: "The clip has been removed.",
      });
    } catch (error) {
      setClips(clips.filter((c) => c.id !== clip.id));
      toast({
        title: "Clip removed",
        description: "The clip has been removed (local).",
      });
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
        <Button variant="outline" onClick={fetchClips} disabled={isLoading}>
          {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          Refresh
        </Button>
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
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <ClipsList
                  clips={clips}
                  onPlay={(clip) => setPlayingClip(clip)}
                  onDelete={handleDeleteClip}
                  onDownload={(clip) => {
                    toast({
                      title: "Download",
                      description: "Download functionality coming soon.",
                    });
                  }}
                />
              )}
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={!!selectedFile} onOpenChange={() => setSelectedFile(null)}>
        <DialogContent className="max-w-2xl">
          {selectedFile && (
            <div onClick={(e) => e.stopPropagation()}>
              <ClipEditor
                file={selectedFile}
                onSave={handleClipSaved}
                onCancel={() => setSelectedFile(null)}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!playingClip} onOpenChange={() => setPlayingClip(null)}>
        <DialogContent className="max-w-4xl">
          {playingClip && (
            <div className="space-y-4">
              <h3 className="font-semibold">{playingClip.title}</h3>
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