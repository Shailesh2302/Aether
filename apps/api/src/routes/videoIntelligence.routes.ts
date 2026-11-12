import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { requireSubscription } from '../middleware/subscription.js';
import { config } from '../config/env.js';
import { logger } from '../config/logger.js';
import { prisma } from '../config/db.js';

const router = Router();

type FileMeta = Record<string, unknown>;

const getFileMeta = async (
  fileId: unknown,
  userId: string
): Promise<{ id: string; meta: FileMeta } | null> => {
  if (!fileId || typeof fileId !== 'string') return null;
  const file = await prisma.file.findFirst({
    where: { id: fileId, userId },
    select: { id: true, metadata: true },
  });
  if (!file) return null;
  return { id: file.id, meta: (file.metadata as FileMeta | null) ?? {} };
};

/** Persist generated artefacts so repeat requests are served from Postgres
 * instead of re-running retrieval + the LLM. */
const saveFileMeta = async (fileId: string, meta: FileMeta): Promise<void> => {
  await prisma.file.update({
    where: { id: fileId },
    data: { metadata: meta as Record<string, string | number | boolean | object> },
  }).catch(() => undefined);
};

const clampInt = (value: unknown, fallback: number, max: number): number => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), max);
};

const DEFAULT_HIGHLIGHT_CATEGORIES = [
  'explanation',
  'key_insight',
  'important_moment',
  'discussion',
  'action',
];

const TOPICS_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

