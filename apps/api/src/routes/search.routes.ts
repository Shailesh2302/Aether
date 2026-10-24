import { Router, Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { randomUUID } from 'crypto';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { requireSubscription } from '../middleware/subscription.js';
import { aiService } from '../services/ai.service.js';
import { vectorService } from '../services/vector.service.js';
import { prisma } from '../config/db.js';
import { logger } from '../config/logger.js';

const router = Router();

const validateRequest = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

async function semanticSearch(
  userId: string,
  query: string,
  limit: number,
  fileId?: string
): Promise<{ results: unknown[]; query: string; message?: string }> {
  const userFiles = await prisma.file.findMany({
    where: fileId
      ? { userId, id: fileId, status: 'COMPLETED' }
      : { userId, status: 'COMPLETED' },
    select: { id: true, name: true, originalName: true, mimeType: true },
  });

  if (userFiles.length === 0) {
    return { results: [], query, message: fileId ? 'File is not indexed yet' : 'No indexed files found' };
  }

  const collectionName = `user_${userId}`.replace(/-/g, '_');

  try {
    const queryEmbedding = await aiService.createEmbedding(query);

    // Drop points whose owning file no longer exists (e.g. deletion raced
    // vector cleanup or predates it). Qdrant is not the source of truth for
    // ownership - Prisma is.
    const allowedFileIds = new Set(userFiles.map((f) => f.id));
    const results = (await vectorService.searchPoints(
      collectionName,
      queryEmbedding,
      limit,
      0,
      fileId ? { file_id: fileId } : undefined
    )).filter((r) => allowedFileIds.has(String((r.payload as Record<string, unknown>).file_id ?? '')));

    const fileIds = [...new Set(results.map((r) => String((r.payload as Record<string, unknown>).file_id ?? '')))].filter(Boolean);
    const files = fileIds.length > 0
      ? await prisma.file.findMany({
          where: { id: { in: fileIds }, userId },
          select: { id: true, name: true, originalName: true, mimeType: true, createdAt: true, metadata: true },
        })
      : [];
    const fileById = new Map(files.map((f) => [f.id, f]));
    const versionOf = (fid: string): number => {
      const v = Number((fileById.get(fid)?.metadata as Record<string, unknown> | null)?.version ?? 1);
      return Number.isFinite(v) && v > 0 ? v : 1;
    };

    return {
      results: results.map((r) => {
        const payload = r.payload as Record<string, unknown>;
        const meta = (payload.metadata as Record<string, unknown>) ?? {};
        const fid = String(payload.file_id ?? '');
        const file = fileById.get(fid);
        const text = String(payload.text ?? '');
        return {
          id: r.id,
          fileId: fid,
          fileName: file?.originalName ?? file?.name ?? String(payload.fileName ?? ''),
          version: versionOf(fid),
          snippet: text.slice(0, 280),
          text,
          score: r.score,
          timestamp: typeof meta.start_sec === 'number' ? meta.start_sec : undefined,
          mimeType: file?.mimeType,
          metadata: meta,
        };
      }),
      query,
    };
  } catch (error) {
    logger.warn({ err: error instanceof Error ? error.message : String(error) }, 'Vector search failed, falling back to AI answer');

    const aiResponse = await aiService.searchDocuments(query);
    return {
      results: [{
        id: 'ai-generated',
        fileId: '',
        fileName: '',
        snippet: aiResponse.slice(0, 280),
        text: aiResponse,
        score: 1.0,
        metadata: { source: 'ai' },
      }],
      query,
    };
  }
}

router.get(
  '/',
  authenticate,
  requireSubscription,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const q = req.query.q as string | undefined;
      const limit = parseInt(String(req.query.limit || '10'), 10);
      const fileId = typeof req.query.fileId === 'string' && req.query.fileId ? req.query.fileId : undefined;

      if (!q) {
        return res.json({ results: [], message: 'No query provided' });
      }

      const result = await semanticSearch(req.user!.userId, q, limit, fileId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/',
  authenticate,
  requireSubscription,
  [
    body('query').notEmpty().withMessage('Query is required'),
  ],
  validateRequest,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { query, limit = 10, fileId } = req.body;
      const result = await semanticSearch(
        req.user!.userId,
        query,
        parseInt(String(limit), 10),
        typeof fileId === 'string' && fileId ? fileId : undefined
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/index',
  authenticate,
  requireSubscription,
  [
    body('fileId').notEmpty().withMessage('File ID is required'),
    body('text').notEmpty().withMessage('Text content is required'),
  ],
  validateRequest,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { fileId, text, metadata = {} } = req.body;
      const userId = req.user!.userId;

      const file = await prisma.file.findFirst({
        where: { id: fileId, userId },
      });

      if (!file) {
        return res.status(404).json({ error: 'File not found' });
      }

      const collectionName = `user_${userId}`.replace(/-/g, '_');

      const chunks = text.split('\n\n').filter((chunk: string) => chunk.trim());

      if (chunks.length === 0) {
        return res.status(400).json({ error: 'No valid chunks to index' });
      }

      const firstEmbedding = await aiService.createEmbedding(chunks[0]);
      const dimension = firstEmbedding.length;

      const collectionExists = await vectorService.collectionExists(collectionName);
      if (!collectionExists) {
        await vectorService.createCollection(collectionName, dimension);
      }

      // Idempotent re-index: replace this file's previous chunks rather than
      // piling duplicates onto the collection.
      await vectorService.deletePointsByFilter(collectionName, { file_id: fileId });

      await vectorService.upsertPoints(collectionName, [{
        id: randomUUID(),
        vector: firstEmbedding,
        payload: {
          text: chunks[0],
          file_id: fileId,
          user_id: userId,
          fileName: file.originalName,
          ...metadata,
        },
      }]);

      for (const chunk of chunks.slice(1)) {
        const embedding = await aiService.createEmbedding(chunk);

        await vectorService.upsertPoints(collectionName, [{
          id: randomUUID(),
          vector: embedding,
          payload: {
            text: chunk,
            file_id: fileId,
            user_id: userId,
            fileName: file.originalName,
            ...metadata,
          },
        }]);
      }

      await prisma.file.update({
        where: { id: fileId },
        data: { status: 'COMPLETED' },
      });

      logger.info({ fileId, userId, chunksCount: chunks.length }, 'Document indexed');

      res.json({ success: true, chunksIndexed: chunks.length });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
