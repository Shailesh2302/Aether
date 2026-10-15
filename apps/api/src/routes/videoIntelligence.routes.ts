import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { config } from '../config/env.js';
import { logger } from '../config/logger.js';
import { prisma } from '../config/db.js';

const router = Router();

const requireOwnedFile = async (fileId: unknown, userId: string): Promise<boolean> => {
  if (!fileId || typeof fileId !== 'string') return false;
  const file = await prisma.file.findFirst({ where: { id: fileId, userId }, select: { id: true } });
  return Boolean(file);
};

router.post(
  '/moments',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { fileId, query, topK = 5 } = req.body;
      const userId = req.user!.userId;

      if (!(await requireOwnedFile(fileId, userId))) {
        return res.status(404).json({ error: 'File not found' });
      }

      const response = await fetch(`${config.aiServiceUrl}/api/v1/video/moments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_id: fileId,
          user_id: userId,
          query: query || null,
          top_k: topK,
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
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { fileId, categories, maxHighlights = 5 } = req.body;
      const userId = req.user!.userId;

      if (!(await requireOwnedFile(fileId, userId))) {
        return res.status(404).json({ error: 'File not found' });
      }

      const response = await fetch(`${config.aiServiceUrl}/api/v1/video/highlights`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_id: fileId,
          user_id: userId,
          categories: categories || ['explanation', 'key_insight', 'important_moment', 'discussion', 'action'],
          max_highlights: maxHighlights,
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
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { fileId } = req.query;
      const userId = req.user!.userId;

      if (!fileId) {
        return res.status(400).json({ error: 'fileId is required' });
      }

      if (!(await requireOwnedFile(fileId, userId))) {
        return res.status(404).json({ error: 'File not found' });
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
      res.json({ ...data, topics });
    } catch (error) {
      logger.error({ error }, 'Error detecting topics');
      next(error);
    }
  }
);

export default router;