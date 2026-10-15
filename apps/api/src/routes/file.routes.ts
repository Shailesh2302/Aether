import { Router, Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import path from 'path';
import fs from 'fs';
import { prisma } from '../config/db.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { storageService } from '../services/storage.service.js';
import { generateThumbnail } from '../utils/ffmpeg.js';
import { logger } from '../config/logger.js';

const router = Router();

const THUMBNAIL_DIR = './storage/thumbnails';

const isVideoOrAudio = (mimeType: string) =>
  mimeType.startsWith('video/') || mimeType.startsWith('audio/');

const serializeFile = (file: {
  id: string; name: string; originalName: string; mimeType: string;
  size: bigint | number; path: string; url: string | null; status: unknown;
  metadata: unknown; createdAt: Date; updatedAt: Date;
}) => {
  const meta = (file.metadata as Record<string, unknown> | null) ?? null;
  return {
    id: file.id,
    name: file.name,
    originalName: file.originalName,
    mimeType: file.mimeType,
    size: Number(file.size),
    path: file.path,
    url: file.url,
    status: file.status,
    metadata: meta,
    // The web UI already renders these when present.
    thumbnailUrl: isVideoOrAudio(file.mimeType) ? `/api/files/${file.id}/thumbnail` : null,
    duration: typeof meta?.duration === 'number' ? (meta.duration as number) : null,
    createdAt: file.createdAt,
    updatedAt: file.updatedAt,
  };
};

const validateRequest = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

router.get('/', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const files = await prisma.file.findMany({
      where: { userId: req.user!.userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        originalName: true,
        mimeType: true,
        size: true,
        status: true,
        url: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    const serialized = files.map((f) => serializeFile(f as never));
    res.json({ files: serialized });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const file = await prisma.file.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
    });

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.json({
      file: serializeFile(file as never),
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const file = await prisma.file.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
    });

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    await storageService.deleteFile(file.path);

    // Clean up cached thumbnails for this file.
    try {
      const entries = fs.readdirSync(THUMBNAIL_DIR);
      for (const entry of entries) {
        if (entry.startsWith(`${req.params.id}_`)) {
          fs.unlinkSync(path.join(THUMBNAIL_DIR, entry));
        }
      }
    } catch {
      // thumbnails dir may not exist - nothing to clean
    }

    await prisma.file.delete({
      where: { id: req.params.id },
    });

    logger.info({ fileId: req.params.id, userId: req.user!.userId }, 'File deleted');
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.get('/:id/download', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {  try {
    const file = await prisma.file.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
    });

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    const downloadUrl = await storageService.getDownloadUrl(file.path, file.originalName);
    res.json({ url: downloadUrl });
  } catch (error) {
    next(error);
  }
});

/**
 * Video frame thumbnail, generated on demand with ffmpeg and cached.
 * `?t=` selects the timestamp in seconds (defaults to 1).
 */
router.get('/:id/thumbnail', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // <img> tags can't send Authorization headers, so this media endpoint
    // also accepts the JWT as ?token= (same approach as signed media URLs).
    const header = req.headers.authorization;
    const queryToken = typeof req.query.token === 'string' ? req.query.token : null;
    if (!header?.startsWith('Bearer ') && !queryToken) {
      return res.status(401).json({ error: 'No token provided' });
    }
    try {
      const { authService } = await import('../modules/auth/auth.service.js');
      const payload = authService.verifyToken(
        header?.startsWith('Bearer ') ? header.split(' ')[1] : (queryToken as string)
      );
      req.user = { userId: payload.userId, email: payload.email };
    } catch {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const file = await prisma.file.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
    });

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    if (!isVideoOrAudio(file.mimeType)) {
      return res.status(400).json({ error: 'Thumbnails are only available for video/audio files' });
    }

    if (!fs.existsSync(file.path)) {
      return res.status(404).json({ error: 'Source media not found' });
    }

    const t = Math.max(0, Number(req.query.t) || 1);
    const cacheName = `${file.id}_${Math.round(t)}.jpg`;
    const cachePath = path.join(THUMBNAIL_DIR, cacheName);
    fs.mkdirSync(THUMBNAIL_DIR, { recursive: true });

    if (!fs.existsSync(cachePath)) {
      try {
        await generateThumbnail(path.resolve(file.path), path.resolve(cachePath), t);
      } catch (thumbErr) {
        logger.warn({ thumbErr, fileId: file.id }, 'Thumbnail generation failed');
        return res.status(500).json({ error: 'Could not generate thumbnail' });
      }
    }

    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.sendFile(path.resolve(cachePath));
  } catch (error) {
    next(error);
  }
});

router.patch(
  '/:id',
  authenticate,
  [
    body('status').optional().isIn(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED']).withMessage('Invalid status'),
  ],
  validateRequest,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { name, originalName, status, metadata } = req.body;

      const file = await prisma.file.findFirst({
        where: { id: req.params.id, userId: req.user!.userId },
      });

      if (!file) {
        return res.status(404).json({ error: 'File not found' });
      }

      const updateData: any = {};
      if (name) updateData.name = name;
      if (originalName) updateData.originalName = originalName;
      if (status) updateData.status = status;
      if (metadata) updateData.metadata = metadata;

      const updated = await prisma.file.update({
        where: { id: req.params.id },
        data: updateData,
        select: {
          id: true,
          name: true,
          originalName: true,
          mimeType: true,
          size: true,
          path: true,
          url: true,
          status: true,
          metadata: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      res.json({
        file: {
          ...updated,
          size: Number(updated.size),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;