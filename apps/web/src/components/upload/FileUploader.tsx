"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, X, File, Image, Video, Music } from "lucide-react";
import { cn, formatFileSize } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

interface UploadFile {
  id: string;
  file: File;
  progress: number;
  status: "pending" | "uploading" | "success" | "error";
  error?: string;
}

interface FileUploaderProps {
  files: UploadFile[];
  onUpload: (files: FileList) => void;
  onRemove: (id: string) => void;
  disabled?: boolean;
}

function getFileIcon(file: File) {
  if (file.type.startsWith("image/")) return Image;
  if (file.type.startsWith("video/")) return Video;
  if (file.type.startsWith("audio/")) return Music;
  return File;
}

export function FileUploader({ files, onUpload, onRemove, disabled }: FileUploaderProps) {
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
    disabled,
    multiple: true,
  });

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
          isDragActive
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-2">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
            <Upload className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium">
              {isDragActive ? "Drop files here" : "Drag & drop files here"}
            </p>
            <p className="text-xs text-muted-foreground">
              or click to browse
            </p>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Supports video, audio, and image files
          </p>
        </div>
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file) => {
            const Icon = getFileIcon(file.file);
            return (
              <div
                key={file.id}
                className="flex items-center gap-3 p-3 rounded-lg border bg-card"
              >
                <Icon className="h-8 w-8 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {file.file.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(file.file.size)}
                  </p>
                  {file.status === "uploading" && (
                    <Progress value={file.progress} className="h-1 mt-2" />
                  )}
                  {file.status === "error" && (
                    <p className="text-xs text-destructive mt-1">
                      {file.error || "Upload failed"}
                    </p>
                  )}
                </div>
                {file.status !== "uploading" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onRemove(file.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}