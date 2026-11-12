import { Router, Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { requireSubscription } from '../middleware/subscription.js';
import { aiService } from '../services/ai.service.js';
import { vectorService } from '../services/vector.service.js';
import { prisma } from '../config/db.js';
import { config } from '../config/env.js';
import { logger } from '../config/logger.js';
import { fetchWithTimeout } from '../utils/helpers.js';

const router = Router();

const validateRequest = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

interface ChatSource {
  text: string;
  score: number;
  fileId: string;
  timestamp?: number;
  version?: number;
  originalName?: string;
}

interface RetrievedContext {
  context: string;
  sources: ChatSource[];
  versionNotes: Array<{ fileId: string; originalName: string; version: number; uploadedAt: string }>;
  versionConflict: { document: string; versions: number[] } | null;
}

/**
 * Interactive chat should never wait a minute for retrieval. Embeddings and
 * Qdrant calls have their own long timeouts for indexing, so cap the whole
 * retrieval step here and answer without context when it is unhealthy.
 */
const RETRIEVAL_DEADLINE_MS = 6_000;
const RETRIEVAL_COOLDOWN_MS = 15_000;
let retrievalCooldownUntil = 0;

const emptyRetrievedContext = (): RetrievedContext => ({
  context: '',
  sources: [],
  versionNotes: [],
  versionConflict: null,
});

function withDeadline<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`retrieval exceeded ${ms}ms`)), ms);
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

async function retrieveChatContext(
  userId: string,
  message: string,
  fileIds: string[],
): Promise<RetrievedContext> {
  if (Date.now() < retrievalCooldownUntil) {
    return emptyRetrievedContext();
  }
  try {
    return await withDeadline(
      doRetrieveChatContext(userId, message, fileIds),
      RETRIEVAL_DEADLINE_MS
    );
  } catch (error) {
    // Stop paying the same timeout on every message while the provider or
    // Qdrant is down. The next attempt after the cooldown re-probes.
    retrievalCooldownUntil = Date.now() + RETRIEVAL_COOLDOWN_MS;
    throw error;
  }
}

/**
 * Retrieves and validates RAG context once in the Node API. The AI service is
 * then called without `user_id` so it does not repeat the embedding + Qdrant
 * search (which previously doubled latency on every chat message).
 */
