"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { shareApi, resolveMediaUrl, type ResolvedShare } from "@/lib/api";
import { VideoPlayer } from "@/components/video/VideoPlayer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Download, Loader2, Link2Off } from "lucide-react";

export default function SharedPage() {
  const params = useParams();
  const token = params.token as string;
  const [data, setData] = useState<ResolvedShare | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    shareApi
      .resolve(token)
      .then(setData)
      .catch((e: unknown) => {
        const msg =
          (e as { response?: { data?: { error?: string } } })?.response?.data?.error ||
          "This link is invalid or has expired.";
        setError(msg);
      })
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Link href="/" className="flex items-center gap-3">
          <span className="grid h-7 w-7 place-items-center bg-lime-300 font-display text-xs font-bold text-black">
            Æ
          </span>
          <span className="font-display text-sm font-bold tracking-[0.22em]">AETHER</span>
        </Link>

        <div className="mt-8">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error || !data ? (
            <Card>
              <CardContent className="py-14 text-center">
                <Link2Off className="mx-auto h-10 w-10 text-muted-foreground/50" />
                <h1 className="mt-3 text-lg font-semibold">Link unavailable</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {error ?? "This shared link doesn't exist."}
                </p>
              </CardContent>
            </Card>
          ) : data.clip ? (
            <div className="space-y-4">
              <div>
                <h1 className="text-xl font-semibold">{data.clip.title}</h1>
                <p className="text-sm text-muted-foreground">
                  Shared clip
                  {data.clip.file ? ` from ${data.clip.file.originalName}` : ""}
                </p>
              </div>
              {data.clip.videoUrl ? (
                <VideoPlayer src={data.clip.videoUrl} className="w-full" autoPlay={false} />
              ) : (
                <p className="text-sm text-muted-foreground">This clip is still processing.</p>
              )}
            </div>
          ) : data.file ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h1 className="text-xl font-semibold">{data.file.originalName}</h1>
                  <p className="text-sm text-muted-foreground">Shared file</p>
                </div>
                {data.file.url && (
                  <Button asChild>
                    <a href={resolveMediaUrl(data.file.url)} download={data.file.originalName}>
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </a>
                  </Button>
                )}
              </div>
              {data.file.mimeType.startsWith("video/") && data.file.url ? (
                <VideoPlayer src={data.file.url} className="w-full" />
              ) : data.file.mimeType === "application/pdf" && data.file.url ? (
                <iframe
                  src={resolveMediaUrl(data.file.url)}
                  title={data.file.originalName}
                  className="h-[70vh] w-full rounded-md border"
                />
              ) : (
                <Card>
                  <CardContent className="py-12 text-center">
                    <FileText className="mx-auto h-10 w-10 text-muted-foreground/50" />
                    <p className="mt-2 text-sm text-muted-foreground">
                      Preview isn't available for this file type — download it to view.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
