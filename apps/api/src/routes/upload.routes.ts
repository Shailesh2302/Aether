import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { prisma } from '../config/db.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { storageService } from '../services/storage.service.js';
import { queueService } from '../services/queue.service.js';
import { config } from '../config/env.js';
import { logger } from '../config/logger.js';

const router = Router();

const storage = multer.memoryStorage();

const fileFilter = (req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimeTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'video/mp4',
    'video/webm',
    'video/avi',
    'video/quicktime',
    'audio/mpeg',
    'audio/wav',
    'audio/mp3',
    'audio/ogg',
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type'));
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: 500 * 1024 * 1024,
  },
  fileFilter,
});

router.post(
  '/',
  authenticate,
  upload.single('file'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const originalName = req.file.originalname;
      const mimeType = req.file.mimetype;
      const size = req.file.size;

      const storageResult = await storageService.saveFile(req.file.buffer, originalName);

      const file = await prisma.file.create({
        data: {
          userId: req.user!.userId,
          name: storageResult.path.split('/').pop() || originalName,
          originalName,
          mimeType,
          size: Number(BigInt(size)),
          path: storageResult.path,
          url: storageResult.url,
          status: 'PENDING',
        },
      });

      const isVideo = mimeType.startsWith('video/');
      const isAudio = mimeType.startsWith('audio/');
      const isDocument = 
        mimeType === 'application/pdf' ||
        mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

      if (isVideo || isAudio) {
        await queueService.addVideoProcessingJob({
          fileId: file.id,
          filePath: storageResult.path,
          mimeType,
          userId: req.user!.userId,
        });

        await prisma.file.update({
          where: { id: file.id },
          data: { status: 'PENDING' as any },
        });
      } else if (isDocument) {
        await queueService.addDocumentProcessingJob({
          fileId: file.id,
          filePath: storageResult.path,
          mimeType,
          userId: req.user!.userId,
        });

        await prisma.file.update({
          where: { id: file.id },
          data: { status: 'PENDING' as any },
        });
      }

      logger.info({
        fileId: file.id,
        userId: req.user!.userId,
        mimeType,
        size,
      }, 'File uploaded successfully');

      res.status(201).json({
        file: {
          id: file.id,
          name: file.name,
          originalName: file.originalName,
          mimeType: file.mimeType,
          size: Number(file.size),
          status: file.status,
          createdAt: file.createdAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/multiple',
  authenticate,
  upload.array('files', 10),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
      }

      const results = await Promise.all(
        req.files.map(async (file) => {
          const originalName = file.originalname;
          const mimeType = file.mimetype;
          const bufferSize = file.size;

          const storageResult = await storageService.saveFile(file.buffer, originalName);

          const dbFile = await prisma.file.create({
            data: {
              userId: req.user!.userId,
              name: storageResult.path.split('/').pop() || originalName,
              originalName,
              mimeType,
              size: Number(BigInt(bufferSize)),
              path: storageResult.path,
              url: storageResult.url,
              status: 'PENDING',
            },
          });

          const isMedia = mimeType.startsWith('video/') || mimeType.startsWith('audio/');
          const isDocument = 
            mimeType === 'application/pdf' ||
            mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
            mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

          if (isMedia) {
            await queueService.addVideoProcessingJob({
              fileId: dbFile.id,
              filePath: storageResult.path,
              mimeType,
              userId: req.user!.userId,
            });
            await prisma.file.update({
              where: { id: dbFile.id },
              data: { status: 'PENDING' as any },
            });
          } else if (isDocument) {
            await queueService.addDocumentProcessingJob({
              fileId: dbFile.id,
              filePath: storageResult.path,
              mimeType,
              userId: req.user!.userId,
            });
            await prisma.file.update({
              where: { id: dbFile.id },
              data: { status: 'PENDING' as any },
            });
          }

          return {
            id: dbFile.id,
            name: dbFile.name,
            originalName: dbFile.originalName,
            mimeType: dbFile.mimeType,
            size: Number(dbFile.size),
            status: dbFile.status,
            createdAt: dbFile.createdAt,
          };
        })
      );

      logger.info({
        count: results.length,
        userId: req.user!.userId,
      }, 'Multiple files uploaded');

      res.status(201).json({ files: results });
    } catch (error) {
      next(error);
    }
  }
);

export default router;