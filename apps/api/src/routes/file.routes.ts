import { Router, Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { randomUUID } from 'crypto';
import path from 'path';
import fs from 'fs';
import os from 'os';
import dns from 'dns/promises';
import net from 'net';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import { prisma } from '../config/db.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { authenticateMedia } from '../middleware/mediaAuth.js';
import { requireSubscription } from '../middleware/subscription.js';
import { storageService } from '../services/storage.service.js';
import { vectorService } from '../services/vector.service.js';
import { generateThumbnail, getVideoMetadata } from '../utils/ffmpeg.js';
import { config } from '../config/env.js';
import { queueService } from '../services/queue.service.js';
import { processVideoFile, processDocumentFile } from '../services/processing.service.js';
import { logger } from '../config/logger.js';

const router = Router();

const THUMBNAIL_DIR = './storage/thumbnails';

const isVideoOrAudio = (mimeType: string) =>
  mimeType.startsWith('video/') || mimeType.startsWith('audio/');

/**
 * Absolute URL for a stored file. Prefer the request's public origin so
 * downloads/share links work behind a reverse proxy (Caddy, Render, etc.)
 * instead of leaking the container's internal localhost address.
 */
const publicFileUrl = (req: Request, relativeOrAbsolute: string | null, fallbackPath: string): string => {
  if (relativeOrAbsolute && /^https?:\/\//i.test(relativeOrAbsolute)) {
    return relativeOrAbsolute;
  }
  const relative = relativeOrAbsolute || fallbackPath;
  const normalized = relative.startsWith('/') ? relative : `/${relative}`;
  return `${req.protocol}://${req.get('host')}${normalized}`;
};

const serializeFile = (file: {
  id: string; name: string; originalName: string; mimeType: string;
  size: bigint | number; path: string; url: string | null; status: unknown;
  metadata: unknown; createdAt: Date; updatedAt: Date;
  tags?: string[]; isFavorite?: boolean; sourceUrl?: string | null;
}) => {
  const meta = (file.metadata as Record<string, unknown> | null) ?? null;
  return {
    id: file.id,
    name: file.name,
    originalName: file.originalName,
    mimeType: file.mimeType,
    size: Number(file.size),
    path: file.path,
    url: file.url,
    status: file.status,
    metadata: meta,
    tags: file.tags ?? [],
    isFavorite: file.isFavorite ?? false,
    sourceUrl: file.sourceUrl ?? null,
    // The web UI already renders these when present.
    thumbnailUrl: isVideoOrAudio(file.mimeType) ? `/api/files/${file.id}/thumbnail` : null,
    duration: typeof meta?.duration === 'number' ? (meta.duration as number) : null,
    createdAt: file.createdAt,
    updatedAt: file.updatedAt,
  };
};

const validateRequest = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

router.get('/', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const files = await prisma.file.findMany({
      where: { userId: req.user!.userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        originalName: true,
        mimeType: true,
        size: true,
        status: true,
        url: true,
        tags: true,
        isFavorite: true,
        sourceUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    const serialized = files.map((f) => serializeFile(f as never));
    res.json({ files: serialized });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const file = await prisma.file.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
    });

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.json({
      file: serializeFile(file as never),
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const file = await prisma.file.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
    });

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Best-effort blob removal. Failed imports have no local path and a
    // missing file on disk must not block deleting the database row.
    if (file.path && file.path.trim()) {
      try {
        await storageService.deleteFile(file.path);
      } catch (storageError) {
        const code = (storageError as NodeJS.ErrnoException)?.code;
        if (code !== 'ENOENT') {
          logger.warn({ storageError, fileId: file.id }, 'Storage delete failed, continuing with metadata cleanup');
        }
      }
    }

    // Remove every indexed chunk so deleted content can never surface in
    // semantic search or chat context again (search reads Qdrant directly).
    try {
      const collection = vectorService.getCollectionName(req.user!.userId);
      await vectorService.deletePointsByFilter(collection, { file_id: req.params.id });
    } catch (vectorError) {
      logger.warn({ vectorError, fileId: req.params.id }, 'Vector cleanup failed');
    }

    // Clean up cached thumbnails for this file.
    try {
      const entries = fs.readdirSync(THUMBNAIL_DIR);
      for (const entry of entries) {
        if (entry.startsWith(`${req.params.id}_`)) {
          fs.unlinkSync(path.join(THUMBNAIL_DIR, entry));
        }
      }
    } catch {
      // thumbnails dir may not exist - nothing to clean
    }

    await prisma.file.delete({
      where: { id: req.params.id },
    });

    logger.info({ fileId: req.params.id, userId: req.user!.userId }, 'File deleted');
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.get('/:id/download', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {  try {
    const file = await prisma.file.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
    });

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Build from the stored public URL when possible; `getDownloadUrl`
    // relies on a configured base that is often container-local.
    const fallback = `/storage/uploads/${path.basename(file.path || file.name)}`;
    const downloadUrl = publicFileUrl(req, file.url, fallback);
    res.json({ url: downloadUrl });
  } catch (error) {
    next(error);
  }
});

/**
 * Video frame thumbnail, generated on demand with ffmpeg and cached.
 * `?t=` selects the timestamp in seconds (defaults to 1).
 */
router.get('/:id/thumbnail', authenticateMedia, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const file = await prisma.file.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
    });

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    if (!isVideoOrAudio(file.mimeType)) {
      return res.status(400).json({ error: 'Thumbnails are only available for video/audio files' });
    }

    if (!fs.existsSync(file.path)) {
      return res.status(404).json({ error: 'Source media not found' });
    }

    const t = Math.max(0, Number(req.query.t) || 1);
    const cacheName = `${file.id}_${Math.round(t)}.jpg`;
    const cachePath = path.join(THUMBNAIL_DIR, cacheName);
    fs.mkdirSync(THUMBNAIL_DIR, { recursive: true });

    if (!fs.existsSync(cachePath)) {
      try {
        await generateThumbnail(path.resolve(file.path), path.resolve(cachePath), t);
      } catch (thumbErr) {
        logger.warn({ thumbErr, fileId: file.id }, 'Thumbnail generation failed');
        return res.status(500).json({ error: 'Could not generate thumbnail' });
      }
    }

    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.sendFile(path.resolve(cachePath));
  } catch (error) {
    next(error);
  }
});

