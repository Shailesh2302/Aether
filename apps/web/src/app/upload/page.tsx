"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import Link from "next/link";
import { useUpload } from "@/hooks/useUpload";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, AlertCircle, FileText, Upload, X, Video, Music, Image as ImageIcon } from "lucide-react";
import { cn, formatFileSize } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

const ACCEPTED = {
  "video/*": [".mp4", ".webm", ".mov", ".avi", ".mkv", ".quicktime"],
  "audio/*": [".mp3", ".wav", ".ogg", ".m4a", ".mpeg"],
  "image/*": [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"],
  "application/pdf": [".pdf"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "application/msword": [".doc"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": [".pptx"],
};

const MAX_SIZE = 500 * 1024 * 1024;

export default function UploadPage() {
  const router = useRouter();
  const { uploadFile, uploads, clearUploads, removeUpload } = useUpload();
  const [isUploading, setIsUploading] = useState(false);

  const onDrop = useCallback(
    async (accepted: File[]) => {
      if (accepted.length === 0) return;
      if (accepted.length === 0) return;
      setIsUploading(true);
      try {
        for (const file of accepted) {
          const result = await uploadFile(file);
          if (result) {
            toast({
              title: "Upload complete",
              description: result.originalName,
            });
          }
        }
      } finally {
        setIsUploading(false);
      }
    },
    [uploadFile]
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: ACCEPTED,
    maxSize: MAX_SIZE,
    multiple: true,
    noClick: true,
    noKeyboard: true,
  });

  const completed = uploads.filter((u) => u.status === "success").length;
  const failed = uploads.filter((u) => u.status === "error").length;

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Upload files</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Add videos, audio, images, or documents to your library
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Drop files to upload</CardTitle>
          <CardDescription>
            Or click to browse — up to 500 MB per file
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            {...getRootProps()}
            className={cn(
              "flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 text-center transition-colors",
              isDragActive
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50 hover:bg-accent/30",
              isUploading && "pointer-events-none opacity-60"
            )}
          >
            <input {...getInputProps()} />
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-3">
              <Upload className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium">
              {isDragActive
                ? "Drop your files here"
                : "Drag & drop files here"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              or
            </p>
            <Button
              type="button"
              size="sm"
              className="mt-2"
              onClick={open}
              disabled={isUploading}
            >
              Browse files
            </Button>
          </div>
        </CardContent>
      </Card>

      {uploads.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Uploads</CardTitle>
              <CardDescription>
                {uploads.length} file{uploads.length === 1 ? "" : "s"} · {completed} complete
                {failed > 0 ? ` · ${failed} failed` : ""}
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={clearUploads}>
              Clear list
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {uploads.map((upload) => (
              <UploadRow
                key={upload.id}
                upload={upload}
                onRemove={() => removeUpload(upload.id)}
              />
            ))}
            {completed > 0 && (
              <div className="flex justify-end pt-2">
                <Button asChild size="sm">
                  <Link href="/dashboard/files">View library</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Supported formats</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <FormatItem icon={Video} title="Video" formats="MP4, WebM, MOV, AVI" />
            <FormatItem icon={Music} title="Audio" formats="MP3, WAV, OGG, M4A" />
            <FormatItem icon={ImageIcon} title="Images" formats="JPG, PNG, GIF, WebP" />
            <FormatItem icon={FileText} title="Documents" formats="PDF, DOCX, XLSX, PPTX" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function UploadRow({
  upload,
  onRemove,
}: {
  upload: ReturnType<typeof useUpload>["uploads"][number];
  onRemove: () => void;
}) {
  const { file, progress, status, error } = upload;
  const category = file.type?.startsWith("video/")
    ? "video"
    : file.type?.startsWith("audio/")
    ? "audio"
    : file.type?.startsWith("image/")
    ? "image"
    : "document";
  const Icon =
    category === "video" ? Video : category === "audio" ? Music : category === "image" ? ImageIcon : FileText;

  return (
    <div className="flex items-center gap-3 rounded-md border p-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-medium">{file.name}</p>
          <span className="text-xs text-muted-foreground shrink-0">
            {formatFileSize(file.size)}
          </span>
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          {status === "uploading" && (
            <>
              <Progress value={progress} className="h-1 flex-1" />
              <span className="text-xs tabular-nums text-muted-foreground w-9 text-right">
                {progress}%
              </span>
            </>
          )}
          {status === "success" && (
            <span className="flex items-center gap-1 text-xs text-success">
              <CheckCircle className="h-3 w-3" />
              Uploaded
            </span>
          )}
          {status === "error" && (
            <span className="flex items-center gap-1 text-xs text-destructive">
              <AlertCircle className="h-3 w-3" />
              {error || "Failed"}
            </span>
          )}
        </div>
      </div>
      <button
        onClick={onRemove}
        className="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
        aria-label="Remove from list"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function FormatItem({
  icon: Icon,
  title,
  formats,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  formats: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary shrink-0">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{formats}</p>
      </div>
    </div>
  );
}
