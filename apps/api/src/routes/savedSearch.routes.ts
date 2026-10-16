import { Router, Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { prisma } from '../config/db.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { requireSubscription } from '../middleware/subscription.js';
import { aiService } from '../services/ai.service.js';
import { vectorService } from '../services/vector.service.js';
import { logger } from '../config/logger.js';

const router = Router();

const validateRequest = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

router.get('/', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const searches = await prisma.savedSearch.findMany({
      where: { userId: req.user!.userId },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ searches });
  } catch (error) {
    next(error);
  }
});

router.post(
  '/',
  authenticate,
  requireSubscription,
  [body('query').isLength({ min: 1, max: 200 }).withMessage('Query is required')],
  validateRequest,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const existing = await prisma.savedSearch.findFirst({
        where: { userId: req.user!.userId, query: String(req.body.query).trim() },
      });
      if (existing) return res.json({ search: existing });
      const search = await prisma.savedSearch.create({
        data: { userId: req.user!.userId, query: String(req.body.query).trim() },
      });
      res.status(201).json({ search });
    } catch (error) {
      next(error);
    }
  }
);

router.delete('/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const search = await prisma.savedSearch.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
      select: { id: true },
    });
    if (!search) return res.status(404).json({ error: 'Saved search not found' });
    await prisma.savedSearch.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

/**
 * Re-run a saved search and report new hits since the last check.
 * Updates lastCount/lastCheckedAt so the UI can badge "3 new".
 */
router.post(
  '/:id/check',
  authenticate,
  requireSubscription,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const saved = await prisma.savedSearch.findFirst({
        where: { id: req.params.id, userId: req.user!.userId },
      });
      if (!saved) return res.status(404).json({ error: 'Saved search not found' });

      let count = 0;
      try {
        const queryEmbedding = await aiService.createEmbedding(saved.query);
        const collectionName = `user_${req.user!.userId}`.replace(/-/g, '_');
        const results = await vectorService.searchPoints(collectionName, queryEmbedding, 50);
        count = results.length;
      } catch (err) {
        logger.warn({ err }, 'Saved-search check fell back to zero');
      }

      const newHits = Math.max(0, count - saved.lastCount);
      const updated = await prisma.savedSearch.update({
        where: { id: saved.id },
        data: { lastCount: count, lastCheckedAt: new Date() },
      });
      res.json({ search: updated, newHits, totalHits: count });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
