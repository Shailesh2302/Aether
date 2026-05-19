import { Router, Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, AuthRequest } from '../middleware/auth.js';
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

router.get(
  '/',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { q, limit = 10 } = req.query;
      const userId = req.user!.userId;

      if (!q || typeof q !== 'string') {
        return res.json({ results: [], message: 'No query provided' });
      }

      const userFiles = await prisma.file.findMany({
        where: { userId, status: 'COMPLETED' },
        select: { id: true, name: true, originalName: true, mimeType: true },
      });

      if (userFiles.length === 0) {
        return res.json({ results: [], message: 'No indexed files found' });
      }

      const collectionName = `user:${userId}`;
      
      let results: any[] = [];
      try {
        const queryEmbedding = await aiService.createEmbedding(q);
        
        results = await vectorService.searchPoints(
          collectionName,
          queryEmbedding,
          parseInt(String(limit), 10)
        );

        results = results.map((r) => ({
          id: r.id,
          text: r.payload.text,
          score: r.score,
          metadata: r.payload.metadata || {},
        }));
      } catch (error) {
        logger.warn({ error }, 'Vector search failed, falling back to AI search');
        
        const aiResponse = await aiService.searchDocuments(q);
        results = [{
          id: 'ai-generated',
          text: aiResponse,
          score: 1.0,
          metadata: { source: 'ai' },
        }];
      }

      res.json({ results, query: q });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/',
  authenticate,
  [
    body('query').notEmpty().withMessage('Query is required'),
  ],
  validateRequest,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { query, limit = 10 } = req.body;
      const userId = req.user!.userId;

      const userFiles = await prisma.file.findMany({
        where: { userId, status: 'COMPLETED' },
        select: { id: true, name: true, originalName: true, mimeType: true },
      });

      if (userFiles.length === 0) {
        return res.json({ results: [], message: 'No indexed files found' });
      }

      const collectionName = `user:${userId}`;
      
      let results: any[] = [];
      try {
        const queryEmbedding = await aiService.createEmbedding(query);
        
        results = await vectorService.searchPoints(
          collectionName,
          queryEmbedding,
          parseInt(String(limit), 10)
        );

        results = results.map((r) => ({
          id: r.id,
          text: r.payload.text,
          score: r.score,
          metadata: r.payload.metadata || {},
        }));
      } catch (error) {
        logger.warn({ error }, 'Vector search failed');

        const aiResponse = await aiService.searchDocuments(query);
        results = [{
          id: 'ai-generated',
          text: aiResponse,
          score: 1.0,
          metadata: { source: 'ai' },
        }];
      }

      res.json({ results, query });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/index',
  authenticate,
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

      const collectionName = `user:${userId}`;
      
      const collectionExists = await vectorService.collectionExists(collectionName);
      if (!collectionExists) {
        await vectorService.createCollection(collectionName, 1536);
      }

      const chunks = text.split('\n\n').filter((chunk: string) => chunk.trim());
      
      for (const chunk of chunks) {
        const embedding = await aiService.createEmbedding(chunk);
        
        await vectorService.upsertPoints(collectionName, [{
          id: `${fileId}:${Date.now()}:${Math.random()}`,
          vector: embedding,
          payload: {
            text: chunk,
            fileId,
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