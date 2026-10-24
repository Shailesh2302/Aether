import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { requireSubscription } from '../middleware/subscription.js';
import { config } from '../config/env.js';
import { logger } from '../config/logger.js';
import { prisma } from '../config/db.js';
import { vectorService } from '../services/vector.service.js';

const router = Router();

const requireOwnedFile = async (fileId: unknown, userId: string): Promise<boolean> => {
  if (!fileId || typeof fileId !== 'string') return false;
  const file = await prisma.file.findFirst({ where: { id: fileId, userId }, select: { id: true } });
  return Boolean(file);
};

type FileMeta = Record<string, unknown>;

const getFileMeta = async (fileId: string, userId: string): Promise<{ id: string; meta: FileMeta } | null> => {
  const file = await prisma.file.findFirst({
    where: { id: fileId, userId },
    select: { id: true, metadata: true },
  });
  if (!file) return null;
  return { id: file.id, meta: ((file.metadata as FileMeta | null) ?? {}) };
};

const saveFileMeta = async (fileId: string, meta: FileMeta): Promise<void> => {
  await prisma.file.update({
    where: { id: fileId },
    data: { metadata: meta as Record<string, string | number | boolean | object> },
  }).catch(() => undefined);
};

router.post(
  '/summary',
  authenticate,
  requireSubscription,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { fileId, refresh } = req.body;
      const userId = req.user!.userId;

      const owned = await getFileMeta(fileId, userId);
      if (!owned) {
        return res.status(404).json({ error: 'File not found' });
      }

      // Summaries are deterministic per transcript - serve the cached copy
      // so repeat visits return instantly instead of re-running the LLM.
      const cached = owned.meta.videoSummary as Record<string, unknown> | undefined;
      if (!refresh && cached && typeof cached.summary === 'string' && cached.summary.length > 0) {
        res.setHeader('X-Cache', 'HIT');
        return res.json({ file_id: fileId, ...cached });
      }

      logger.info(`Generating video summary: fileId=${fileId}, userId=${userId}`);

      const response = await fetch(`${config.aiServiceUrl}/api/v1/summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_id: fileId,
          user_id: userId,
        }),
      });

      if (!response.ok) {
        throw new Error(`AI service error: ${response.statusText}`);
      }

      const data = await response.json() as Record<string, unknown>;
      if (typeof data.summary === 'string' && data.summary.length > 0) {
        const freshMeta: FileMeta = { ...owned.meta, videoSummary: { ...data, cachedAt: new Date().toISOString() } };
        await saveFileMeta(fileId, freshMeta);
      }
      res.json(data);
    } catch (error) {
      logger.error({ error }, 'Error generating video summary');
      next(error);
    }
  }
);

router.post(
  '/ask',
  authenticate,
  requireSubscription,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { fileId, question } = req.body;
      const userId = req.user!.userId;

      if (!fileId || !question) {
        return res.status(400).json({ error: 'fileId and question are required' });
      }

      if (!(await requireOwnedFile(fileId, userId))) {
        return res.status(404).json({ error: 'File not found' });
      }

      logger.info(`Processing video question: fileId=${fileId}`);

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const response = await fetch(`${config.aiServiceUrl}/api/v1/ask`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify({
          file_id: fileId,
          user_id: userId,
          question,
        }),
      });

      if (!response.ok) {
        throw new Error(`AI service error: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        const readStream = () => {
          reader.read().then(({ done, value }) => {
            if (done) {
              res.end();
            } else {
              res.write(decoder.decode(value));
              readStream();
            }
          }).catch((err) => {
            logger.error({ err }, 'SSE stream error');
            res.end();
          });
        };
        readStream();
      }

    } catch (error) {
      logger.error({ error }, 'Error processing video question');
      next(error);
    }
  }
);

