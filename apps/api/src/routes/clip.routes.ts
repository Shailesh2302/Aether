import { Router, Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { prisma } from '../config/db.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { requireSubscription } from '../middleware/subscription.js';
import { queueService } from '../services/queue.service.js';
import { generateGif } from '../utils/ffmpeg.js';
import { config } from '../config/env.js';
import { logger } from '../config/logger.js';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';

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
    const { fileId } = req.query;
    const where: any = { userId: req.user!.userId };
    if (fileId) {
      where.fileId = fileId as string;
    }
    const clips = await prisma.clip.findMany({
      where,
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

router.post(
  '/',
  authenticate,
  requireSubscription,
  [
    body('fileId').notEmpty().withMessage('File ID is required'),
    body('title').notEmpty().withMessage('Title is required'),
    body('startTime').isFloat({ min: 0 }).withMessage('Start time must be a positive number'),
    body('endTime').isFloat({ min: 0 }).withMessage('End time must be a positive number'),
  ],
  validateRequest,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { fileId, title, description, startTime, endTime, videoUrl, thumbnail } = req.body;

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
          title,
          description,
          startTime,
          endTime,
          videoUrl,
          thumbnail,
          status: videoUrl ? 'COMPLETED' : 'PENDING',
        },
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

      logger.info({ clipId: clip.id, fileId }, 'Clip created');
      res.status(201).json({ clip });
    } catch (error) {
      next(error);
    }
  }
);

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

    const serializedClip = {
      ...clip,
      startTime: Number(clip.startTime),
      endTime: Number(clip.endTime),
      file: clip.file ? {
        ...clip.file,
        size: Number(clip.file.size),
      } : null,
    };

    res.json({ clip: serializedClip });
  } catch (error) {
    next(error);
  }
});

/**
 * Render a GIF preview of a COMPLETED clip (cached in clip metadata).
 *   POST /api/clips/:id/gif
 */
router.post(
  '/:id/gif',
  authenticate,
  requireSubscription,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const clip = await prisma.clip.findFirst({
        where: { id: req.params.id, userId: req.user!.userId },
        include: { file: { select: { path: true } } },
      });
      if (!clip) return res.status(404).json({ error: 'Clip not found' });
      if (clip.status !== 'COMPLETED' || !clip.videoUrl) {
        return res.status(409).json({ error: 'Clip is still processing - try again shortly' });
      }

      const meta = (clip.metadata as Record<string, unknown> | null) ?? {};
      const cached = typeof meta.gifUrl === 'string' ? meta.gifUrl : null;
      const clipsDir = path.resolve(config.storage.clipsDir);
      if (cached) {
        const cachedFile = path.join(clipsDir, path.basename(cached));
        if (fs.existsSync(cachedFile)) {
          return res.json({ clip: { ...clip, gifUrl: cached }, gifUrl: cached });
        }
      }

      // Resolve the cut file on disk (videoUrl may be absolute or relative).
      const fileName = path.basename(clip.videoUrl.split('?')[0]);
      const clipPath = path.join(clipsDir, fileName);
      if (!fs.existsSync(clipPath)) {
        return res.status(404).json({ error: 'Clip file not found on disk' });
      }

      const gifName = `${clip.id}.gif`;
      const gifPath = path.join(clipsDir, gifName);
      if (!fs.existsSync(gifPath)) {
        await generateGif(clipPath, gifPath, 0, Math.min(Number(clip.endTime) - Number(clip.startTime), 15));
      }
      const gifUrl = `/storage/clips/${gifName}`;
      await prisma.clip.update({
        where: { id: clip.id },
        data: { metadata: { ...meta, gifUrl } },
      }).catch(() => undefined);
      res.json({ gifUrl });
    } catch (error) {
      logger.error({ error }, 'GIF generation failed');
      next(error);
    }
  }
);

router.delete('/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {  try {
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
  requireSubscription,
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

      // Hand off to a cutter without holding the HTTP request open:
      // the Rust worker answers synchronously when present, otherwise the
      // Node queue worker picks the job up within ~1s. Bound the whole
      // handoff so the client always gets a fast 202 + status polling.
      const jobId = uuidv4();
      const handoff = (async () => {
        try {
          const rustWorkerUrl = process.env.RUST_WORKER_URL || 'http://localhost:3003';
          const rustResponse = await fetch(`${rustWorkerUrl}/api/clips/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(2500),
            body: JSON.stringify({
              clipId: clip.id,
              filePath: file.path,
              startTime,
              endTime,
            }),
          });

          if (rustResponse.ok) {
            const result = await rustResponse.json() as { url?: string; thumbnail?: string };
            await prisma.clip.update({
              where: { id: clip.id },
              data: {
                status: 'COMPLETED',
                videoUrl: result.url ?? null,
                thumbnail: result.thumbnail ?? null,
              },
            });
            logger.info({ clipId: clip.id, jobId }, 'Clip generated via Rust worker');
            return;
          }
          throw new Error('Rust worker failed');
        } catch (rustError) {
          logger.info({ clipId: clip.id }, 'Cutting via queue worker');
          if (!queueService.isConnected()) {
            // No Redis: cut inline in the background instead of stalling.
            const { processClipFile } = await import('../services/processing.service.js');
            void processClipFile({
              id: `inline:${clip.id}`,
              fileId,
              inputPath: file.path,
              startTime,
              endTime,
              clipId: clip.id,
            }).catch(() => undefined);
            return;
          }
          try {
            await queueService.addClipGenerationJob({
              fileId,
              filePath: file.path,
              startTime,
              endTime,
              userId: req.user!.userId,
              clipId: clip.id,
            });
          } catch (queueError) {
            logger.warn({ queueError }, 'Queue unavailable, clip will be processed async');
          }
        }
      })();

      // Wait briefly so the fast (Rust) path can complete inline; the queue
      // path resolves in the background while the client polls clip status.
      await Promise.race([
        handoff,
        new Promise((resolve) => setTimeout(resolve, 1500)),
      ]);
      handoff.catch(() => undefined);

      // Return the created row directly (one less Neon round trip); the
      // client polls GET /clips/:id for the finished videoUrl/thumbnail.
      res.status(202).json({
        clip: {
          ...clip,
          startTime: Number(clip.startTime),
          endTime: Number(clip.endTime),
          file: { id: file.id, name: file.name, originalName: file.originalName },
        },
        jobId,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;