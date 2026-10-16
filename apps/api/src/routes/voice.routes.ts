import { Router, Response, NextFunction } from 'express';
import multer from 'multer';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { requireSubscription } from '../middleware/subscription.js';
import { config } from '../config/env.js';
import { fetchWithTimeout } from '../utils/helpers.js';
import { logger } from '../config/logger.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // voice commands are seconds long
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('audio/') || file.mimetype === 'application/octet-stream') {
      cb(null, true);
    } else {
      cb(new Error('Only audio uploads are accepted'));
    }
  },
});

/**
 * Transcribe a short voice command with our own Whisper backend.
 * Used by the voice assistant when the browser's speech service is
 * unreachable (blocked Google endpoints, Firefox/Safari, etc.).
 *   POST /api/voice/transcribe  (multipart: file=<audio>)
 */
router.post(
  '/transcribe',
  authenticate,
  requireSubscription,
  upload.single('file'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No audio uploaded' });
      }
      const form = new FormData();
      form.append('file', new Blob([new Uint8Array(req.file.buffer)], { type: req.file.mimetype }), 'command.webm');

      const aiResponse = await fetchWithTimeout(
        `${config.aiServiceUrl}/api/v1/transcription`,
        { method: 'POST', body: form },
        120_000
      );
      if (!aiResponse.ok) {
        throw new Error(`Transcription service returned ${aiResponse.status}`);
      }
      const data = await aiResponse.json() as { text?: string; language?: string; duration?: number };
      res.json({ text: data.text || '', language: data.language || '', duration: data.duration || 0 });
    } catch (error) {
      logger.error({ error }, 'Voice transcription failed');
      next(error);
    }
  }
);

export default router;