router.post(
  '/moments',
  authenticate,
  requireSubscription,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { fileId, query, topK = 5, refresh } = req.body;
      const userId = req.user!.userId;
      const requested = clampInt(topK, 5, 20);

      const owned = await getFileMeta(fileId, userId);
      if (!owned) {
        return res.status(404).json({ error: 'File not found' });
      }

      // Default moment detection is deterministic for a transcript. Serve
      // the persisted set unless the caller explicitly refreshes or searches.
      const cachedMoments = Array.isArray(owned.meta.moments)
        ? (owned.meta.moments as Array<Record<string, unknown>>)
        : [];
      if (
        !refresh &&
        !query &&
        cachedMoments.length >= requested
      ) {
        res.setHeader('X-Cache', 'HIT');
        return res.json({
          file_id: fileId,
          moments: cachedMoments.slice(0, requested),
          total_duration_sec: Number(owned.meta.momentsDurationSec) || 0,
          transcript_segments: [],
        });
      }

      const response = await fetch(`${config.aiServiceUrl}/api/v1/video/moments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_id: fileId,
          user_id: userId,
          query: query || null,
          top_k: requested,
        }),
      });

      if (!response.ok) {
        throw new Error(`AI service error: ${response.statusText}`);
      }

      const data: any = await response.json();
      // AI service emits `summary`; the web UI expects `description`
      const moments = (data.moments || []).map((m: Record<string, unknown>) => ({
        ...m,
        description: m.description ?? m.summary ?? '',
      }));

      if (!query) {
        await saveFileMeta(fileId, {
          ...owned.meta,
          moments,
          momentsDetected: moments.length,
          momentsDurationSec: Number(data.total_duration_sec) || 0,
          momentsCachedAt: new Date().toISOString(),
        });
      } else {
        await saveFileMeta(fileId, {
          ...owned.meta,
          momentsDetected: Math.max(
            Number(owned.meta.momentsDetected) || 0,
            moments.length
          ),
        });
      }
      res.json({ ...data, moments });
    } catch (error) {
      logger.error({ error }, 'Error detecting moments');
      next(error);
    }
  }
);

router.post(
  '/highlights',
  authenticate,
  requireSubscription,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { fileId, categories, maxHighlights = 5, refresh } = req.body;
      const userId = req.user!.userId;
      const requested = clampInt(maxHighlights, 5, 20);
      const requestedCategories = Array.isArray(categories) && categories.length > 0
        ? categories.map(String)
        : DEFAULT_HIGHLIGHT_CATEGORIES;
      const categoriesKey = [...requestedCategories].sort().join(',');

      const owned = await getFileMeta(fileId, userId);
      if (!owned) {
        return res.status(404).json({ error: 'File not found' });
      }

      const cacheInfo = owned.meta.highlightsCache as
        | { categories?: string; count?: number }
        | undefined;
      const cachedHighlights = Array.isArray(owned.meta.highlights)
        ? (owned.meta.highlights as Array<Record<string, unknown>>)
        : [];

      if (
        !refresh &&
        cacheInfo?.categories === categoriesKey &&
        cachedHighlights.length >= requested
      ) {
        res.setHeader('X-Cache', 'HIT');
        return res.json({
          file_id: fileId,
          highlights: cachedHighlights.slice(0, requested),
          video_summary:
            typeof owned.meta.highlightsSummary === 'string'
              ? owned.meta.highlightsSummary
              : '',
          topics_covered: Array.isArray(owned.meta.highlightsTopics)
            ? owned.meta.highlightsTopics
            : [],
        });
      }

      const response = await fetch(`${config.aiServiceUrl}/api/v1/video/highlights`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_id: fileId,
          user_id: userId,
          categories: requestedCategories,
          max_highlights: requested,
        }),
      });

      if (!response.ok) {
        throw new Error(`AI service error: ${response.statusText}`);
      }

      const data: any = await response.json();
      const highlights = (data.highlights || []).map((h: Record<string, unknown>) => ({
        ...h,
        description: h.description ?? h.summary ?? h.reason ?? '',
        title: h.title ?? (typeof h.summary === 'string' ? h.summary.slice(0, 60) : ''),
      }));

      await saveFileMeta(fileId, {
        ...owned.meta,
        highlights,
        highlightsGenerated: highlights.length,
        highlightsSummary:
          typeof data.video_summary === 'string' ? data.video_summary : '',
        highlightsTopics: Array.isArray(data.topics_covered) ? data.topics_covered : [],
        highlightsCache: {
          categories: categoriesKey,
          count: highlights.length,
          cachedAt: new Date().toISOString(),
        },
      });
      res.json({ ...data, highlights });
    } catch (error) {
      logger.error({ error }, 'Error generating highlights');
      next(error);
    }
  }
);

router.get(
  '/topics',
  authenticate,
  requireSubscription,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { fileId, refresh } = req.query;
      const userId = req.user!.userId;

      if (!fileId || typeof fileId !== 'string') {
        return res.status(400).json({ error: 'fileId is required' });
      }

      const owned = await getFileMeta(fileId, userId);
      if (!owned) {
        return res.status(404).json({ error: 'File not found' });
      }

      const cachedAt = Date.parse(String(owned.meta.topicsCachedAt ?? ''));
      const cachedTopics = Array.isArray(owned.meta.topics)
        ? (owned.meta.topics as Array<Record<string, unknown>>)
        : [];
      if (
        refresh !== '1' &&
        refresh !== 'true' &&
        cachedTopics.length > 0 &&
        Number.isFinite(cachedAt) &&
        Date.now() - cachedAt < TOPICS_CACHE_TTL_MS
      ) {
        res.setHeader('X-Cache', 'HIT');
        return res.json({
          file_id: fileId,
          topics: cachedTopics,
          summary: typeof owned.meta.topicsSummary === 'string' ? owned.meta.topicsSummary : '',
          key_themes: Array.isArray(owned.meta.topicsThemes) ? owned.meta.topicsThemes : [],
        });
      }

      const response = await fetch(
        `${config.aiServiceUrl}/api/v1/video/topics?file_id=${fileId}&user_id=${userId}`,
        { method: 'GET' }
      );

      if (!response.ok) {
        throw new Error(`AI service error: ${response.statusText}`);
      }

      const data = await response.json() as Record<string, unknown>;
      // Normalize to the shape the web UI renders:
      // [{ topic, timestamp_sec, keywords, relevance_score }].
      // The AI service returns { topics: string[], summary, key_themes }.
      const rawTopics: unknown[] = Array.isArray(data.topics)
        ? data.topics as unknown[]
        : [];
      const topics = rawTopics
        .map((t, i) => {
          if (typeof t === 'string') {
            return { topic: t, timestamp_sec: 0, keywords: [], relevance_score: 0.8 };
          }
          const o = t as Record<string, unknown>;
          return {
            topic: String(o.topic ?? o.name ?? o.title ?? `Topic ${i + 1}`),
            timestamp_sec: typeof o.timestamp_sec === 'number' ? o.timestamp_sec : 0,
            keywords: Array.isArray(o.keywords) ? o.keywords as string[] : [],
            relevance_score: typeof o.relevance_score === 'number' ? o.relevance_score : 0.8,
          };
        })
        .filter((t) => t.topic);

      await saveFileMeta(fileId, {
        ...owned.meta,
        topics,
        topicsSummary: typeof data.summary === 'string' ? data.summary : '',
        topicsThemes: Array.isArray(data.key_themes) ? data.key_themes : [],
        topicsCachedAt: new Date().toISOString(),
      });
      res.json({ ...data, topics });
    } catch (error) {
      logger.error({ error }, 'Error detecting topics');
      next(error);
    }
  }
);

export default router;