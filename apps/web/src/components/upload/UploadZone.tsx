"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { cn, formatFileSize } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { CheckCircle, FileIcon, X, Upload } from "lucide-react";

interface UploadZoneProps {
  onUpload: (files: FileList) => void;
  uploading?: boolean;
  progress?: number;
  uploaded?: boolean;
}

export function UploadZone({ onUpload, uploading, progress, uploaded }: UploadZoneProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const dt = new DataTransfer();
      acceptedFiles.forEach((file) => {
        dt.items.add(file);
      });
      onUpload(dt.files);
    },
    [onUpload]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "video/*": [".mp4", ".webm", ".mov", ".avi"],
      "audio/*": [".mp3", ".wav", ".ogg", ".m4a"],
      "image/*": [".jpg", ".jpeg", ".png", ".gif", ".webp"],
    },
    disabled: uploading,
  });

  return (
    <div
      {...getRootProps()}
      className={cn(
        "relative flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-xl cursor-pointer transition-all",
        isDragActive
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/50",
        uploaded && "border-green-500 bg-green-500/5"
      )}
    >
      <input {...getInputProps()} />
      
      {uploading ? (
        <div className="flex flex-col items-center gap-4">
          <div className="relative h-12 w-12">
            <div className="absolute inset-0 flex items-center justify-center">
              <Progress value={progress} className="h-12 w-12" />
            </div>
            <span className="absolute inset-0 flex items-center justify-center text-sm font-medium">
              {progress}%
            </span>
          </div>
          <p className="text-sm text-muted-foreground">Uploading...</p>
        </div>
      ) : uploaded ? (
        <div className="flex flex-col items-center gap-2">
          <CheckCircle className="h-12 w-12 text-green-500" />
          <p className="text-sm font-medium text-green-600">Upload complete!</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <div className={cn(
            "h-16 w-16 rounded-full flex items-center justify-center transition-colors",
            isDragActive ? "bg-primary/20" : "bg-muted"
          )}>
            <Upload className={cn(
              "h-8 w-8 transition-colors",
              isDragActive ? "text-primary" : "text-muted-foreground"
            )} />
          </div>
          <div className="text-center">
            <p className="text-lg font-medium">
              {isDragActive ? "Drop your files here" : "Drag & drop files"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              or click to browse from your computer
            </p>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Supports MP4, WebM, MOV, MP3, WAV, and images
          </p>
        </div>
      )}
    </div>
  );
}