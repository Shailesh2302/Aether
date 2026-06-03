"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { useSearch } from "@/hooks/useSearch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  Search as SearchIcon,
  FileText,
  Video,
  Music,
  Image as ImageIcon,
  Clock,
  ArrowRight,
  Lightbulb,
  Sparkles,
} from "lucide-react";
import { formatDuration, getFileCategory } from "@/lib/utils";
import type { SearchResult } from "@/lib/api";

const SUGGESTIONS = [
  "tutorial videos",
  "podcast episodes",
  "product demos",
  "team meetings",
  "design reviews",
  "customer interviews",
];

const TIPS = [
  "Use natural language — Aether understands context, not just keywords.",
  "Click a result with a timestamp to jump straight to that moment in the video.",
  "Try asking questions like 'videos about onboarding from last week'.",
  "Filter by file type or recency using keywords like 'recent' or 'image'.",
];

export default function SearchPage() {
  const { query, results, isLoading, error, search, clearResults } = useSearch();
  const [input, setInput] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    await search(input.trim());
  };

  const handleSuggestion = async (term: string) => {
    setInput(term);
    await search(term);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Search your content
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Use natural language to find anything in your library
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Try 'tutorial videos' or 'podcasts about AI'…"
            className="h-12 pl-12 pr-24 text-base"
          />
          <Button
            type="submit"
            size="sm"
            className="absolute right-2 top-1/2 -translate-y-1/2"
            disabled={isLoading || !input.trim()}
          >
            {isLoading ? <Spinner size="sm" /> : "Search"}
          </Button>
        </div>
      </form>

      {error && (
        <div
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      {query ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {isLoading
                ? "Searching…"
                : `${results.length} result${results.length === 1 ? "" : "s"} for "${query}"`}
            </p>
            <Button variant="ghost" size="sm" onClick={clearResults}>
              Clear
            </Button>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Spinner size="lg" />
            </div>
          ) : results.length === 0 ? (
            <div className="rounded-lg border bg-card py-12 text-center">
              <SearchIcon className="mx-auto h-8 w-8 text-muted-foreground/50" />
              <h3 className="mt-3 text-sm font-medium">No results</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Try different keywords or upload more files.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {results.map((result) => (
                <ResultCard key={result.id} result={result} query={query} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <div>
            <h2 className="text-sm font-medium mb-3">Try a search</h2>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((term) => (
                <button
                  key={term}
                  onClick={() => handleSuggestion(term)}
                  className="rounded-full border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                >
                  {term}
                </button>
              ))}
            </div>
          </div>

          <Card className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-medium">Search tips</h2>
            </div>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {TIPS.map((tip, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-primary shrink-0">·</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}
    </div>
  );
}

function ResultCard({
  result,
  query,
}: {
  result: SearchResult;
  query: string;
}) {
  const category = getFileCategory(result.mimeType);
  const Icon =
    category === "video"
      ? Video
      : category === "audio"
      ? Music
      : category === "image"
      ? ImageIcon
      : FileText;

  const href =
    result.timestamp !== undefined && result.fileId
      ? `/dashboard/videos/${result.fileId}?t=${result.timestamp}`
      : result.fileId
      ? `/dashboard/videos/${result.fileId}`
      : "#";

  return (
    <Link
      href={href}
      className="group flex items-start gap-3 rounded-lg border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent/30"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium">{result.fileName}</p>
          <ArrowRight className="h-3 w-3 -translate-x-1 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
        </div>
        {result.snippet && (
          <p
            className="mt-1 text-sm text-muted-foreground leading-relaxed"
            dangerouslySetInnerHTML={{ __html: highlight(result.snippet, query) }}
          />
        )}
        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
          {result.timestamp !== undefined && (
            <span className="inline-flex items-center gap-1 font-mono">
              <Clock className="h-3 w-3" />
              {formatDuration(result.timestamp)}
            </span>
          )}
          <Badge variant="secondary" className="font-normal">
            <Sparkles className="h-2.5 w-2.5" />
            {Math.round(result.score * 100)}% match
          </Badge>
        </div>
      </div>
    </Link>
  );
}

function highlight(text: string, query: string): string {
  if (!query) return escapeHtml(text);
  const escaped = escapeHtml(text);
  const term = escapeHtml(query);
  const regex = new RegExp(`(${term})`, "ig");
  return escaped.replace(regex, '<mark class="bg-primary/20 text-foreground rounded px-0.5">$1</mark>');
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
