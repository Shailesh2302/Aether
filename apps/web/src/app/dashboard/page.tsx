"use client";

import { useEffect } from "react";
import { useUpload } from "@/hooks/useUpload";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileUp, FileText, MessageSquare, Search, TrendingUp, Clock } from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";

export default function DashboardPage() {
  const { user } = useAuth();
  const { uploadedFiles, fetchFiles, isLoading } = useUpload();

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const recentFiles = uploadedFiles.slice(0, 5);
  const totalSize = uploadedFiles.reduce((acc, file) => acc + file.size, 0);

  return (
    <div className="p-6 lg:p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Welcome back, {user?.name || "User"}</h1>
        <p className="text-muted-foreground mt-2">
          Here&apos;s what&apos;s happening with your content
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Files</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{uploadedFiles.length}</div>
            <p className="text-xs text-muted-foreground">
              {uploadedFiles.filter(f => f.type.startsWith("video")).length} videos, {uploadedFiles.filter(f => f.type.startsWith("audio")).length} audio
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Storage Used</CardTitle>
            <FileUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(totalSize / 1024 / 1024).toFixed(1)} MB
            </div>
            <p className="text-xs text-muted-foreground">
              Total storage used
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{recentFiles.length}</div>
            <p className="text-xs text-muted-foreground">
              Files uploaded recently
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Searches</CardTitle>
            <Search className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">--</div>
            <p className="text-xs text-muted-foreground">
              No recent searches
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="hover:border-primary/50 transition-colors cursor-pointer">
          <Link href="/upload">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileUp className="h-5 w-5 text-primary" />
                Upload Files
              </CardTitle>
              <CardDescription>Add new videos, audio, or images</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Drag and drop or browse to upload your files
              </p>
            </CardContent>
          </Link>
        </Card>

        <Card className="hover:border-primary/50 transition-colors cursor-pointer">
          <Link href="/search">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5 text-primary" />
                Semantic Search
              </CardTitle>
              <CardDescription>Find content using AI</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Search across all your files with natural language
              </p>
            </CardContent>
          </Link>
        </Card>

        <Card className="hover:border-primary/50 transition-colors cursor-pointer">
          <Link href="/dashboard/chat">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                AI Assistant
              </CardTitle>
              <CardDescription>Chat with your files</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Ask questions about your content
              </p>
            </CardContent>
          </Link>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Files</CardTitle>
          <CardDescription>Your most recently uploaded files</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : recentFiles.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No files yet</p>
              <Link href="/upload" className="text-primary hover:underline text-sm">
                Upload your first file
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {recentFiles.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div>
                    <p className="font-medium text-sm">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(file.createdAt)}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground capitalize">
                    {file.type.split("/")[1]}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}