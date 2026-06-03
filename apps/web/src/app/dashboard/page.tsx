"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useUpload } from "@/hooks/useUpload";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  FileText,
  Search,
  MessageSquare,
  Video,
  ArrowRight,
  Clock,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import {
  formatDate,
  formatFileSize,
  formatRelativeTime,
  getFileCategory,
  getStatusColor,
  getStatusLabel,
} from "@/lib/utils";

export default function DashboardOverviewPage() {
  const { user } = useAuth();
  const { files, fetchFiles, isFetching } = useUpload();

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const fileList = useMemo(() => Array.isArray(files) ? files : [], [files]);

  const stats = useMemo(() => {
    const totalSize = fileList.reduce((sum, f) => {
      const size = typeof f.size === "string" ? parseInt(f.size, 10) : f.size;
      return sum + (Number.isFinite(size) ? size : 0);
    }, 0);
    const videos = fileList.filter(
      (f) => getFileCategory(f.mimeType) === "video"
    ).length;
    const audio = fileList.filter(
      (f) => getFileCategory(f.mimeType) === "audio"
    ).length;
    const images = fileList.filter(
      (f) => getFileCategory(f.mimeType) === "image"
    ).length;
    return { totalSize, videos, audio, images };
  }, [fileList]);

  const recentFiles = useMemo(
    () =>
      [...fileList]
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        .slice(0, 5),
    [fileList]
  );

  const firstName = user?.name?.split(" ")[0] || "there";

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Greeting */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome back, {firstName}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Here&apos;s what&apos;s happening with your content library.
          </p>
        </div>
        <Button asChild>
          <Link href="/upload">
            <Upload className="h-4 w-4" />
            Upload files
          </Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total files"
          value={fileList.length.toString()}
          icon={FileText}
          hint={
            stats.videos + stats.audio + stats.images > 0
              ? `${stats.videos} video · ${stats.audio} audio · ${stats.images} image`
              : "No files yet"
          }
        />
        <StatCard
          label="Storage used"
          value={formatFileSize(stats.totalSize)}
          icon={TrendingUp}
          hint="Across all uploads"
        />
        <StatCard
          label="Videos"
          value={stats.videos.toString()}
          icon={Video}
          hint="Ready to analyze"
        />
        <StatCard
          label="Library"
          value="AI-ready"
          icon={Sparkles}
          hint="Searchable index"
        />
      </div>

      {/* Quick actions */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <QuickAction
          href="/upload"
          icon={Upload}
          title="Upload files"
          description="Add video, audio, or images"
        />
        <QuickAction
          href="/search"
          icon={Search}
          title="Search"
          description="Find anything in seconds"
        />
        <QuickAction
          href="/dashboard/chat"
          icon={MessageSquare}
          title="AI chat"
          description="Ask questions about your files"
        />
        <QuickAction
          href="/dashboard/videos"
          icon={Video}
          title="Browse videos"
          description="Open a video to analyze"
        />
      </div>

      {/* Recent files */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Recent files</CardTitle>
            <CardDescription>Your most recently uploaded content</CardDescription>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/files">
              View all
              <ArrowRight className="h-3 w-3" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {isFetching && fileList.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Loading files…
            </div>
          ) : recentFiles.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="divide-y">
              {recentFiles.map((file) => {
                const category = getFileCategory(file.mimeType);
                return (
                  <Link
                    key={file.id}
                    href={
                      category === "video"
                        ? `/dashboard/videos/${file.id}`
                        : "/dashboard/files"
                    }
                    className="flex items-center gap-4 py-3 transition-colors hover:bg-accent/30 -mx-2 px-2 rounded-md"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                      {category === "video" ? (
                        <Video className="h-4 w-4" />
                      ) : (
                        <FileText className="h-4 w-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {file.originalName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(file.size)} ·{" "}
                        {formatRelativeTime(file.createdAt)}
                      </p>
                    </div>
                    <Badge variant={getStatusColor(file.status)}>
                      {getStatusLabel(file.status)}
                    </Badge>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  hint?: string;
}

function StatCard({ label, value, icon: Icon, hint }: StatCardProps) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </span>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="mt-2 text-2xl font-semibold tracking-tight">
          {value}
        </div>
        {hint && (
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        )}
      </CardContent>
    </Card>
  );
}

interface QuickActionProps {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}

function QuickAction({ href, icon: Icon, title, description }: QuickActionProps) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-2 rounded-lg border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent/30"
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">{title}</h3>
          <ArrowRight className="h-3 w-3 -translate-x-1 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
        </div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="py-10 text-center">
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Clock className="h-5 w-5" />
      </div>
      <h3 className="text-sm font-medium">No files yet</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Upload your first file to get started.
      </p>
      <Button asChild size="sm" className="mt-4">
        <Link href="/upload">
          <Upload className="h-3 w-3" />
          Upload files
        </Link>
      </Button>
    </div>
  );
}
