import path from 'path';
import fs from 'fs';
import os from 'os';
import { config } from '../config/env.js';
import { logger } from '../config/logger.js';
import { prisma } from '../config/db.js';
import { trimVideo, generateThumbnail, extractAudio } from '../utils/ffmpeg.js';
import { aiService } from './ai.service.js';
import { vectorService } from './vector.service.js';
import { fetchWithTimeout } from '../utils/helpers.js';
import { randomUUID } from 'crypto';

// Background processing (not user-facing): allow slow cold starts.
const BG_TIMEOUT_MS = 600_000;

/**
 * Core media/document processing used by BOTH the queue worker and the
 * inline fallback. When Redis is unavailable (e.g. free-tier production
 * without a Redis service), API routes call these directly in the
 * background so uploads never stall in PROCESSING.
 */

export interface JobReporter {
  setStatus(jobKey: string, status: string): Promise<void>;
  setError(jobKey: string, message: string): Promise<void>;
}

export const nullReporter: JobReporter = {
  setStatus: async () => undefined,
  setError: async () => undefined,
};

export interface IndexJob {
  fileId: string; inputPath: string; userId: string; mimeType: string;
  fileVersion?: number; originalName?: string;
}

async function indexViaAI(args: IndexJob): Promise<void> {
  // Preferred path: AI service reads the file directly (shared filesystem,
  // e.g. local dev + queue worker on the same host).
  try {
    const indexResp = await fetchWithTimeout(`${config.aiServiceUrl}/api/v1/documents/index`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        file_id: args.fileId,
        file_path: path.resolve(args.inputPath),
        user_id: args.userId || 'unknown',
        mime_type: args.mimeType,
        ...(args.fileVersion !== undefined ? { file_version: args.fileVersion } : {}),
        ...(args.originalName ? { original_name: args.originalName } : {}),
      }),
    }, BG_TIMEOUT_MS);
    if (indexResp.ok) return;
    logger.warn({ status: indexResp.status, fileId: args.fileId }, 'Path-based indexing refused, falling back to upload');
  } catch (err) {
    logger.warn({ err, fileId: args.fileId }, 'Path-based indexing unreachable, falling back to upload');
  }
  // Fallback path: stream the bytes to the AI service (separate containers
  // in production share nothing). Extract text remotely, embed + upsert here.
  await indexViaUpload(args);
}

function chunkText(text: string, maxLen = 900): string[] {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return [];
  const sentences = normalized.split(/(?<=[.!?])\s+/).filter((s) => s.trim());
  const source = sentences.length > 1 ? sentences : [normalized];
  const out: string[] = [];
  let buf = '';
  for (const piece of source.length > 1 ? source : normalized.match(new RegExp(`.{1,${maxLen}}`, 'g')) || []) {
    if ((buf + ' ' + piece).trim().length > maxLen && buf) {
      out.push(buf.trim());
      buf = piece;
    } else {
      buf = `${buf} ${piece}`.trim();
    }
  }
  if (buf.trim()) out.push(buf.trim());
  return out.length > 0 ? out : [normalized.slice(0, maxLen)];
}

async function indexViaUpload(args: IndexJob): Promise<void> {
  const isMedia = args.mimeType.startsWith('video/') || args.mimeType.startsWith('audio/');
  let text = '';

  if (isMedia) {
    const tmpAudio = path.join(os.tmpdir(), `aether-${randomUUID()}.mp3`);
    try {
      await extractAudio(path.resolve(args.inputPath), tmpAudio);
      const audioBuf = await fs.promises.readFile(tmpAudio);
      const form = new FormData();
      form.append('file', new Blob([new Uint8Array(audioBuf)], { type: 'audio/mpeg' }), 'audio.mp3');
      const tResp = await fetchWithTimeout(`${config.aiServiceUrl}/api/v1/transcription`, {
        method: 'POST',
        body: form,
      }, BG_TIMEOUT_MS);
      if (!tResp.ok) throw new Error(`Transcription returned ${tResp.status}`);
      const tData = await tResp.json() as { text?: string };
      text = tData.text || '';
    } finally {
      await fs.promises.unlink(tmpAudio).catch(() => undefined);
    }
  } else {
    const buf = await fs.promises.readFile(path.resolve(args.inputPath));
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(buf)], { type: args.mimeType }), path.basename(args.inputPath));
    const eResp = await fetchWithTimeout(`${config.aiServiceUrl}/api/v1/documents/extract`, {
      method: 'POST',
      body: form,
    }, BG_TIMEOUT_MS);
    if (!eResp.ok) throw new Error(`Extraction returned ${eResp.status}`);
    const eData = await eResp.json() as { text?: string };
    text = eData.text || '';
  }

  if (!text.trim()) throw new Error('No text extracted for indexing');

  const chunks = chunkText(text).slice(0, 500);
  const collection = `user_${args.userId}`.replace(/-/g, '_');
  const firstEmbedding = await aiService.createEmbedding(chunks[0]);
  if (!(await vectorService.collectionExists(collection))) {
    await vectorService.createCollection(collection, firstEmbedding.length);
  }
  const payloads = chunks.map((chunk, i) => ({
    text: chunk,
    file_id: args.fileId,
    user_id: args.userId,
    chunk_index: i,
    metadata: {
      file_type: args.mimeType,
      ...(args.fileVersion !== undefined ? { doc_version: args.fileVersion } : {}),
      ...(args.originalName ? { original_name: args.originalName } : {}),
    },
  }));
  const vectors: number[][] = [firstEmbedding];
  for (const chunk of chunks.slice(1)) {
    vectors.push(await aiService.createEmbedding(chunk));
  }
  const ok = await vectorService.upsertPoints(
    collection,
    vectors.map((vector, i) => ({ id: randomUUID(), vector, payload: payloads[i] }))
  );
  if (!ok) throw new Error('Vector upsert failed');
  logger.info({ fileId: args.fileId, chunks: chunks.length }, 'Upload-based indexing finished');
}

