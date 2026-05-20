import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { config } from '../config/env.js';
import { logger } from '../config/logger.js';

const router = Router();

router.post(
  '/moments',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { fileId, query, topK = 5 } = req.body;
      const userId = req.user!.userId;

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

      const data = await response.json();
      res.json(data);
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

      const data = await response.json();
      res.json(data);
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

      const response = await fetch(
        `${config.aiServiceUrl}/api/v1/video/topics?file_id=${fileId}&user_id=${userId}`,
        { method: 'GET' }
      );

      if (!response.ok) {
        throw new Error(`AI service error: ${response.statusText}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error) {
      logger.error({ error }, 'Error detecting topics');
      next(error);
    }
  }
);

export default router;