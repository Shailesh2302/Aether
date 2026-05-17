"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useSearch } from "@/hooks/useSearch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SearchBar } from "@/components/search/SearchBar";
import { SearchResults } from "@/components/search/SearchResults";
import { Search, FileText, Video, Music, Image } from "lucide-react";

export default function SearchPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const { query, results, isLoading: searchLoading, search } = useSearch();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Semantic Search</h1>
        <p className="text-muted-foreground">
          Find content across all your files using natural language
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <SearchBar
            onSearch={search}
            placeholder="Try: 'videos about tutorials' or 'music files from last month'"
            loading={searchLoading}
          />
        </CardContent>
      </Card>

      {query && (
        <div className="text-sm text-muted-foreground">
          {results.length} results for &quot;{query}&quot;
        </div>
      )}

      {!query && (
        <div className="text-center py-12">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <Search className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Search your content</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Use natural language to find videos, audio, and images
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            {["tutorial videos", "music files", "recent uploads", "podcasts"].map((term) => (
              <button
                key={term}
                onClick={() => search(term)}
                className="px-3 py-1 rounded-full bg-muted text-sm hover:bg-muted/80 transition-colors"
              >
                {term}
              </button>
            ))}
          </div>
        </div>
      )}

      {query && <SearchResults results={results} isLoading={searchLoading} />}

      <Card>
        <CardHeader>
          <CardTitle>Search Tips</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="mt-1">•</span>
              <span>Use natural language like &quot;find videos about cooking&quot;</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1">•</span>
              <span>Search by content type: &quot;show me audio files&quot;</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1">•</span>
              <span>Find specific moments: &quot;videos with the word tutorial at 2 minutes&quot;</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1">•</span>
              <span>Filter by date: &quot;files from last week&quot;</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}