async function doRetrieveChatContext(
  userId: string,
  message: string,
  fileIds: string[],
): Promise<RetrievedContext> {
  const result: RetrievedContext = {
    context: '',
    sources: [],
    versionNotes: [],
    versionConflict: null,
  };

  const queryEmbedding = await aiService.createEmbedding(message, RETRIEVAL_DEADLINE_MS);
  const collectionName = `user_${userId}`.replace(/-/g, '_');

  const filterConditions: Record<string, unknown> | undefined =
    fileIds.length === 1 ? { file_id: fileIds[0] } : undefined;

  const searchResults = await vectorService.searchPoints(
    collectionName,
    queryEmbedding,
    10,
    0.0,
    filterConditions,
  );

  const scoped = fileIds.length > 1
    ? searchResults.filter((r) => fileIds.includes(String((r.payload as Record<string, unknown>).file_id)))
    : searchResults;

  if (scoped.length === 0) return result;

  // Resolve owning files first: only context from files that still exist for
  // this user may be sent to the model. This prevents deleted documents from
  // leaking into answers via stale vectors.
  const hitIds = [...new Set(scoped.map((r) => String((r.payload as Record<string, unknown>).file_id ?? '')))].filter(Boolean);
  const hitFiles = hitIds.length > 0
    ? await prisma.file.findMany({
        where: { id: { in: hitIds }, userId },
        select: { id: true, originalName: true, createdAt: true, metadata: true },
      })
    : [];
  const fileById = new Map(hitFiles.map((f) => [f.id, f]));
  const validScoped = scoped.filter((r) => fileById.has(String((r.payload as Record<string, unknown>).file_id ?? '')));

  if (validScoped.length === 0) return result;

  const versionOf = (fid: string): number => {
    const f = fileById.get(fid);
    const v = Number((f?.metadata as Record<string, unknown> | null)?.version ?? 1);
    return Number.isFinite(v) && v > 0 ? v : 1;
  };

  result.context = validScoped.map((r) => r.payload.text as string).join('\n\n');
  result.sources = validScoped.map((r) => {
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
  });

  result.versionNotes = hitFiles.map((f) => ({
    fileId: f.id,
    originalName: f.originalName,
    version: versionOf(f.id),
    uploadedAt: f.createdAt.toISOString(),
  }));

  // Conflict: context spans 2+ versions of the same document name.
  const byDoc = new Map<string, Set<number>>();
  for (const n of result.versionNotes) {
    const key = n.originalName.toLowerCase();
    if (!byDoc.has(key)) byDoc.set(key, new Set());
    byDoc.get(key)!.add(n.version);
  }
  for (const [doc, versions] of byDoc) {
    if (versions.size > 1) {
      const original = result.versionNotes.find((n) => n.originalName.toLowerCase() === doc)?.originalName ?? doc;
      result.versionConflict = { document: original, versions: [...versions].sort((a, b) => a - b) };
      break;
    }
  }

  return result;
}

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
      let sources: ChatSource[] = [];
      let versionNotes: RetrievedContext['versionNotes'] = [];
      let versionConflict: RetrievedContext['versionConflict'] = null;

      try {
        const retrieved = await retrieveChatContext(userId, message, fileIds);
        context = retrieved.context;
        sources = retrieved.sources;
        versionNotes = retrieved.versionNotes;
        versionConflict = retrieved.versionConflict;
      } catch (error) {
        logger.warn(
          { err: error instanceof Error ? error.message : String(error) },
          'Vector search failed, using context-free response'
        );
      }

      let assistantMessage: string;
      try {
        // The Node API already retrieved context above, so use /chat/simple
        // (no second embedding + Qdrant search inside the AI service).
        let prompt = context
          ? `You are a helpful assistant. Use the following context to answer questions:\n\n${context}`
          : 'You are a helpful assistant specialized in answering questions about uploaded documents and videos.';
        if (versionConflict) {
          const vs = versionConflict.versions.map((v) => `v${v}`).join(' and ');
          prompt += `\n\nImportant: the context above mixes ${vs} of "${versionConflict.document}". `
            + `These versions may disagree. Attribute each claim to its version (e.g. "According to v2..."), `
            + `and if the versions conflict, say so explicitly instead of blending them into one answer.`;
        }

        const aiResponse = await fetchWithTimeout(`${config.aiServiceUrl}/api/v1/chat/simple`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message, system_prompt: prompt }),
        }, 30_000);

        if (!aiResponse.ok) {
          throw new Error(`AI service returned ${aiResponse.status}`);
        }
        const data = await aiResponse.json() as { message?: string };
        assistantMessage = data.message || '';
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
      const { message, sessionId } = req.body;
      const userId = req.user!.userId;
      const rawIds = req.body.fileIds ?? req.body.fileId;
      const fileIds: string[] = Array.isArray(rawIds)
        ? rawIds.filter((id) => typeof id === 'string' && id.length > 0)
        : typeof rawIds === 'string' && rawIds.length > 0
          ? [rawIds]
          : [];

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
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      // Disable proxy buffering (nginx and friends) so tokens arrive promptly.
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders?.();

      res.write(`data: ${JSON.stringify({ sessionId: session.id })}\n\n`);

      let context = '';
      let sources: ChatSource[] = [];
      let versionNotes: RetrievedContext['versionNotes'] = [];
      let versionConflict: RetrievedContext['versionConflict'] = null;

      try {
        const retrieved = await retrieveChatContext(userId, message, fileIds);
        context = retrieved.context;
        sources = retrieved.sources;
        versionNotes = retrieved.versionNotes;
        versionConflict = retrieved.versionConflict;
      } catch (error) {
        logger.warn(
          { err: error instanceof Error ? error.message : String(error) },
          'Vector search failed'
        );
      }

      if (sources.length > 0 || versionNotes.length > 0) {
        res.write(`data: ${JSON.stringify({ sources, versionNotes, versionConflict })}\n\n`);
      }

      let systemPrompt = context
        ? `You are a helpful assistant. Use the following context to answer questions:\n\nContext:\n${context}`
        : 'You are a helpful assistant.';
      if (versionConflict) {
        const vs = versionConflict.versions.map((v) => `v${v}`).join(' and ');
        systemPrompt += `\n\nImportant: the context above mixes ${vs} of "${versionConflict.document}". `
          + `These versions may disagree. Attribute each claim to its version (e.g. "According to v2..."), `
          + `and if the versions conflict, say so explicitly instead of blending them into one answer.`;
      }

      const messages = [
        { role: 'system' as const, content: systemPrompt },
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
        // Surface truncation instead of silently ending with a partial answer.
        // The client keeps the chunks it already received and shows this error.
        if (!res.writableEnded) {
          res.write(
            `data: ${JSON.stringify({
              error: fullResponse
                ? 'The response was interrupted. Please try again.'
                : 'The assistant is unavailable. Please try again.',
            })}\n\n`
          );
        }
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
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: 'Stream failed' })}\n\n`);
        res.end();
        return;
      }
      next(error);
    }
  }
);

router.get(
  '/sessions',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const limit = Math.min(Math.max(Number(req.query.limit) || 30, 1), 100);
      const cursor = typeof req.query.cursor === 'string' && req.query.cursor ? req.query.cursor : undefined;

      const sessions = await prisma.session.findMany({
        where: { userId: req.user!.userId, type: 'CHAT' },
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        include: {
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });

      const hasMore = sessions.length > limit;
      const page = hasMore ? sessions.slice(0, limit) : sessions;
      res.json({
        sessions: page,
        nextCursor: hasMore && page.length > 0 ? page[page.length - 1].id : null,
        hasMore,
      });
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
      const messageLimit = Math.min(
        Math.max(Number(req.query.messageLimit) || 500, 1),
        1000
      );
      const session = await prisma.session.findFirst({
        where: { id: req.params.sessionId, userId: req.user!.userId },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
            take: messageLimit,
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