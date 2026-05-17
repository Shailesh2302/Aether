"use client";

import { useEffect, useState } from "react";
import { useUpload } from "@/hooks/useUpload";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VideoThumbnail } from "@/components/video/VideoThumbnail";
import { Search, FileIcon, Image, Music, Video, Upload, Grid, List } from "lucide-react";
import Link from "next/link";
import { formatFileSize, formatDate } from "@/lib/utils";

export default function FilesPage() {
  const { uploadedFiles, fetchFiles, deleteFile, isLoading } = useUpload();
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [filter, setFilter] = useState<"all" | "video" | "audio" | "image">("all");

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const filteredFiles = uploadedFiles.filter((file) => {
    const matchesSearch = file.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filter === "all" || file.type.startsWith(filter);
    return matchesSearch && matchesFilter;
  });

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this file?")) {
      await deleteFile(id);
    }
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Files</h1>
          <p className="text-muted-foreground">
            Manage all your uploaded files
          </p>
        </div>
        <Button asChild>
          <Link href="/upload">
            <Upload className="h-4 w-4 mr-2" />
            Upload Files
          </Link>
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex gap-2">
          <div className="flex rounded-lg border bg-muted p-1">
            <Button
              variant={filter === "all" ? "default" : "ghost"}
              size="sm"
              onClick={() => setFilter("all")}
            >
              All
            </Button>
            <Button
              variant={filter === "video" ? "default" : "ghost"}
              size="sm"
              onClick={() => setFilter("video")}
            >
              <Video className="h-4 w-4" />
            </Button>
            <Button
              variant={filter === "audio" ? "default" : "ghost"}
              size="sm"
              onClick={() => setFilter("audio")}
            >
              <Music className="h-4 w-4" />
            </Button>
            <Button
              variant={filter === "image" ? "default" : "ghost"}
              size="sm"
              onClick={() => setFilter("image")}
            >
              <Image className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex rounded-lg border bg-muted p-1">
            <Button
              variant={viewMode === "grid" ? "default" : "ghost"}
              size="icon"
              onClick={() => setViewMode("grid")}
            >
              <Grid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="icon"
              onClick={() => setViewMode("list")}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading files...</div>
      ) : filteredFiles.length === 0 ? (
        <div className="text-center py-12">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <FileIcon className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No files found</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {searchQuery ? "Try a different search term" : "Upload your first file to get started"}
          </p>
          {!searchQuery && (
            <Button asChild>
              <Link href="/upload">Upload Files</Link>
            </Button>
          )}
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredFiles.map((file) => (
            <VideoThumbnail
              key={file.id}
              file={file}
              onDelete={() => handleDelete(file.id)}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredFiles.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-4 p-4 rounded-lg border bg-card"
            >
              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                {file.type.startsWith("video") && <Video className="h-5 w-5 text-muted-foreground" />}
                {file.type.startsWith("audio") && <Music className="h-5 w-5 text-muted-foreground" />}
                {file.type.startsWith("image") && <Image className="h-5 w-5 text-muted-foreground" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{file.name}</p>
                <p className="text-sm text-muted-foreground">
                  {formatFileSize(file.size)} • {formatDate(file.createdAt)}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => handleDelete(file.id)}>
                <span className="text-destructive">Delete</span>
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}