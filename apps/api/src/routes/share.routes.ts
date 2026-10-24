import { Router, Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { randomBytes } from 'crypto';
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

const publicFile = (file: {
  id: string; originalName: string; mimeType: string; size: bigint | number;
  url: string | null; status: unknown; createdAt: Date;
}, origin: string) => ({
  id: file.id,
  originalName: file.originalName,
  mimeType: file.mimeType,
  size: Number(file.size),
  // Direct media URL so shared pages play without API credentials. Build
  // from the incoming request's origin: config.storage.apiUrl points at
  // the container's localhost and would break every shared link.
  url: file.url
    ? (/^https?:\/\//i.test(file.url)
        ? file.url
        : `${origin}${file.url.startsWith('/') ? '' : '/'}${file.url}`)
    : null,
  status: file.status,
  createdAt: file.createdAt,
});

router.post(
  '/',
  authenticate,
  requireSubscription,
  [
    body('fileId').optional().isString(),
    body('clipId').optional().isString(),
    body('expiresInDays').optional().isInt({ min: 1, max: 365 }),
  ],
  validateRequest,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { fileId, clipId, expiresInDays } = req.body;
      if (!fileId && !clipId) {
        return res.status(400).json({ error: 'fileId or clipId is required' });
      }
      if (fileId) {
        const file = await prisma.file.findFirst({ where: { id: fileId, userId: req.user!.userId }, select: { id: true } });
        if (!file) return res.status(404).json({ error: 'File not found' });
      }
      if (clipId) {
        const clip = await prisma.clip.findFirst({ where: { id: clipId, userId: req.user!.userId }, select: { id: true } });
        if (!clip) return res.status(404).json({ error: 'Clip not found' });
      }
      const link = await prisma.shareLink.create({
        data: {
          userId: req.user!.userId,
          fileId: fileId ?? null,
          clipId: clipId ?? null,
          token: randomBytes(16).toString('hex'),
          expiresAt: expiresInDays ? new Date(Date.now() + Number(expiresInDays) * 86400000) : null,
        },
      });
      res.status(201).json({ link: { ...link, url: `/s/${link.token}` } });
    } catch (error) {
      next(error);
    }
  }
);

router.get('/', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const links = await prisma.shareLink.findMany({
      where: { userId: req.user!.userId },
      orderBy: { createdAt: 'desc' },
      include: {
        file: { select: { id: true, originalName: true, mimeType: true } },
      },
    });
    res.json({ links: links.map((l) => ({ ...l, url: `/s/${l.token}` })) });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const link = await prisma.shareLink.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
      select: { id: true },
    });
    if (!link) return res.status(404).json({ error: 'Share link not found' });
    await prisma.shareLink.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

/** Public: resolve a share token (no auth). Used by /s/:token pages. */
router.get('/resolve/:token', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const link = await prisma.shareLink.findUnique({
      where: { token: req.params.token },
      include: {
        file: {
          select: {
            id: true, originalName: true, mimeType: true, size: true,
            url: true, status: true, createdAt: true,
          },
        },
      },
    });
    if (!link) return res.status(404).json({ error: 'Link not found or revoked' });
    if (link.expiresAt && link.expiresAt < new Date()) {
      return res.status(410).json({ error: 'This link has expired' });
    }
    await prisma.shareLink.update({
      where: { id: link.id },
      data: { viewCount: { increment: 1 } },
    }).catch(() => undefined);

    if (link.clipId) {
      const clip = await prisma.clip.findUnique({
        where: { id: link.clipId },
        select: {
          id: true, title: true, description: true, startTime: true, endTime: true,
          videoUrl: true, thumbnail: true, status: true,
          file: { select: { id: true, originalName: true, mimeType: true } },
        },
      });
      if (!clip) return res.status(404).json({ error: 'Clip no longer exists' });
      return res.json({
        link: { token: link.token, expiresAt: link.expiresAt, viewCount: link.viewCount + 1 },
        clip: {
          ...clip,
          startTime: Number(clip.startTime),
          endTime: Number(clip.endTime),
        },
      });
    }

    if (!link.file) return res.status(404).json({ error: 'File no longer exists' });
    const origin = `${req.protocol}://${req.get('host')}`;
    res.json({
      link: { token: link.token, expiresAt: link.expiresAt, viewCount: link.viewCount + 1 },
      file: publicFile(link.file as never, origin),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
