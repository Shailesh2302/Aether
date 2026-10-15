import path from 'path';
import fs from 'fs';
import { config } from '../config/env.js';
import { logger } from '../config/logger.js';
import { prisma } from '../config/db.js';
import { trimVideo, generateThumbnail } from '../utils/ffmpeg.js';

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

async function indexViaAI(args: {
  fileId: string; inputPath: string; userId: string; mimeType: string;
}): Promise<void> {
  const indexResp = await fetch(`${config.aiServiceUrl}/api/v1/documents/index`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      file_id: args.fileId,
      file_path: path.resolve(args.inputPath),
      user_id: args.userId || 'unknown',
      mime_type: args.mimeType,
    }),
  });
  if (!indexResp.ok) {
    const errText = await indexResp.text();
    throw new Error(`Indexing failed: ${errText.slice(0, 300)}`);
  }
}

export async function processVideoFile(
  job: { id: string; fileId: string; inputPath: string; mimeType: string; userId: string },
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
    await indexViaAI({ fileId, inputPath: job.inputPath, userId: job.userId, mimeType: job.mimeType || 'video/mp4' });
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
  job: { id: string; fileId: string; inputPath: string; mimeType: string; userId: string },
  report: JobReporter = nullReporter,
): Promise<void> {
  const { id: jobKey, fileId } = job;
  logger.info({ jobId: jobKey, fileId }, 'Processing document file');
  try {
    await report.setStatus(jobKey, 'PROCESSING');
    await indexViaAI({ fileId, inputPath: job.inputPath, userId: job.userId, mimeType: job.mimeType || 'application/octet-stream' });
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
