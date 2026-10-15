import { Router, Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'crypto';
import { randomUUID } from 'crypto';
import { prisma } from '../config/db.js';
import { aiService } from '../services/ai.service.js';
import { vectorService } from '../services/vector.service.js';
import { logger } from '../config/logger.js';

/**
 * Internal endpoints for trusted workers (Rust worker).
 * Authenticated via the x-service-key header against SERVICE_API_KEY.
 * Disabled entirely when SERVICE_API_KEY is not configured.
 */
const router = Router();

const requireServiceKey = (req: Request, res: Response, next: NextFunction) => {
  const expected = process.env.SERVICE_API_KEY;
  if (!expected) {
    return res.status(403).json({ error: 'Internal API disabled (SERVICE_API_KEY not set)' });
  }
  const provided = req.header('x-service-key') || '';
  if (
    provided.length !== expected.length ||
    !timingSafeEqual(Buffer.from(provided), Buffer.from(expected))
  ) {
    return res.status(401).json({ error: 'Invalid service key' });
  }
  next();
};

router.use(requireServiceKey);

router.post(
  '/files/:fileId/status',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { fileId } = req.params;
      const status = String(req.body?.status || '').toUpperCase();

      if (!['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'].includes(status)) {
        return res.status(400).json({ error: `Invalid status: ${status}` });
      }

      const existing = await prisma.file.findUnique({ where: { id: fileId }, select: { id: true } });
      if (!existing) {
        return res.status(404).json({ error: 'File not found' });
      }

      await prisma.file.update({
        where: { id: fileId },
        data: { status: status as never },
      });

      logger.info({ fileId, status }, 'File status updated by worker');
      res.json({ success: true, fileId, status });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Split raw transcript text into retrieval-sized chunks. Handles both
 * paragraph-separated documents and plain ASR output with no newlines
 * (sentence-boundary packing under a character budget).
 */
function chunkTranscript(text: string, maxLen = 900): string[] {
  const paragraphs = text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (paragraphs.length > 1) {
    return paragraphs;
  }

  const sentences = text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?。？！])\s+/)
    .filter((sn) => sn.trim());

  const out: string[] = [];
  let buf = '';
  for (const sn of sentences) {
    if ((buf + ' ' + sn).trim().length > maxLen && buf) {
      out.push(buf.trim());
      buf = sn;
    } else {
      buf = (buf + ' ' + sn).trim();
    }
  }
  if (buf.trim()) out.push(buf.trim());
  return out.length > 0 ? out : [text];
}

router.post(
  '/search/index',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { fileId, userId, text, metadata = {} } = req.body;

      if (!fileId || !userId || !text) {
        return res.status(400).json({ error: 'fileId, userId and text are required' });
      }

      const file = await prisma.file.findFirst({ where: { id: fileId }, select: { id: true, originalName: true } });
      if (!file) {
        return res.status(404).json({ error: 'File not found' });
      }

      const collectionName = `user_${userId}`.replace(/-/g, '_');
      const chunks = chunkTranscript(String(text)).slice(0, 500);

      if (chunks.length === 0) {
        return res.status(400).json({ error: 'No valid chunks to index' });
      }

      const firstEmbedding = await aiService.createEmbedding(chunks[0]);
      const dimension = firstEmbedding.length;

      if (!(await vectorService.collectionExists(collectionName))) {
        const created = await vectorService.createCollection(collectionName, dimension);
        if (!created) {
          return res.status(500).json({ error: `Failed to create collection ${collectionName}` });
        }
      }

      const upserted = await vectorService.upsertPoints(collectionName, [{
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
      if (!upserted) {
        return res.status(500).json({ error: 'Failed to upsert points into Qdrant' });
      }

      for (const chunk of chunks.slice(1)) {
        const embedding = await aiService.createEmbedding(chunk);
        const okChunk = await vectorService.upsertPoints(collectionName, [{
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
        if (!okChunk) {
          logger.error({ fileId, userId }, 'Chunk upsert failed during internal index');
          return res.status(500).json({ error: 'Failed to upsert points into Qdrant' });
        }
      }

      res.json({ success: true, chunksIndexed: chunks.length });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
