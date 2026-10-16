"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  filesApi,
  chatApi,
  searchApi,
  resolveMediaUrl,
  type FileItem,
  type SearchResult,
} from "@/lib/api";
import { getFileCategory } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NotesPanel } from "@/components/notes/NotesPanel";
import { Spinner } from "@/components/ui/spinner";
import {
  ArrowLeft,
  Download,
  FileText,
  Loader2,
  MessageSquare,
  Search,
  Send,
  Music,
} from "lucide-react";

type ViewerTab = "preview" | "chat" | "find" | "notes";

interface ChatMsg {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export default function FileViewerPage() {
  const params = useParams();
  const router = useRouter();
  const fileId = params.id as string;

  const [file, setFile] = useState<FileItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<ViewerTab>("preview");

  // chat state (scoped to this file)
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [chatting, setChatting] = useState(false);

  // in-file search state
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  // text preview
  const [textContent, setTextContent] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const f = await filesApi.get(fileId);
        if (cancelled) return;
        // Videos have their own rich detail page - keep one viewer per type.
        if (f.mimeType.startsWith("video/")) {
          router.replace(`/dashboard/videos/${fileId}`);
          return;
        }
        setFile(f);
      } catch {
        if (!cancelled) setFile(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fileId, router]);

  const category = file ? getFileCategory(file.mimeType) : "document";

  useEffect(() => {
    if (!file || !file.url) return;
    if (file.mimeType.startsWith("text/") || file.mimeType === "text/csv") {
      const url = resolveMediaUrl(file.url);
      if (!url) return;
      fetch(url)
        .then((r) => (r.ok ? r.text() : Promise.reject()))
        .then((t) => setTextContent(t))
        .catch(() => setTextContent(null));
    }
  }, [file]);

  const sendChat = useCallback(async () => {
    const content = input.trim();
    if (!content || chatting || !file) return;
    setInput("");
    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: "user", content }]);
    setChatting(true);
    try {
      const res = await chatApi.send(content, [], file.id);
      setMessages((prev) => [
        ...prev,
        { id: `a-${Date.now()}`, role: "assistant", content: res.message },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: `a-${Date.now()}`, role: "assistant", content: "Sorry, I couldn't answer that. Please try again." },
      ]);
    } finally {
      setChatting(false);
    }
  }, [input, chatting, file]);

  const searchWithin = useCallback(async () => {
    const q = query.trim();
    if (!q || searching || !file) return;
    setSearching(true);
    setSearched(true);
    try {
      const results = await searchApi.search(q, file.id);
      setHits(results);
    } catch {
      setHits([]);
    } finally {
      setSearching(false);
    }
  }, [query, searching, file]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!file) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h2 className="text-xl font-semibold">File not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          It may have been deleted.
        </p>
        <Button variant="outline" className="mt-4" onClick={() => router.push("/dashboard/files")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to files
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard/files")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold">{file.originalName}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{category}</Badge>
            <Badge variant="outline">{file.status}</Badge>
            {typeof (file.metadata as Record<string, unknown> | null)?.version === "number" &&
              Number((file.metadata as Record<string, unknown>).version) > 1 && (
                <Badge variant="outline" className="font-mono">
                  v{Number((file.metadata as Record<string, unknown>).version)}
                </Badge>
              )}
          </div>
        </div>
        {file.url && (
          <Button variant="outline" size="sm" asChild>
            <a href={resolveMediaUrl(file.url)} download={file.originalName}>
              <Download className="h-4 w-4 mr-2" />
              Download
            </a>
          </Button>
        )}
        <Button variant="default" size="sm" asChild>
          <Link href={`/dashboard/chat?fileId=${file.id}`}>
            <MessageSquare className="h-4 w-4 mr-2" />
            Open in chat
          </Link>
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as ViewerTab)}>
        <TabsList className="grid w-full max-w-lg grid-cols-4">
          <TabsTrigger value="preview">Preview</TabsTrigger>
          <TabsTrigger value="chat">Chat with file</TabsTrigger>
          <TabsTrigger value="find">Search within</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="preview" className="mt-4">
          <Card>
            <CardContent className="p-4">
              {file.mimeType === "application/pdf" && file.url ? (
                <iframe
                  src={resolveMediaUrl(file.url)}
                  title={file.originalName}
                  className="h-[70vh] w-full rounded-md border"
                />
              ) : textContent !== null ? (
                <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap rounded-md bg-muted/50 p-4 text-sm">
                  {textContent}
                </pre>
              ) : file.mimeType.startsWith("audio/") && file.url ? (
                <div className="flex flex-col items-center gap-4 py-10">
                  <Music className="h-12 w-12 text-muted-foreground/50" />
                  <audio controls src={resolveMediaUrl(file.url)} className="w-full max-w-lg" />
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                  <FileText className="h-12 w-12 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">
                    No inline preview for this file type.
                  </p>
                  {file.url && (
                    <Button asChild>
                      <a href={resolveMediaUrl(file.url)} download={file.originalName}>
                        <Download className="h-4 w-4 mr-2" />
                        Download to view
                      </a>
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="chat" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Chat with this file</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="max-h-[50vh] space-y-3 overflow-y-auto">
                {messages.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Ask anything about “{file.originalName}”. Answers are grounded in this file only.
                  </p>
                )}
                {messages.map((m) => (
                  <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[80%] rounded-lg p-3 text-sm whitespace-pre-wrap ${
                        m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                      }`}
                    >
                      {m.content}
                    </div>
                  </div>
                ))}
                {chatting && (
                  <div className="flex justify-start">
                    <div className="rounded-lg bg-muted p-3">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendChat();
                    }
                  }}
                  placeholder={`Ask about ${file.originalName}…`}
                  disabled={chatting}
                />
                <Button onClick={sendChat} disabled={chatting || !input.trim()} size="icon">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="find" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Search within this file</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        searchWithin();
                      }
                    }}
                    placeholder="Search inside this file…"
                    className="pl-9"
                  />
                </div>
                <Button onClick={searchWithin} disabled={searching || !query.trim()}>
                  {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
                </Button>
              </div>
              {searched && !searching && hits.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No matches. The file may still be processing.
                </p>
              )}
              <div className="space-y-2">
                {hits.map((h) => (
                  <div key={h.id} className="rounded-md border p-3">
                    <p className="text-sm">{h.snippet || h.text?.slice(0, 280)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {Math.round(h.score * 100)}% match
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notes" className="mt-4">
          <Card>
            <CardContent className="p-4">
              <NotesPanel fileId={file.id} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
