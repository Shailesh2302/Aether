import { useState, useCallback } from "react";
import { videoIntelligenceApi, VideoMoment, VideoHighlight, VideoTopic } from "@/lib/api";

export function useVideoIntelligence() {
  const [moments, setMoments] = useState<VideoMoment[]>([]);
  const [highlights, setHighlights] = useState<VideoHighlight[]>([]);
  const [topics, setTopics] = useState<VideoTopic[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const detectMoments = useCallback(async (fileId: string, query?: string, topK?: number) => {
    setLoading(true);
    setError(null);
    try {
      const response = await videoIntelligenceApi.getMoments(fileId, query, topK);
      setMoments(response.moments);
      return response;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to detect moments";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const generateHighlights = useCallback(async (fileId: string, categories?: string[], maxHighlights?: number) => {
    setLoading(true);
    setError(null);
    try {
      const response = await videoIntelligenceApi.getHighlights(fileId, categories, maxHighlights);
      setHighlights(response.highlights);
      return response;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to generate highlights";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const detectTopics = useCallback(async (fileId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await videoIntelligenceApi.getTopics(fileId);
      setTopics(response.topics);
      return response;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to detect topics";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearResults = useCallback(() => {
    setMoments([]);
    setHighlights([]);
    setTopics([]);
    setError(null);
  }, []);

  return {
    moments,
    highlights,
    topics,
    loading,
    error,
    detectMoments,
    generateHighlights,
    detectTopics,
    clearResults,
  };
}