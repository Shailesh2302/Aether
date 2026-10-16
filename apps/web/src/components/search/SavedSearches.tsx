"use client";

import { useCallback, useEffect, useState } from "react";
import { savedSearchApi, type SavedSearch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BellRing, Loader2, Play, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface SavedSearchesProps {
  onRun: (query: string) => void;
  compact?: boolean;
}

export function SavedSearches({ onRun, compact }: SavedSearchesProps) {
  const [items, setItems] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await savedSearchApi.list());
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const check = async (id: string) => {
    setChecking(id);
    try {
      const res = await savedSearchApi.check(id);
      setItems((prev) => prev.map((s) => (s.id === id ? res.search : s)));
      toast({
        title: res.newHits > 0 ? `${res.newHits} new result${res.newHits === 1 ? "" : "s"}` : "No new results",
      });
    } catch {
      toast({ title: "Check failed", variant: "destructive" });
    } finally {
      setChecking(null);
    }
  };

  const remove = async (id: string) => {
    try {
      await savedSearchApi.remove(id);
      setItems((prev) => prev.filter((s) => s.id !== id));
    } catch {
      toast({ title: "Couldn't remove", variant: "destructive" });
    }
  };

  if (loading) return null;
  if (items.length === 0) {
    return compact ? null : (
      <p className="text-xs text-muted-foreground">
        Tip: run a search, then hit <span className="font-medium">Track</span> to watch for new matches.
      </p>
    );
  }

  return (
    <div className={compact ? "" : "rounded-lg border bg-card p-4"}>
      {!compact && (
        <h2 className="mb-3 flex items-center gap-2 text-sm font-medium">
          <BellRing className="h-4 w-4" />
          Tracked searches
        </h2>
      )}
      <div className="space-y-2">
        {items.map((s) => (
          <div key={s.id} className="flex items-center gap-2">
            <button
              onClick={() => onRun(s.query)}
              className="min-w-0 flex-1 truncate rounded-md border px-3 py-2 text-left text-sm transition-colors hover:border-primary/40"
            >
              {s.query}
            </button>
            <Button
              size="sm"
              variant="outline"
              disabled={checking === s.id}
              onClick={() => check(s.id)}
              aria-label="Check for new results"
            >
              {checking === s.id ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => remove(s.id)}
              aria-label="Remove tracked search"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function useSaveSearch() {
  const [saving, setSaving] = useState(false);
  const save = useCallback(async (query: string) => {
    const q = query.trim();
    if (!q || saving) return;
    setSaving(true);
    try {
      await savedSearchApi.create(q);
      toast({ title: "Search tracked", description: "We'll watch for new matches." });
    } catch {
      toast({ title: "Couldn't track search", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }, [saving]);
  return { save, saving };
}

// Re-exported for pages that render the badge inline.
export function NewHitsBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return <Badge variant="default">{count} new</Badge>;
}
