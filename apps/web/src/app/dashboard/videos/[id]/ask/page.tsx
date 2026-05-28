"use client";

import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AskAboutVideo } from "@/components/chat/AskAboutVideo";
import { ArrowLeft, MessageSquare, ExternalLink } from "lucide-react";

export default function AskPage() {
  const params = useParams();
  const router = useRouter();
  const fileId = params.id as string;

  const handleSeek = (time: number) => {
    router.push(`/dashboard/videos/${fileId}?t=${time}`);
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-background">
      {/* Header */}
      <div className="px-6 py-4 border-b flex items-center gap-4 bg-card">
        <Button variant="ghost" size="icon" onClick={() => router.push(`/dashboard/videos/${fileId}`)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <MessageSquare className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Ask About Video</h1>
            <p className="text-xs text-muted-foreground">
              Ask questions and get AI-powered answers
            </p>
          </div>
        </div>
        <div className="ml-auto">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => router.push(`/dashboard/videos/${fileId}`)}
            className="gap-2"
          >
            <ExternalLink className="h-4 w-4" />
            Open Video
          </Button>
        </div>
      </div>

      {/* Chat */}
      <div className="flex-1 overflow-hidden bg-muted/20">
        <div className="h-full max-w-4xl mx-auto">
          <AskAboutVideo
            fileId={fileId}
            onSeek={handleSeek}
            className="h-full rounded-none border-x shadow-sm"
          />
        </div>
      </div>
    </div>
  );
}
