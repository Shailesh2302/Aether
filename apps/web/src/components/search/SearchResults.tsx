import { Search, FileText, Video, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SearchResult } from "@/lib/api";
import { formatDuration } from "@/lib/utils";

interface SearchResultsProps {
  results: SearchResult[];
  isLoading?: boolean;
  onResultClick?: (result: SearchResult) => void;
}

export function SearchResults({ results, isLoading, onResultClick }: SearchResultsProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Searching...</p>
        </div>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
          <Search className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2">No results found</h3>
        <p className="text-sm text-muted-foreground">
          Try different keywords or check your files
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {results.map((result) => (
        <div
          key={result.id}
          className="flex items-start gap-4 p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer"
          onClick={() => onResultClick?.(result)}
        >
          <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
            {result.fileName?.match(/\.(mp4|webm|mov)$/i) ? (
              <Video className="h-5 w-5 text-muted-foreground" />
            ) : (
              <FileText className="h-5 w-5 text-muted-foreground" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h4 className="font-medium truncate">{result.fileName}</h4>
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              {result.snippet}
            </p>
            <div className="flex items-center gap-3 mt-2">
              {result.timestamp !== undefined && (
                <Button variant="ghost" size="sm" className="h-6 text-xs">
                  <Play className="h-3 w-3 mr-1" />
                  {formatDuration(result.timestamp)}
                </Button>
              )}
              <span className="text-xs text-muted-foreground">
                Relevance: {Math.round(result.score * 100)}%
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}