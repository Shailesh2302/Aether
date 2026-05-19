import { create } from "zustand";
import { searchApi, type SearchResult } from "@/lib/api";

interface SearchState {
  query: string;
  results: SearchResult[];
  isLoading: boolean;
  error: string | null;
  search: (query: string) => Promise<void>;
  setQuery: (query: string) => void;
  clearResults: () => void;
}

export const useSearchStore = create<SearchState>((set) => ({
  query: "",
  results: [],
  isLoading: false,
  error: null,

  search: async (query: string) => {
    if (!query.trim()) {
      set({ results: [], query: "" });
      return;
    }

    set({ isLoading: true, error: null, query });

    try {
      const data = await searchApi.search(query);
      const results = Array.isArray(data) ? data : (data.results ?? []);
      set({ results, isLoading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || "Search failed",
        isLoading: false,
      });
    }
  },

  setQuery: (query: string) => set({ query }),

  clearResults: () => set({ results: [], query: "" }),
}));