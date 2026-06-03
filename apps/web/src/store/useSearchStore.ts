import { create } from "zustand";
import { searchApi, type SearchResult, extractErrorMessage } from "@/lib/api";

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

  search: async (query) => {
    if (!query.trim()) {
      set({ results: [], query: "" });
      return;
    }
    set({ isLoading: true, error: null, query });
    try {
      const results = await searchApi.search(query);
      set({ results, isLoading: false });
    } catch (error) {
      set({
        error: extractErrorMessage(error, "Search failed"),
        isLoading: false,
      });
    }
  },

  setQuery: (query) => set({ query }),
  clearResults: () => set({ results: [], query: "", error: null }),
}));
