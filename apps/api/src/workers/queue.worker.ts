import { Redis } from 'ioredis';
import { config } from '../config/env.js';
import { logger } from '../config/logger.js';
import { processVideoFile, processDocumentFile, processClipFile, type JobReporter } from '../services/processing.service.js';
import type { DocumentJobData, ClipJobData } from '../services/queue.service.js';

// Queue ownership:
//   aether:video:queue    -> Node worker (transcribe + index via AI service;
//                            Rust worker may also consume when available)
//   aether:document:queue -> Node worker (document indexing via AI service)
//   aether:clip:queue     -> Node worker (ffmpeg clip cutting)
const QUEUES = {
  video: 'aether:video:queue',
  document: 'aether:document:queue',
  clip: 'aether:clip:queue',
};

const redisReporter = (redis: Redis): JobReporter => ({
  setStatus: async (jobKey, status) => {
    await redis.hset(`aether:job:${jobKey}`, 'status', status).catch(() => undefined);
  },
  setError: async (jobKey, message) => {
    await redis.hset(`aether:job:${jobKey}`, 'error', message).catch(() => undefined);
  },
});

interface VideoJobShape {
  id: string;
  video_id?: string;
  document_id?: string;
  input_path?: string;
  parameters?: { userId?: string; mimeType?: string; fileVersion?: number; originalName?: string };
}

async function processVideoJob(redis: Redis, job: VideoJobShape) {
  await processVideoFile(
    {
      id: job.id,
      fileId: job.video_id || job.document_id || '',
      inputPath: job.input_path || '',
      mimeType: job.parameters?.mimeType || 'video/mp4',
      userId: job.parameters?.userId || 'unknown',
      fileVersion: job.parameters?.fileVersion,
      originalName: job.parameters?.originalName,
    },
    redisReporter(redis)
  ).catch(() => undefined);
}

async function processDocumentJob(redis: Redis, job: DocumentJobData & { id: string }) {
  const params = (job.parameters ?? {}) as { userId?: string; mimeType?: string; fileVersion?: number; originalName?: string };
  await processDocumentFile(
    {
      id: job.id,
      fileId: job.document_id,
      inputPath: job.input_path,
      mimeType: params.mimeType || 'application/octet-stream',
      userId: params.userId || 'unknown',
      fileVersion: params.fileVersion,
      originalName: params.originalName,
    },
    redisReporter(redis)
  ).catch(() => undefined);
}

async function processClipJob(redis: Redis, job: ClipJobData & { id: string }) {
  await processClipFile(
    {
      id: job.id,
      fileId: job.video_id,
      inputPath: job.input_path,
      startTime: job.start_time,
      endTime: job.end_time,
      clipId: job.parameters?.clipId,
    },
    redisReporter(redis)
  ).catch(() => undefined);
}

async function pollQueues(redis: Redis) {
  for (const [type, queueKey] of Object.entries(QUEUES)) {
    try {
      // Non-blocking pop: a dead connection can leave BRPOP(0)
      // suspended forever, silently stalling the whole worker.
      const jobStr = await redis.lpop(queueKey);
      if (!jobStr) continue;

      let job;
      try {
        job = JSON.parse(jobStr);
      } catch {
        logger.warn({ queue: queueKey }, 'Skipping malformed job payload');
        continue;
      }

      switch (type) {
        case 'video':
          await processVideoJob(redis, job);
          break;
        case 'document':
          await processDocumentJob(redis, job);
          break;
        case 'clip':
          await processClipJob(redis, job);
          break;
      }
    } catch (err) {
      logger.warn({ err, queue: queueKey }, 'Queue poll error');
    }
  }
}

async function main() {
  logger.info('Starting queue worker');

  const redis = new Redis({
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password || undefined,
    maxRetriesPerRequest: null,
    enableOfflineQueue: true,
    retryStrategy: (times) => Math.min(times * 500, 10_000),
    reconnectOnError: () => true,
    commandTimeout: 15_000,
  });

  redis.on('connect', () => logger.info('Queue worker connected to Redis'));
  redis.on('error', (err) => logger.warn({ err }, 'Queue worker Redis error'));

  const pollInterval = parseInt(process.env.QUEUE_POLL_INTERVAL || '1000', 10);

  for (;;) {
    await pollQueues(redis);
    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }
}

main().catch((err) => {
  logger.error({ err }, 'Queue worker exited');
  process.exit(1);
});
