import { Router, Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { requireSubscription } from '../middleware/subscription.js';
import { aiService } from '../services/ai.service.js';
import { vectorService } from '../services/vector.service.js';
import { prisma } from '../config/db.js';
import { config } from '../config/env.js';
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
    body('message').notEmpty().withMessage('Message is required'),
    body('sessionId').optional().isUUID().withMessage('Invalid session ID'),
  ],
  validateRequest,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { message, sessionId } = req.body;
      const userId = req.user!.userId;
      // Accept both `fileId` (string) and `fileIds` (string[]) for scoping.
      const rawIds = req.body.fileIds ?? req.body.fileId;
      const fileIds: string[] = Array.isArray(rawIds)
        ? rawIds.filter((id) => typeof id === 'string' && id.length > 0)
        : typeof rawIds === 'string' && rawIds.length > 0
          ? [rawIds]
          : [];
      const fileId: string | undefined = fileIds[0];

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

      let context = '';
      const sources: Array<{text: string; score: number; fileId: string; timestamp?: number; version?: number; originalName?: string}> = [];
      // Version conflict info surfaced to the client so the UI can show
      // which document versions an answer draws from.
      let versionNotes: Array<{fileId: string; originalName: string; version: number; uploadedAt: string}> = [];
      let versionConflict: { document: string; versions: number[] } | null = null;

      try {
        const queryEmbedding = await aiService.createEmbedding(message);
        const collectionName = `user_${userId}`.replace(/-/g, '_');
        
        let filterConditions: Record<string, unknown> | undefined;
        if (fileIds.length === 1) {
          filterConditions = { file_id: fileIds[0] };
        }

        const searchResults = await vectorService.searchPoints(
          collectionName,
          queryEmbedding,
          10,
          0.0,
          filterConditions
        );

        const scoped = fileIds.length > 1
          ? searchResults.filter((r) => fileIds.includes(String((r.payload as Record<string, unknown>).file_id)))
          : searchResults;

        if (scoped.length > 0) {
          // Resolve owning files first: only context from files that still
          // exist for this user may be sent to the model. This prevents
          // deleted documents from leaking into answers via stale vectors.
          const hitIds = [...new Set(scoped.map((r) => String((r.payload as Record<string, unknown>).file_id ?? '')))].filter(Boolean);
          const hitFiles = hitIds.length > 0
            ? await prisma.file.findMany({
                where: { id: { in: hitIds }, userId },
                select: { id: true, originalName: true, createdAt: true, metadata: true },
              })
            : [];
          const fileById = new Map(hitFiles.map((f) => [f.id, f]));
          const validScoped = scoped.filter((r) => fileById.has(String((r.payload as Record<string, unknown>).file_id ?? '')));

          const versionOf = (fid: string): number => {
            const f = fileById.get(fid);
            const v = Number((f?.metadata as Record<string, unknown> | null)?.version ?? 1);
            return Number.isFinite(v) && v > 0 ? v : 1;
          };

          if (validScoped.length > 0) {
            context = validScoped
              .map((r) => r.payload.text as string)
              .join('\n\n');

            sources.push(...validScoped.map((r) => {
              const payload = r.payload as Record<string, unknown>;
              const fid = String(payload.file_id ?? '');
              const f = fileById.get(fid);
              return {
                text: payload.text as string,
                score: r.score,
                fileId: fid,
                timestamp: (payload.metadata as Record<string, unknown>)?.start_sec as number,
                version: versionOf(fid),
                originalName: f?.originalName ?? String(payload.fileName ?? ''),
              };
            }));

            versionNotes = hitFiles.map((f) => ({
              fileId: f.id,
              originalName: f.originalName,
              version: versionOf(f.id),
              uploadedAt: f.createdAt.toISOString(),
            }));

            // Conflict: context spans 2+ versions of the same document name.
            const byDoc = new Map<string, Set<number>>();
            for (const n of versionNotes) {
              const key = n.originalName.toLowerCase();
              if (!byDoc.has(key)) byDoc.set(key, new Set());
              byDoc.get(key)!.add(n.version);
            }
            for (const [doc, versions] of byDoc) {
              if (versions.size > 1) {
                const original = versionNotes.find((n) => n.originalName.toLowerCase() === doc)?.originalName ?? doc;
                versionConflict = { document: original, versions: [...versions].sort((a, b) => a - b) };
                break;
              }
            }
          }
        }
      } catch (error) {
        logger.warn({ error }, 'Vector search failed, using context-free response');
      }

      let assistantMessage: string;
      try {
        const params = new URLSearchParams({
          user_id: userId,
          ...(fileId ? { file_id: fileId } : {}),
        });

        const requestBody: any = {
          message,
          collection: `user_${userId}`.replace(/-/g, '_'),
          top_k: 5,
        };
        if (context) {
          let prompt = `You are a helpful assistant. Use the following context to answer questions:\n\n${context}`;
          if (versionConflict) {
            const vs = versionConflict.versions.map((v) => `v${v}`).join(' and ');
            prompt += `\n\nImportant: the context above mixes ${vs} of "${versionConflict.document}". `
              + `These versions may disagree. Attribute each claim to its version (e.g. "According to v2..."), `
              + `and if the versions conflict, say so explicitly instead of blending them into one answer.`;
          }
          requestBody.system_prompt = prompt;
        }

        const aiResponse = await fetch(`${config.aiServiceUrl}/api/v1/chat?${params}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });

        if (aiResponse.ok) {
          const data = await aiResponse.json() as any;
          assistantMessage = data.message || '';
          const aiSources: Array<{text: string; score: number; fileId: string}> = (data.sources || []).map((s: any) => ({
            text: s.text || s.content || '',
            score: s.score || 0,
            fileId: s.file_id || fileId || '',
          }));
          // Enrich AI-service sources with version labels like local ones.
          const aiIds = [...new Set(aiSources.map((s) => s.fileId))].filter(Boolean);
          if (aiIds.length > 0) {
            const aiFiles = await prisma.file.findMany({
              where: { id: { in: aiIds }, userId },
              select: { id: true, originalName: true, createdAt: true, metadata: true },
            });
            const aiById = new Map(aiFiles.map((f) => [f.id, f]));
            for (const s of aiSources) {
              const f = aiById.get(s.fileId);
              const v = Number((f?.metadata as Record<string, unknown> | null)?.version ?? 1);
              (s as Record<string, unknown>).version = Number.isFinite(v) && v > 0 ? v : 1;
              (s as Record<string, unknown>).originalName = f?.originalName ?? '';
            }
          }
          sources.push(...aiSources);
        } else {
          throw new Error('AI service returned error');
        }
      } catch (aiError) {
        logger.warn({ aiError }, 'AI service failed, falling back to direct NVIDIA API');
        try {
          assistantMessage = await aiService.searchDocuments(message, context || undefined);
        } catch (error) {
          logger.error({ error }, 'AI service failed');
          assistantMessage = 'I apologize, but I encountered an error processing your request. Please try again.';
        }
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
        sources,
        versionNotes,
        versionConflict,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/stream',
  authenticate,
  requireSubscription,
  [
    body('message').notEmpty().withMessage('Message is required'),
  ],
  validateRequest,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { message, fileId, sessionId } = req.body;
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

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      res.write(`data: ${JSON.stringify({ sessionId: session.id })}\n\n`);

      let context = '';
      try {
        const queryEmbedding = await aiService.createEmbedding(message);
        const collectionName = `user_${userId}`.replace(/-/g, '_');

        let filterConditions: Record<string, unknown> | undefined;
        if (fileId) {
          filterConditions = { file_id: fileId };
        }

        const searchResults = await vectorService.searchPoints(
          collectionName,
          queryEmbedding,
          10,
          0.5,
          filterConditions
        );

        const hitIds = [...new Set(searchResults.map((r) => String((r.payload as Record<string, unknown>).file_id ?? '')))].filter(Boolean);
        const ownedHits = hitIds.length > 0
          ? await prisma.file.findMany({ where: { id: { in: hitIds }, userId }, select: { id: true } })
          : [];
        const ownedIds = new Set(ownedHits.map((f) => f.id));
        const validResults = searchResults.filter((r) => ownedIds.has(String((r.payload as Record<string, unknown>).file_id ?? '')));

        if (validResults.length > 0) {
          context = validResults
            .map((r) => r.payload.text as string)
            .join('\n\n');
        }
      } catch (error) {
        logger.warn({ error }, 'Vector search failed');
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

      let fullResponse = '';
      try {
        for await (const chunk of aiService.streamChatCompletion({ messages })) {
          fullResponse += chunk;
          res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
        }
      } catch (streamError) {
        logger.error({ streamError }, 'LLM stream failed mid-response');
      }

      if (fullResponse.trim()) {
        await prisma.message.create({
          data: {
            sessionId: session.id,
            userId,
            role: 'ASSISTANT',
            content: fullResponse,
          },
        });
      }

      res.write(`data: ${JSON.stringify({ done: true, sessionId: session.id })}\n\n`);
      res.end();
    } catch (error) {
      logger.error({ error }, 'Streaming chat error');
      res.write(`data: ${JSON.stringify({ error: 'Stream failed' })}\n\n`);
      res.end();
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