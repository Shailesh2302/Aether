"use client";

import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface SearchBarProps {
  onSearch: (query: string) => void;
  placeholder?: string;
  loading?: boolean;
}

export function SearchBar({ onSearch, placeholder = "Search...", loading }: SearchBarProps) {
  const [query, setQuery] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(query);
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="pl-9 pr-10"
        />
        {query && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-0 top-1/2 -translate-y-1/2 h-8 w-8"
            onClick={() => {
              setQuery("");
              onSearch("");
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      <Button type="submit" disabled={loading}>
        {loading ? "Searching..." : "Search"}
      </Button>
    </form>
  );
}