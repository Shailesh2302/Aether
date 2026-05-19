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
    const { name, avatar } = req.body;

    const user = await prisma.user.update({
      where: { id: req.user!.userId },
      data: { name, avatar },
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
    const [totalFiles, totalClips, totalSessions] = await Promise.all([
      prisma.file.count({ where: { userId: req.user!.userId } }),
      prisma.clip.count({ where: { userId: req.user!.userId } }),
      prisma.session.count({ where: { userId: req.user!.userId } }),
    ]);

    res.json({
      stats: {
        totalFiles,
        totalClips,
        totalSessions,
        fileTypes: [],
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;