export async function processVideoFile(
  job: { id: string; fileId: string; inputPath: string; mimeType: string; userId: string; fileVersion?: number; originalName?: string },
  report: JobReporter = nullReporter,
): Promise<void> {
  const { id: jobKey, fileId } = job;
  logger.info({ jobId: jobKey, fileId }, 'Processing video file');
  try {
    await report.setStatus(jobKey, 'PROCESSING');
    if (fileId) {
      await prisma.file.update({ where: { id: fileId }, data: { status: 'PROCESSING' } }).catch(() => undefined);
    }
    if (!job.inputPath || !fs.existsSync(job.inputPath)) {
      throw new Error(`Source video not found: ${job.inputPath}`);
    }
    await indexViaAI({ fileId, inputPath: job.inputPath, userId: job.userId, mimeType: job.mimeType || 'video/mp4', fileVersion: job.fileVersion, originalName: job.originalName });
    if (fileId) {
      await prisma.file.update({ where: { id: fileId }, data: { status: 'COMPLETED' } }).catch(() => undefined);
    }
    await report.setStatus(jobKey, 'COMPLETED');
    logger.info({ jobId: jobKey, fileId }, 'Video processing completed');
  } catch (err) {
    logger.error({ jobId: jobKey, err }, 'Video processing failed');
    if (fileId) {
      await prisma.file.update({ where: { id: fileId }, data: { status: 'FAILED' } }).catch(() => undefined);
    }
    await report.setStatus(jobKey, 'FAILED');
    await report.setError(jobKey, (err as Error).message);
    throw err;
  }
}

export async function processDocumentFile(
  job: { id: string; fileId: string; inputPath: string; mimeType: string; userId: string; fileVersion?: number; originalName?: string },
  report: JobReporter = nullReporter,
): Promise<void> {
  const { id: jobKey, fileId } = job;
  logger.info({ jobId: jobKey, fileId }, 'Processing document file');
  try {
    await report.setStatus(jobKey, 'PROCESSING');
    await indexViaAI({ fileId, inputPath: job.inputPath, userId: job.userId, mimeType: job.mimeType || 'application/octet-stream', fileVersion: job.fileVersion, originalName: job.originalName });
    await prisma.file.update({ where: { id: fileId }, data: { status: 'COMPLETED' } }).catch(() => undefined);
    await report.setStatus(jobKey, 'COMPLETED');
    logger.info({ jobId: jobKey, fileId }, 'Document processing completed');
  } catch (err) {
    logger.error({ jobId: jobKey, err }, 'Document processing failed');
    if (fileId) {
      await prisma.file.update({ where: { id: fileId }, data: { status: 'FAILED' } }).catch(() => undefined);
    }
    await report.setStatus(jobKey, 'FAILED');
    await report.setError(jobKey, (err as Error).message);
    throw err;
  }
}

export async function processClipFile(
  job: { id: string; fileId: string; inputPath: string; startTime: number; endTime: number; clipId?: string },
  report: JobReporter = nullReporter,
): Promise<void> {
  const { id: jobKey } = job;
  logger.info({ jobId: jobKey, fileId: job.fileId }, 'Cutting clip file');
  try {
    await report.setStatus(jobKey, 'PROCESSING');
    if (!fs.existsSync(job.inputPath)) {
      throw new Error(`Source video not found: ${job.inputPath}`);
    }
    const clipsDir = path.resolve(config.storage.clipsDir);
    fs.mkdirSync(clipsDir, { recursive: true });
    const clipFilename = `${jobKey.replace(/[^a-zA-Z0-9_-]/g, '_')}.mp4`;
    const clipPath = path.join(clipsDir, clipFilename);
    await trimVideo(job.inputPath, clipPath, Number(job.startTime) || 0, Number(job.endTime) || 10);

    let thumbnail: string | null = null;
    try {
      const thumbPath = path.join(clipsDir, clipFilename.replace(/\.mp4$/, '.jpg'));
      await generateThumbnail(clipPath, thumbPath, 0);
      thumbnail = `/storage/clips/${path.basename(thumbPath)}`;
    } catch (thumbErr) {
      logger.warn({ thumbErr }, 'Thumbnail generation failed');
    }

    if (job.clipId) {
      await prisma.clip.update({
        where: { id: job.clipId },
        data: { status: 'COMPLETED', videoUrl: `/storage/clips/${clipFilename}`, thumbnail },
      });
    }
    await report.setStatus(jobKey, 'COMPLETED');
    logger.info({ jobId: jobKey, clipPath }, 'Clip cutting completed');
  } catch (err) {
    logger.error({ jobId: jobKey, err }, 'Clip cutting failed');
    if (job.clipId) {
      try {
        await prisma.clip.update({ where: { id: job.clipId }, data: { status: 'FAILED' } });
      } catch (dbErr) {
        logger.warn({ dbErr }, 'Failed to mark clip as FAILED');
      }
    }
    await report.setStatus(jobKey, 'FAILED');
    await report.setError(jobKey, (err as Error).message);
    throw err;
  }
}
