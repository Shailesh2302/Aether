import { useSearchStore } from "@/store/useSearchStore";

export function useSearch() {
  const {
    query,
    results,
    isLoading,
    error,
    search,
    setQuery,
    clearResults,
  } = useSearchStore();

  return {
    query,
    results,
    isLoading,
    error,
    search,
    setQuery,
    clearResults,
  };
}