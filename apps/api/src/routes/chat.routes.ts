import { Router, Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { aiService } from '../services/ai.service.js';
import { vectorService } from '../services/vector.service.js';
import { prisma } from '../config/db.js';
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
  [
    body('message').notEmpty().withMessage('Message is required'),
    body('sessionId').optional().isUUID().withMessage('Invalid session ID'),
  ],
  validateRequest,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { message, sessionId } = req.body;
      const userId = req.user!.userId;

      let session = null;
      if (sessionId) {
        session = await prisma.session.findFirst({
          where: { id: sessionId, userId },
        });
      }

      if (!session) {
        session = await prisma.session.create({
          data: {
            userId,
            title: message.slice(0, 50),
            type: 'CHAT',
          },
        });
      }

      await prisma.message.create({
        data: {
          sessionId: session.id,
          userId,
          role: 'USER',
          content: message,
        },
      });

      const userFiles = await prisma.file.findMany({
        where: { userId, status: 'COMPLETED' },
        select: { id: true, name: true },
      });

      let context = '';
      if (userFiles.length > 0) {
        try {
          const queryEmbedding = await aiService.createEmbedding(message);
          
          const searchResults = await vectorService.searchPoints(
            `user:${userId}`,
            queryEmbedding,
            5
          );

          if (searchResults.length > 0) {
            context = searchResults
              .map((r) => r.payload.text as string)
              .join('\n\n');
          }
        } catch (error) {
          logger.warn({ error }, 'Vector search failed, using context-free response');
        }
      }

      let assistantMessage: string;
      try {
        assistantMessage = await aiService.searchDocuments(message, context || undefined);
      } catch (error) {
        logger.error({ error }, 'AI service failed');
        assistantMessage = 'I apologize, but I encountered an error processing your request. Please try again.';
      }

      await prisma.message.create({
        data: {
          sessionId: session.id,
          userId,
          role: 'ASSISTANT',
          content: assistantMessage,
        },
      });

      res.json({
        message: assistantMessage,
        sessionId: session.id,
        sources: [],
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/stream',
  authenticate,
  [
    body('message').notEmpty().withMessage('Message is required'),
  ],
  validateRequest,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { message } = req.body;
      const userId = req.user!.userId;

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const userFiles = await prisma.file.findMany({
        where: { userId, status: 'COMPLETED' },
        select: { id: true, name: true },
      });

      let context = '';
      if (userFiles.length > 0) {
        try {
          const queryEmbedding = await aiService.createEmbedding(message);
          const searchResults = await vectorService.searchPoints(
            `user:${userId}`,
            queryEmbedding,
            5
          );

          if (searchResults.length > 0) {
            context = searchResults
              .map((r) => r.payload.text as string)
              .join('\n\n');
          }
        } catch (error) {
          logger.warn({ error }, 'Vector search failed');
        }
      }

      const messages = context
        ? [
            { role: 'system' as const, content: `You are a helpful assistant. Use the following context to answer questions:\n\nContext:\n${context}` },
            { role: 'user' as const, content: message },
          ]
        : [
            { role: 'system' as const, content: 'You are a helpful assistant.' },
            { role: 'user' as const, content: message },
          ];

      for await (const chunk of aiService.streamChatCompletion({ messages })) {
        res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
      }

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (error) {
      logger.error({ error }, 'Streaming chat error');
      res.write(`data: ${JSON.stringify({ error: 'Stream failed' })}\n\n`);
      res.end();
      next(error);
    }
  }
);

router.get(
  '/sessions',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const sessions = await prisma.session.findMany({
        where: { userId: req.user!.userId, type: 'CHAT' },
        orderBy: { updatedAt: 'desc' },
        include: {
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });

      res.json({ sessions });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/sessions/:sessionId',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const session = await prisma.session.findFirst({
        where: { id: req.params.sessionId, userId: req.user!.userId },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      res.json({ session });
    } catch (error) {
      next(error);
    }
  }
);

router.delete(
  '/sessions/:sessionId',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const session = await prisma.session.findFirst({
        where: { id: req.params.sessionId, userId: req.user!.userId },
      });

      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      await prisma.session.delete({
        where: { id: req.params.sessionId },
      });

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);

export default router;