"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useUpload } from "@/hooks/useUpload";
import { useAuth } from "@/hooks/useAuth";
import { CheckCircle, Video, Music, Image, FileIcon, X, Play } from "lucide-react";

export default function UploadPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { files, uploadedFiles, handleUpload, removeFile, deleteUploadedFile, fetchFiles, isLoading } = useUpload();
  const allFiles = Array.isArray(uploadedFiles) ? uploadedFiles : [];

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, authLoading, router]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchFiles();
    }
  }, [isAuthenticated, fetchFiles]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (fileList) {
      await handleUpload(fileList);
    }
  };

  const getFileIcon = (type?: string) => {
    if (!type) return <FileIcon className="h-5 w-5 text-gray-500" />;
    if (type?.startsWith("video")) return <Video className="h-5 w-5 text-purple-500" />;
    if (type?.startsWith("audio")) return <Music className="h-5 w-5 text-blue-500" />;
    if (type?.startsWith("image")) return <Image className="h-5 w-5 text-green-500" />;
    return <FileIcon className="h-5 w-5 text-gray-500" />;
  };

  if (authLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Upload Files</h1>
        <p className="text-muted-foreground">
          Add videos, audio, and images to your library
        </p>
      </div>

      {/* Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle>Drop files here</CardTitle>
          <CardDescription>
            or click to browse from your computer
          </CardDescription>
        </CardHeader>
        <CardContent>
          <label className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-12 flex flex-col items-center justify-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors">
            <input
              type="file"
              multiple
              accept="video/*,audio/*,image/*,.pdf,.doc,.docx"
              onChange={handleFileChange}
              className="hidden"
              disabled={isLoading}
            />
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Video className="h-6 w-6 text-primary" />
            </div>
            <p className="text-lg font-medium">Click to upload</p>
            <p className="text-sm text-muted-foreground mt-1">
              MP4, WebM, MOV, AVI, MP3, WAV, JPG, PNG (max 100MB)
            </p>
          </label>
        </CardContent>
      </Card>

      {/* Upload Progress */}
      {files.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Uploading</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {files.map((file) => (
              <div key={file.id} className="flex items-center gap-4 p-3 rounded-lg border bg-card">
                {getFileIcon(file.file?.type)}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate text-sm">{file.file.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Progress value={file.progress} className="h-1 flex-1" />
                    <span className="text-xs text-muted-foreground">{file.progress}%</span>
                  </div>
                </div>
                {file.status === "error" && (
                  <span className="text-xs text-red-500">Failed</span>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Uploaded Files */}
      <Card>
        <CardHeader>
          <CardTitle>Your Files ({allFiles.length})</CardTitle>
          <CardDescription>
            Files stored locally for demo
          </CardDescription>
        </CardHeader>
        <CardContent>
          {allFiles.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No files uploaded yet</p>
              <p className="text-sm">Upload some files to get started</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {allFiles.map((file) => (
                <div key={file.id} className="relative group rounded-lg border overflow-hidden">
                  {/* Preview */}
                  <div className="aspect-video bg-muted flex items-center justify-center">
                    {file.type?.startsWith("video") ? (
                      <video src={file.url} className="w-full h-full object-cover" />
                    ) : file.type?.startsWith("image") ? (
                      <img src={file.url} alt={file.name} className="w-full h-full object-cover" />
                    ) : (
                      getFileIcon(file.type)
                    )}
{/* Play button overlay for videos */}
                    {file.type?.startsWith("video") && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Play className="h-12 w-12 text-white" />
                      </div>
                    )}
                  </div>
                  {/* Info */}
                  <div className="p-3">
                    <p className="font-medium text-sm truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {file.size ? (file.size / 1024 / 1024).toFixed(1) + " MB" : "Unknown size"}
                    </p>
                  </div>
                  {/* Delete button */}
                  <button
                    onClick={() => deleteUploadedFile(file.id)}
                    className="absolute top-2 right-2 p-1 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Supported Formats */}
      <Card>
        <CardHeader>
          <CardTitle>Supported Formats</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="font-medium">Video</p>
              <p className="text-muted-foreground">MP4, WebM, MOV, AVI</p>
            </div>
            <div>
              <p className="font-medium">Audio</p>
              <p className="text-muted-foreground">MP3, WAV, OGG, M4A</p>
            </div>
            <div>
              <p className="font-medium">Image</p>
              <p className="text-muted-foreground">JPG, PNG, GIF, WebP</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}