router.get(
  '/status/:fileId',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { fileId } = req.params;
      const userId = req.user!.userId;

      const file = await prisma.file.findFirst({
        where: { id: fileId, userId },
        select: { id: true, status: true, metadata: true, mimeType: true },
      });
      if (!file) {
        return res.status(404).json({ error: 'File not found' });
      }

      // "Indexed" means vectors exist; the DB status alone cannot tell us
      // that (e.g. a silent video completes without a transcript).
      let indexed = false;
      try {
        const collection = `user_${userId}`.replace(/-/g, '_');
        const points = await vectorService.scrollPoints(collection, fileId, 1);
        indexed = points.length > 0;
      } catch (vectorError) {
        logger.warn({ vectorError, fileId }, 'Could not read video status from vector store');
      }

      const meta = (file.metadata as Record<string, unknown> | null) ?? {};
      const smartClips = (meta.smartClips as { clips?: unknown[] } | undefined)?.clips;
      const highlightsCount = Number(meta.highlightsGenerated)
        || (Array.isArray(meta.highlights) ? (meta.highlights as unknown[]).length : 0)
        || (Array.isArray(smartClips) ? smartClips.length : 0);
      const momentsCount = Number(meta.momentsDetected)
        || (Array.isArray(meta.moments) ? (meta.moments as unknown[]).length : 0);

      // The web UI expects lowercase lifecycle states and a 0-100 progress.
      const statusMap: Record<string, string> = {
        PENDING: 'pending',
        PROCESSING: 'processing',
        COMPLETED: 'completed',
        FAILED: 'failed',
      };
      const status = statusMap[file.status] ?? 'pending';
      const progress = status === 'completed' ? 100 : status === 'processing' ? 50 : status === 'failed' ? 0 : 10;

      res.json({
        file_id: fileId,
        status,
        progress,
        transcript_ready: indexed,
        indexed,
        moments_detected: Number.isFinite(momentsCount) ? momentsCount : 0,
        highlights_generated: Number.isFinite(highlightsCount) ? highlightsCount : 0,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting video status');
      next(error);
    }
  }
);

router.post(
  '/translate',
  authenticate,
  requireSubscription,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { fileId, targetLang } = req.body;
      const userId = req.user!.userId;

      if (!fileId || !targetLang) {
        return res.status(400).json({ error: 'fileId and targetLang are required' });
      }
      if (!(await requireOwnedFile(fileId, userId))) {
        return res.status(404).json({ error: 'File not found' });
      }

      const response = await fetch(`${config.aiServiceUrl}/api/v1/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_id: fileId,
          user_id: userId,
          target_lang: String(targetLang).slice(0, 40),
        }),
      });

      if (!response.ok) {
        throw new Error(`AI service error: ${response.statusText}`);
      }
      res.json(await response.json());
    } catch (error) {
      logger.error({ error }, 'Error translating transcript');
      next(error);
    }
  }
);

router.post(
  '/smart-clips',
  authenticate,
  requireSubscription,  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { fileId, maxClips = 5, refresh } = req.body;
      const userId = req.user!.userId;

      const owned = await getFileMeta(fileId, userId);
      if (!owned) {
        return res.status(404).json({ error: 'File not found' });
      }

      // Highlight detection is the slowest step in clipping - reuse the
      // cached set when it already covers the requested count.
      const cached = owned.meta.smartClips as { clips?: unknown[] } | undefined;
      if (!refresh && Array.isArray(cached?.clips) && (cached?.clips?.length ?? 0) >= Number(maxClips)) {
        res.setHeader('X-Cache', 'HIT');
        return res.json({ file_id: fileId, clips: cached.clips!.slice(0, Number(maxClips)) });
      }

      logger.info(`Generating smart clips: fileId=${fileId}, maxClips=${maxClips}`);

      const response = await fetch(`${config.aiServiceUrl}/api/v1/smart-clips`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_id: fileId,
          user_id: userId,
          max_clips: maxClips,
        }),
      });

      if (!response.ok) {
        throw new Error(`AI service error: ${response.statusText}`);
      }

      const data = await response.json() as { clips?: unknown[] };
      if (Array.isArray(data.clips) && data.clips.length > 0) {
        const existing = Array.isArray(cached?.clips) ? cached!.clips! : [];
        const merged = [...existing, ...data.clips.filter((c) => !existing.some((e) => JSON.stringify(e) === JSON.stringify(c)))];
        const freshMeta: FileMeta = {
          ...owned.meta,
          smartClips: { clips: merged.slice(0, 20), cachedAt: new Date().toISOString() },
        };
        await saveFileMeta(fileId, freshMeta);
      }
      res.json(data);
    } catch (error) {
      logger.error({ error }, 'Error generating smart clips');
      next(error);
    }
  }
);

export default router;