/**
 * Export Center: transcript / summary downloads.
 *   GET /api/files/:id/export/txt|srt|vtt|md|json
 */
router.get('/:id/export/:format', authenticateMedia, requireSubscription, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const format = String(req.params.format).toLowerCase();
    if (!['txt', 'srt', 'vtt', 'md', 'json'].includes(format)) {
      return res.status(400).json({ error: 'Format must be one of txt, srt, vtt, md, json' });
    }
    const file = await prisma.file.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
    });
    if (!file) return res.status(404).json({ error: 'File not found' });
    if (file.status !== 'COMPLETED') {
      return res.status(409).json({ error: 'File is still processing - export will be ready when it completes' });
    }

    const base = file.originalName.replace(/\.[^.]+$/, '');
    const meta = (file.metadata as Record<string, unknown> | null) ?? {};

    if (format === 'md' || format === 'json') {
      const summary = meta.videoSummary as Record<string, unknown> | undefined;
      if (!summary || typeof summary.summary !== 'string') {
        return res.status(404).json({ error: 'No summary yet - generate one first' });
      }
      if (format === 'json') {
        res.setHeader('Content-Disposition', `attachment; filename="${base}.summary.json"`);
        return res.json({ file: file.originalName, exportedAt: new Date().toISOString(), summary });
      }
      const topics = (summary.topics as string[] | undefined) ?? [];
      const themes = (summary.key_themes as string[] | undefined) ?? [];
      const md = `# ${file.originalName}\n\nExported ${new Date().toISOString()}\n\n## Summary\n\n${summary.summary}\n`
        + (topics.length > 0 ? `\n## Topics\n\n${topics.map((t) => `- ${t}`).join('\n')}\n` : '')
        + (themes.length > 0 ? `\n## Key themes\n\n${themes.map((t) => `- ${t}`).join('\n')}\n` : '');
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${base}.summary.md"`);
      return res.send(md);
    }

    const collection = `user_${req.user!.userId}`.replace(/-/g, '_');
    const chunks = await vectorService.scrollPoints(collection, file.id);
    if (chunks.length === 0) {
      return res.status(404).json({ error: 'No transcript found for this file' });
    }

    // Prefer real timed segments (audio/video transcripts).
    let segments: Array<{ start: number; end: number; text: string }> = [];
    for (const c of chunks) {
      const segs = c.metadata.segments as Array<{ start_sec: number; end_sec: number; text: string }> | undefined;
      if (Array.isArray(segs) && segs.length > 0) {
        for (const s of segs) {
          if (s && typeof s.text === 'string' && s.text.trim()) {
            segments.push({ start: Number(s.start_sec) || 0, end: Number(s.end_sec) || 0, text: s.text.trim() });
          }
        }
        break;
      }
    }

    const stamp = (sec: number, sep: string) => {
      const h = Math.floor(sec / 3600);
      const m = Math.floor((sec % 3600) / 60);
      const s = Math.floor(sec % 60);
      const ms = Math.floor((sec % 1) * 1000);
      const pad = (n: number, l = 2) => String(n).padStart(l, '0');
      return `${pad(h)}:${pad(m)}:${pad(s)}${sep}${pad(ms, 3)}`;
    };

    if (format === 'txt') {
      const body = segments.length > 0
        ? segments.map((s) => s.text).join('\n')
        : chunks.map((c) => c.text).join('\n\n');
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${base}.txt"`);
      return res.send(body);
    }

    // Older media indexed before timestamps were stored still deserves a
    // downloadable subtitle. Distribute the stored chunks over the media
    // duration so SRT/VTT exports work instead of failing with a 400.
    if (segments.length === 0 && isVideoOrAudio(file.mimeType) && chunks.length > 0) {
      const duration = typeof meta.duration === 'number' && meta.duration > 0
        ? meta.duration
        : Math.max(chunks.length * 5, 5);
      const totalChars = chunks.reduce((sum, c) => sum + Math.max(c.text.length, 1), 0);
      let cursor = 0;
      for (const chunk of chunks) {
        const weight = Math.max(chunk.text.length, 1) / totalChars;
        const end = Math.min(duration, cursor + duration * weight);
        segments.push({ start: cursor, end: Math.max(end, cursor + 0.5), text: chunk.text.trim() });
        cursor = end;
      }
    }

    if (segments.length === 0) {
      return res.status(400).json({ error: 'This file has no timed transcript - txt export is available instead' });
    }
    if (format === 'srt') {
      const body = segments.map((s, i) => `${i + 1}\n${stamp(s.start, ',')} --> ${stamp(s.end, ',')}\n${s.text}\n`).join('\n');
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${base}.srt"`);
      return res.send(body);
    }
    // vtt
    const body = `WEBVTT\n\n${segments.map((s) => `${stamp(s.start, '.')} --> ${stamp(s.end, '.')}\n${s.text}\n`).join('\n')}`;
    res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${base}.vtt"`);
    return res.send(body);
  } catch (error) {
    next(error);
  }
});

