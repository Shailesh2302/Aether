import { Router, Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { prisma } from '../config/db.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { aiService } from '../services/ai.service.js';
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
    const clips = await prisma.clip.findMany({
      where: { userId: req.user!.userId },
      orderBy: { createdAt: 'desc' },
      include: {
        file: {
          select: {
            id: true,
            name: true,
            originalName: true,
          },
        },
      },
    });
    res.json({ clips });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const clip = await prisma.clip.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
      include: {
        file: true,
      },
    });

    if (!clip) {
      return res.status(404).json({ error: 'Clip not found' });
    }

    res.json({ clip });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const clip = await prisma.clip.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
    });

    if (!clip) {
      return res.status(404).json({ error: 'Clip not found' });
    }

    await prisma.clip.delete({
      where: { id: req.params.id },
    });

    logger.info({ clipId: req.params.id, userId: req.user!.userId }, 'Clip deleted');
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.post(
  '/generate',
  authenticate,
  [
    body('fileId').notEmpty().withMessage('File ID is required'),
    body('startTime').isFloat({ min: 0 }).withMessage('Start time must be a positive number'),
    body('endTime').isFloat({ min: 0 }).withMessage('End time must be a positive number'),
    body('title').optional().isLength({ min: 1 }).withMessage('Title cannot be empty'),
  ],
  validateRequest,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { fileId, startTime, endTime, title, description } = req.body;

      const file = await prisma.file.findFirst({
        where: { id: fileId, userId: req.user!.userId },
      });

      if (!file) {
        return res.status(404).json({ error: 'File not found' });
      }

      const clip = await prisma.clip.create({
        data: {
          userId: req.user!.userId,
          fileId,
          title: title || `Clip from ${file.name}`,
          description,
          startTime,
          endTime,
          status: 'PROCESSING',
        },
      });

      try {
        const result = await aiService.generateClip(file.path, startTime, endTime);

        await prisma.clip.update({
          where: { id: clip.id },
          data: {
            status: 'COMPLETED',
            videoUrl: result.url,
            thumbnail: result.thumbnail,
          },
        });

        logger.info({ clipId: clip.id }, 'Clip generated successfully');
      } catch (error) {
        await prisma.clip.update({
          where: { id: clip.id },
          data: { status: 'FAILED' },
        });
        throw error;
      }

      const updatedClip = await prisma.clip.findUnique({
        where: { id: clip.id },
      });

      res.json({ clip: updatedClip });
    } catch (error) {
      next(error);
    }
  }
);

export default router;