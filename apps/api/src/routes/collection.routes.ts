import { Router, Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { prisma } from '../config/db.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

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
    const collections = await prisma.collection.findMany({
      where: { userId: req.user!.userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: { select: { files: true } },
        files: {
          include: { file: { select: { id: true, originalName: true, mimeType: true, status: true } } },
          take: 5,
        },
      },
    });
    res.json({ collections });
  } catch (error) {
    next(error);
  }
});

router.post(
  '/',
  authenticate,
  [body('name').isLength({ min: 1, max: 80 }).withMessage('Name is required')],
  validateRequest,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const collection = await prisma.collection.create({
        data: { userId: req.user!.userId, name: req.body.name.trim(), description: req.body.description },
      });
      res.status(201).json({ collection });
    } catch (error) {
      next(error);
    }
  }
);

router.get('/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const collection = await prisma.collection.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
      include: {
        files: {
          include: {
            file: {
              select: {
                id: true, name: true, originalName: true, mimeType: true, size: true,
                url: true, status: true, tags: true, isFavorite: true, createdAt: true, updatedAt: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!collection) return res.status(404).json({ error: 'Collection not found' });
    res.json({
      collection: {
        ...collection,
        files: collection.files.map((cf) => ({ ...cf.file, size: Number(cf.file.size) })),
      },
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const collection = await prisma.collection.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
      select: { id: true },
    });
    if (!collection) return res.status(404).json({ error: 'Collection not found' });
    await prisma.collection.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.post(
  '/:id/files',
  authenticate,
  [body('fileId').notEmpty().withMessage('File ID is required')],
  validateRequest,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const collection = await prisma.collection.findFirst({
        where: { id: req.params.id, userId: req.user!.userId },
        select: { id: true },
      });
      if (!collection) return res.status(404).json({ error: 'Collection not found' });
      const file = await prisma.file.findFirst({
        where: { id: req.body.fileId, userId: req.user!.userId },
        select: { id: true },
      });
      if (!file) return res.status(404).json({ error: 'File not found' });
      await prisma.collectionFile.upsert({
        where: { collectionId_fileId: { collectionId: req.params.id, fileId: req.body.fileId } },
        create: { collectionId: req.params.id, fileId: req.body.fileId },
        update: {},
      });
      res.status(201).json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);

router.delete('/:id/files/:fileId', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const collection = await prisma.collection.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
      select: { id: true },
    });
    if (!collection) return res.status(404).json({ error: 'Collection not found' });
    await prisma.collectionFile.deleteMany({
      where: { collectionId: req.params.id, fileId: req.params.fileId },
    });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
