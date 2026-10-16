import { useState, useCallback } from "react";
import {
  videoIntelligenceApi,
  type VideoMoment,
  type VideoHighlight,
  type VideoTopic,
  extractErrorMessage,
} from "@/lib/api";

export function useVideoIntelligence() {
  const [moments, setMoments] = useState<VideoMoment[]>([]);
  const [highlights, setHighlights] = useState<VideoHighlight[]>([]);
  const [topics, setTopics] = useState<VideoTopic[]>([]);
  // Independent flags per feature: running one must never spin the others.
  const [momentsLoading, setMomentsLoading] = useState(false);
  const [highlightsLoading, setHighlightsLoading] = useState(false);
  const [topicsLoading, setTopicsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const detectMoments = useCallback(
    async (fileId: string, query?: string, topK = 5) => {
      setMomentsLoading(true);
      setError(null);
      try {
        const response = await videoIntelligenceApi.getMoments(
          fileId,
          query,
          topK
        );
        setMoments(response.moments);
        return response;
      } catch (err) {
        const message = extractErrorMessage(err, "Failed to detect moments");
        setError(message);
        throw err;
      } finally {
        setMomentsLoading(false);
      }
    },
    []
  );

  const generateHighlights = useCallback(
    async (fileId: string, categories?: string[], maxHighlights = 5) => {
      setHighlightsLoading(true);
      setError(null);
      try {
        const response = await videoIntelligenceApi.getHighlights(
          fileId,
          categories,
          maxHighlights
        );
        setHighlights(response.highlights);
        return response;
      } catch (err) {
        const message = extractErrorMessage(
          err,
          "Failed to generate highlights"
        );
        setError(message);
        throw err;
      } finally {
        setHighlightsLoading(false);
      }
    },
    []
  );

  const detectTopics = useCallback(async (fileId: string) => {
    setTopicsLoading(true);
    setError(null);
    try {
      const response = await videoIntelligenceApi.getTopics(fileId);
      setTopics(response.topics);
      return response;
    } catch (err) {
      const message = extractErrorMessage(err, "Failed to detect topics");
      setError(message);
      throw err;
    } finally {
      setTopicsLoading(false);
    }
  }, []);

  const clearResults = useCallback(() => {
    setMoments([]);
    setHighlights([]);
    setTopics([]);
    setError(null);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return {
    moments,
    highlights,
    topics,
    loading: momentsLoading || highlightsLoading || topicsLoading,
    momentsLoading,
    highlightsLoading,
    topicsLoading,
    error,
    detectMoments,
    generateHighlights,
    detectTopics,
    clearResults,
    clearError,
  };
}