/**
 * SSRF guard for URL imports: the downloader (AI service) must never be
 * pointed at internal infrastructure (cloud metadata, localhost, LAN).
 */
async function assertPublicUrl(raw: string): Promise<URL> {
  const parsed = new URL(raw);
  if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname) {
    throw new Error('Only http(s) URLs can be imported');
  }
  const hosts = await dns.lookup(parsed.hostname, { all: true }).catch(() => []);
  const ips = hosts.map((h) => h.address);
  if (parsed.hostname === 'localhost' || ips.length === 0) {
    throw new Error('URL must resolve to a public address');
  }
  for (const ip of ips) {
    if (
      net.isIP(ip) === 0 ||
      ip.startsWith('127.') || ip === '::1' ||
      ip.startsWith('10.') || ip.startsWith('192.168.') ||
      ip.startsWith('169.254.') || ip === '0.0.0.0' ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ||
      ip.startsWith('fc') || ip.startsWith('fd')
    ) {
      throw new Error('URL must resolve to a public address');
    }
  }
  return parsed;
}

/**
 * Import remote media (YouTube/Vimeo/direct file URL) in the background.
 *   POST /api/files/import  { url }
 * Responds 202 with the PENDING file; download + processing finish async.
 */
router.post(
  '/import',
  authenticate,
  requireSubscription,
  [body('url').isURL({ require_protocol: true, protocols: ['http', 'https'] }).withMessage('A valid http(s) URL is required')],
  validateRequest,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const url = String(req.body.url);
      const userId = req.user!.userId;

      try {
        await assertPublicUrl(url);
      } catch (e) {
        return res.status(400).json({ error: (e as Error).message });
      }

      const file = await prisma.file.create({
        data: {
          userId,
          name: 'import-pending',
          originalName: url.slice(0, 200),
          mimeType: 'application/octet-stream',
          size: BigInt(0),
          path: '',
          url: null,
          status: 'PENDING',
          metadata: {},
          sourceUrl: url,
        },
      });

      void importInBackground(file.id, url, userId).catch((err) => {
        logger.error({ err, fileId: file.id }, 'Background import crashed');
      });

      res.status(202).json({ file: { ...serializeFile({ ...file, size: BigInt(0) } as never) } });
    } catch (error) {
      next(error);
    }
  }
);

