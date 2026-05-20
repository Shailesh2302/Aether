import { Router, Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { config } from '../config/env.js';
import { logger } from '../config/logger.js';

const router = Router();

router.get('/uploads/:filename', (req: Request, res: Response, next: NextFunction) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(config.storage.uploadDir, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.sendFile(filePath);
  } catch (error) {
    logger.error({ error }, 'Error serving upload file');
    next(error);
  }
});

router.get('/clips/:filename', (req: Request, res: Response, next: NextFunction) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(config.storage.clipsDir, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.sendFile(filePath);
  } catch (error) {
    logger.error({ error }, 'Error serving clip file');
    next(error);
  }
});

export default router;