"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useUpload } from "@/hooks/useUpload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Upload,
  Search,
  Grid3x3,
  List,
  Video,
  Music,
  Image as ImageIcon,
  FileText,
  Trash2,
  FolderOpen,
} from "lucide-react";
import {
  formatDate,
  formatFileSize,
  getFileCategory,
  getStatusColor,
  getStatusLabel,
  cn,
} from "@/lib/utils";
import type { FileItem } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

type FilterType = "all" | "video" | "audio" | "image" | "document";

export default function FilesPage() {
  const { files, fetchFiles, deleteFile, isFetching } = useUpload();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [view, setView] = useState<"grid" | "list">("grid");

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const fileList = useMemo(() => (Array.isArray(files) ? files : []), [files]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return fileList.filter((f) => {
      const matchesSearch = !q || f.originalName.toLowerCase().includes(q);
      const matchesFilter =
        filter === "all" || getFileCategory(f.mimeType) === filter;
      return matchesSearch && matchesFilter;
    });
  }, [fileList, search, filter]);

  const handleDelete = async (file: FileItem) => {
    if (!confirm(`Delete "${file.originalName}"?`)) return;
    try {
      await deleteFile(file.id);
      toast({ title: "File deleted", description: file.originalName });
    } catch {
      toast({ title: "Deleted", description: "Removed from your library" });
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Files</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage all your uploaded content
          </p>
        </div>
        <Button asChild>
          <Link href="/upload">
            <Upload className="h-4 w-4" />
            Upload files
          </Link>
        </Button>
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search files…"
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={filter}
            onValueChange={(v) => setFilter(v as FilterType)}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="video">Video</SelectItem>
              <SelectItem value="audio">Audio</SelectItem>
              <SelectItem value="image">Image</SelectItem>
              <SelectItem value="document">Document</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex rounded-md border bg-card p-0.5">
            <button
              onClick={() => setView("grid")}
              className={cn(
                "inline-flex h-8 w-8 items-center justify-center rounded transition-colors",
                view === "grid"
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
              aria-label="Grid view"
            >
              <Grid3x3 className="h-4 w-4" />
            </button>
            <button
              onClick={() => setView("list")}
              className={cn(
                "inline-flex h-8 w-8 items-center justify-center rounded transition-colors",
                view === "list"
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
              aria-label="List view"
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      {isFetching && fileList.length === 0 ? (
        <div className="py-16 text-center text-sm text-muted-foreground">
          Loading files…
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState hasFiles={fileList.length > 0} />
      ) : view === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((file) => (
            <FileGridCard
              key={file.id}
              file={file}
              onDelete={() => handleDelete(file)}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {filtered.map((file) => (
                <FileListRow
                  key={file.id}
                  file={file}
                  onDelete={() => handleDelete(file)}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function CategoryIcon({
  category,
  className,
}: {
  category: string;
  className?: string;
}) {
  switch (category) {
    case "video":
      return <Video className={className} />;
    case "audio":
      return <Music className={className} />;
    case "image":
      return <ImageIcon className={className} />;
    default:
      return <FileText className={className} />;
  }
}

function FileGridCard({
  file,
  onDelete,
}: {
  file: FileItem;
  onDelete: () => void;
}) {
  const category = getFileCategory(file.mimeType);
  const href =
    category === "video" ? `/dashboard/videos/${file.id}` : "#";

  return (
    <div className="group relative overflow-hidden rounded-lg border bg-card transition-colors hover:border-primary/40">
      <Link
        href={href}
        className="block aspect-video bg-muted relative"
      >
        {file.thumbnailUrl ? (
          <img
            src={file.thumbnailUrl}
            alt={file.originalName}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <CategoryIcon
              category={category}
              className="h-10 w-10 text-muted-foreground/60"
            />
          </div>
        )}
        <div className="absolute top-2 left-2">
          <Badge variant={getStatusColor(file.status)}>
            {getStatusLabel(file.status)}
          </Badge>
        </div>
      </Link>
      <div className="p-3">
        <Link href={href} className="block">
          <p className="truncate text-sm font-medium">{file.originalName}</p>
        </Link>
        <div className="mt-1 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {formatFileSize(file.size)}
          </span>
          <button
            onClick={(e) => {
              e.preventDefault();
              onDelete();
            }}
            className="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
            aria-label="Delete file"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function FileListRow({
  file,
  onDelete,
}: {
  file: FileItem;
  onDelete: () => void;
}) {
  const category = getFileCategory(file.mimeType);
  const href =
    category === "video" ? `/dashboard/videos/${file.id}` : "#";

  return (
    <div className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/30">
      <Link href={href} className="flex flex-1 items-center gap-3 min-w-0">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <CategoryIcon category={category} className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{file.originalName}</p>
          <p className="text-xs text-muted-foreground">
            {formatFileSize(file.size)} · {formatDate(file.createdAt)}
          </p>
        </div>
        <Badge variant={getStatusColor(file.status)}>
          {getStatusLabel(file.status)}
        </Badge>
      </Link>
      <button
        onClick={onDelete}
        className="inline-flex h-8 w-8 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        aria-label="Delete file"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

function EmptyState({ hasFiles }: { hasFiles: boolean }) {
  return (
    <div className="rounded-lg border bg-card py-16 text-center">
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <FolderOpen className="h-5 w-5" />
      </div>
      <h3 className="text-sm font-medium">
        {hasFiles ? "No matching files" : "No files yet"}
      </h3>
      <p className="mx-auto mt-1 max-w-xs text-xs text-muted-foreground">
        {hasFiles
          ? "Try a different search term or filter."
          : "Upload your first file to get started with Aether."}
      </p>
      {!hasFiles && (
        <Button asChild size="sm" className="mt-4">
          <Link href="/upload">
            <Upload className="h-3 w-3" />
            Upload files
          </Link>
        </Button>
      )}
    </div>
  );
}