async function importInBackground(fileId: string, url: string, userId: string): Promise<void> {
  const fail = async (reason: string) => {
    logger.warn({ fileId, reason }, 'Import failed');
    // Keep the reason on the row so the UI can tell the user why the
    // import failed instead of leaving a bare FAILED status.
    await prisma.file.update({
      where: { id: fileId },
      data: { status: 'FAILED', metadata: { importError: reason } },
    }).catch(() => undefined);
  };

  try {
    // Stream remote bytes to a temp file (never whole file in memory).
    const dlResp = await fetch(`${config.aiServiceUrl}/api/v1/import/download?url=${encodeURIComponent(url)}`);
    if (!dlResp.ok || !dlResp.body) {
      let reason = `download service returned ${dlResp.status}`;
      try {
        const payload = await dlResp.json() as { detail?: unknown };
        if (typeof payload.detail === 'string' && payload.detail.trim()) {
          reason = payload.detail;
        }
      } catch { /* non-JSON error body */ }
      return fail(reason);
    }
    const disposition = dlResp.headers.get('content-disposition') || '';
    const titleHeader = dlResp.headers.get('x-import-title') || '';
    const suggested = /filename="?([^"]+)"?/.exec(disposition)?.[1] || titleHeader || 'imported-file';
    const ext = path.extname(suggested).toLowerCase() || '.mp4';
    const tmpPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'aether-import-')), `media${ext}`);

    await pipeline(Readable.fromWeb(dlResp.body as never), fs.createWriteStream(tmpPath));

    const stats = await fs.promises.stat(tmpPath);
    if (stats.size === 0) {
      await fs.promises.unlink(tmpPath).catch(() => undefined);
      return fail('downloaded file is empty');
    }

    // Detect mime from extension/content.
    const mimeByExt: Record<string, string> = {
      '.mp4': 'video/mp4', '.webm': 'video/webm', '.mkv': 'video/x-matroska', '.mov': 'video/quicktime',
      '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
      '.pdf': 'application/pdf',
    };
    const mimeType = mimeByExt[ext] || 'video/mp4';
    const originalName = (titleHeader || suggested || 'imported-video').slice(0, 200);

    // Move into managed storage with a uuid name (same layout as uploads).
    const filename = `${randomUUID()}${ext}`;
    const uploadDir = config.storage.uploadDir;
    fs.mkdirSync(uploadDir, { recursive: true });
    const destPath = path.join(uploadDir, filename);
    try {
      await fs.promises.rename(tmpPath, destPath);
    } catch (renameErr) {
      // /tmp and the app dir may live on different filesystems (EXDEV).
      if ((renameErr as NodeJS.ErrnoException).code === 'EXDEV') {
        await fs.promises.copyFile(tmpPath, destPath);
        await fs.promises.unlink(tmpPath).catch(() => undefined);
      } else {
        throw renameErr;
      }
    }

    let metadata: Record<string, unknown> = {};
    if (mimeType.startsWith('video/') || mimeType.startsWith('audio/')) {
      try {
        const info = await getVideoMetadata(path.resolve(destPath));
        metadata = { duration: info.duration, width: info.width, height: info.height };
      } catch { /* non-fatal */ }
    }

    // Version against any same-named files (re-imports become v2, v3...).
    const siblings = await prisma.file.findMany({
      where: { userId, originalName },
      select: { id: true, metadata: true },
    });
    let version = 1;
    for (const s of siblings) {
      if (s.id === fileId) continue;
      const v = Number((s.metadata as Record<string, unknown> | null)?.version ?? 1);
      if (Number.isFinite(v) && v >= version) version = v + 1;
    }

    await prisma.file.update({
      where: { id: fileId },
      data: {
        name: filename,
        originalName,
        mimeType,
        size: Number(BigInt(stats.size)),
        path: destPath,
        url: `/storage/uploads/${filename}`,
        status: 'PROCESSING',
        metadata: { ...metadata, version, previousVersionId: null },
      },
    });

    if (queueService.isConnected()) {
      if (mimeType.startsWith('video/') || mimeType.startsWith('audio/')) {
        await queueService.addVideoProcessingJob({ fileId, filePath: destPath, mimeType, userId, fileVersion: version, originalName });
      } else {
        await queueService.addDocumentProcessingJob({ fileId, filePath: destPath, mimeType, userId, fileVersion: version, originalName });
      }
    } else {
      const job = { id: `inline:${fileId}`, fileId, inputPath: destPath, mimeType, userId, fileVersion: version, originalName };
      if (mimeType.startsWith('video/') || mimeType.startsWith('audio/')) {
        void processVideoFile(job).catch(() => undefined);
      } else {
        void processDocumentFile(job).catch(() => undefined);
      }
    }
    logger.info({ fileId, originalName }, 'Import downloaded, processing started');
  } catch (err) {
    logger.error({ err, fileId }, 'Import pipeline failed');
    return fail('pipeline error');
  }
}

