import { Router, Response, NextFunction } from 'express';
import { prisma } from '../config/db.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = Router();

router.get('/profile', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            files: true,
            sessions: true,
            clips: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    next(error);
  }
});

router.put('/profile', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name, avatar, email } = req.body;

    if (email !== undefined) {
      const emailStr = String(email).trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr)) {
        return res.status(400).json({ error: 'Valid email is required' });
      }
      const taken = await prisma.user.findFirst({
        where: { email: emailStr, NOT: { id: req.user!.userId } },
        select: { id: true },
      });
      if (taken) {
        return res.status(409).json({ error: 'Email is already in use' });
      }
    }

    const user = await prisma.user.update({
      where: { id: req.user!.userId },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(avatar !== undefined ? { avatar } : {}),
        ...(email !== undefined ? { email: String(email).trim().toLowerCase() } : {}),
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json({ user });
  } catch (error) {
    next(error);
  }
});

router.get('/stats', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    // Aggregate in Postgres instead of loading every file row into Node; this
    // keeps /stats O(1)-ish for users with very large libraries.
    const [totalFiles, totalClips, totalSessions, storage, byMime] = await Promise.all([
      prisma.file.count({ where: { userId } }),
      prisma.clip.count({ where: { userId } }),
      prisma.session.count({ where: { userId } }),
      prisma.file.aggregate({
        where: { userId },
        _sum: { size: true },
      }),
      prisma.file.groupBy({
        by: ['mimeType'],
        where: { userId },
        _count: { _all: true },
      }),
    ]);

    const storageUsed = Number(storage._sum.size ?? 0);
    const fileTypes: Record<string, number> = {};
    for (const row of byMime) {
      const category = row.mimeType.startsWith('video/')
        ? 'video'
        : row.mimeType.startsWith('audio/')
          ? 'audio'
          : row.mimeType === 'application/pdf'
            ? 'pdf'
            : 'document';
      fileTypes[category] = (fileTypes[category] ?? 0) + row._count._all;
    }

    // Flat shape: the web settings page reads totalFiles/storageUsed directly.
    res.json({
      totalFiles,
      totalClips,
      totalSessions,
      storageUsed,
      fileTypes,
      stats: {
        totalFiles,
        totalClips,
        totalSessions,
        storageUsed,
        fileTypes,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;