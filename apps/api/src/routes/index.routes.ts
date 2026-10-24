import { Router, Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { prisma } from '../config/db.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { requireSubscription } from '../middleware/subscription.js';
import { processVideoFile, processDocumentFile } from '../services/processing.service.js';
import { logger } from '../config/logger.js';

const router = Router();

const validateRequest = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

router.post(
  '/',
  authenticate,
  requireSubscription,
  [
    body('fileId').notEmpty().withMessage('File ID is required'),
  ],
  validateRequest,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { fileId } = req.body;

      const file = await prisma.file.findFirst({
        where: { id: fileId, userId: req.user!.userId },
      });

      if (!file) {
        return res.status(404).json({ error: 'File not found' });
      }

      if (!file.path) {
        return res.status(400).json({ error: 'File has no stored source to index' });
      }

      const previousStatus = file.status;
      await prisma.file.update({
        where: { id: fileId },
        data: { status: 'PROCESSING' as any },
      });

      try {
        const meta = (file.metadata as Record<string, unknown> | null) ?? {};
        const job = {
          id: `index:${fileId}`,
          fileId,
          inputPath: file.path,
          mimeType: file.mimeType,
          userId: req.user!.userId,
          fileVersion: typeof meta.version === 'number' ? meta.version : undefined,
          originalName: file.originalName,
        };
        const isMedia = file.mimeType.startsWith('video/') || file.mimeType.startsWith('audio/');
        // Reuse the shared indexing pipeline: it tries direct path access
        // and falls back to uploading bytes to the AI service, so re-index
        // works even when API and AI run in separate containers.
        if (isMedia) {
          await processVideoFile(job);
        } else {
          await processDocumentFile(job);
        }
        logger.info({ fileId }, 'File indexed successfully');
        return res.json({ success: true, message: 'Indexing completed' });
      } catch (aiError) {
        // A failed re-index must not downgrade a previously usable file.
        const restored = previousStatus === 'COMPLETED' ? 'COMPLETED' : 'FAILED';
        await prisma.file.update({
          where: { id: fileId },
          data: { status: restored as any },
        }).catch(() => undefined);
        logger.error({ aiError, fileId }, 'AI indexing failed');
        return res.status(500).json({ error: 'Indexing failed' });
      }
    } catch (error) {
      next(error);
    }
  }
);

export default router;