router.patch(
  '/:id',
  authenticate,
  [
    body('status').optional().isIn(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED']).withMessage('Invalid status'),
  ],
  validateRequest,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { name, originalName, status, metadata, tags, isFavorite } = req.body;

      const file = await prisma.file.findFirst({
        where: { id: req.params.id, userId: req.user!.userId },
      });

      if (!file) {
        return res.status(404).json({ error: 'File not found' });
      }

      const updateData: any = {};
      if (name) updateData.name = name;
      if (originalName) updateData.originalName = originalName;
      if (status) updateData.status = status;
      if (metadata) updateData.metadata = metadata;
      if (tags !== undefined) {
        if (!Array.isArray(tags) || tags.length > 20 || tags.some((t) => typeof t !== 'string' || t.length > 30)) {
          return res.status(400).json({ error: 'Tags must be an array of up to 20 short strings' });
        }
        updateData.tags = tags.map((t: string) => t.trim()).filter(Boolean);
      }
      if (isFavorite !== undefined) updateData.isFavorite = Boolean(isFavorite);

      const updated = await prisma.file.update({
        where: { id: req.params.id },
        data: updateData,
        select: {
          id: true,
          name: true,
          originalName: true,
          mimeType: true,
          size: true,
          path: true,
          url: true,
          status: true,
          metadata: true,
          tags: true,
          isFavorite: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      res.json({
        file: {
          ...updated,
          size: Number(updated.size),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;