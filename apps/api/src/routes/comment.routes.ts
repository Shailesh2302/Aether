import { Router, Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { prisma } from '../config/db.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { requireSubscription } from '../middleware/subscription.js';

const router = Router();

const validateRequest = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

async function ownedFile(fileId: string, userId: string) {
  return prisma.file.findFirst({ where: { id: fileId, userId }, select: { id: true } });
}

router.get(
  '/files/:fileId/comments',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!(await ownedFile(req.params.fileId, req.user!.userId))) {
        return res.status(404).json({ error: 'File not found' });
      }
      const comments = await prisma.comment.findMany({
        where: { fileId: req.params.fileId, userId: req.user!.userId },
        orderBy: [{ timestampSec: 'asc' }, { createdAt: 'asc' }],
      });
      res.json({ comments });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/files/:fileId/comments',
  authenticate,
  requireSubscription,
  [
    body('text').isLength({ min: 1, max: 2000 }).withMessage('Text is required'),
    body('timestampSec').optional().isFloat({ min: 0 }).withMessage('Invalid timestamp'),
  ],
  validateRequest,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!(await ownedFile(req.params.fileId, req.user!.userId))) {
        return res.status(404).json({ error: 'File not found' });
      }
      const comment = await prisma.comment.create({
        data: {
          userId: req.user!.userId,
          fileId: req.params.fileId,
          text: String(req.body.text).trim(),
          timestampSec: req.body.timestampSec !== undefined ? Number(req.body.timestampSec) : null,
        },
      });
      res.status(201).json({ comment });
    } catch (error) {
      next(error);
    }
  }
);

router.delete(
  '/comments/:id',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const comment = await prisma.comment.findFirst({
        where: { id: req.params.id, userId: req.user!.userId },
        select: { id: true },
      });
      if (!comment) return res.status(404).json({ error: 'Comment not found' });
      await prisma.comment.delete({ where: { id: req.params.id } });
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
