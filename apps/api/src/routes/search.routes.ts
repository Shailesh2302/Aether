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
  limit: number
): Promise<{ results: unknown[]; query: string; message?: string }> {
  const userFiles = await prisma.file.findMany({
    where: { userId, status: 'COMPLETED' },
    select: { id: true, name: true, originalName: true, mimeType: true },
  });

  if (userFiles.length === 0) {
    return { results: [], query, message: 'No indexed files found' };
  }

  const collectionName = `user_${userId}`.replace(/-/g, '_');

  try {
    const queryEmbedding = await aiService.createEmbedding(query);

    const results = await vectorService.searchPoints(
      collectionName,
      queryEmbedding,
      limit
    );

    const fileIds = [...new Set(results.map((r) => String((r.payload as Record<string, unknown>).file_id ?? '')))].filter(Boolean);
    const files = fileIds.length > 0
      ? await prisma.file.findMany({
          where: { id: { in: fileIds }, userId },
          select: { id: true, name: true, originalName: true, mimeType: true },
        })
      : [];
    const fileById = new Map(files.map((f) => [f.id, f]));

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

      if (!q) {
        return res.json({ results: [], message: 'No query provided' });
      }

      const result = await semanticSearch(req.user!.userId, q, limit);
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
      const { query, limit = 10 } = req.body;
      const result = await semanticSearch(
        req.user!.userId,
        query,
        parseInt(String(limit), 10)
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
