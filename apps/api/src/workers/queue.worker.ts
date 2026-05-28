import { Redis } from 'ioredis';
import { config } from '../config/env.js';
import { logger } from '../config/logger.js';

const QUEUES = {
  video: 'aether:video:queue',
  document: 'aether:document:queue',
  clip: 'aether:clip:queue',
};

async function processVideoJob(redis: Redis, jobKey: string) {
  const jobData = await redis.hgetall(`aether:job:${jobKey}`);
  if (!jobData || !jobData.data) return;

  const job = JSON.parse(jobData.data);
  logger.info({ jobId: jobKey, type: 'video', fileId: job.video_id }, 'Processing video job');

  try {
    await redis.hset(`aether:job:${jobKey}`, 'status', 'PROCESSING');

    const apiUrl = `http://localhost:${config.port}`;
    const aiUrl = config.aiServiceUrl;

    const fileResp = await fetch(`${apiUrl}/api/files/${job.video_id}`);
    if (!fileResp.ok) throw new Error(`File not found: ${job.video_id}`);
    const fileData: any = await fileResp.json();
    const filePath = fileData.file?.path || job.input_path;

    const indexResp = await fetch(`${aiUrl}/api/v1/documents/index`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        file_id: job.video_id,
        file_path: filePath,
        user_id: job.parameters?.userId || 'unknown',
        mime_type: job.parameters?.mimeType || 'video/mp4',
      }),
    });

    if (!indexResp.ok) {
      const errText = await indexResp.text();
      throw new Error(`Indexing failed: ${errText}`);
    }

    await redis.hset(`aether:job:${jobKey}`, 'status', 'COMPLETED');
    logger.info({ jobId: jobKey }, 'Video job completed');
  } catch (err) {
    logger.error({ jobId: jobKey, err }, 'Video job failed');
    await redis.hset(`aether:job:${jobKey}`, 'status', 'FAILED');
    await redis.hset(`aether:job:${jobKey}`, 'error', (err as Error).message);
  }
}

async function processDocumentJob(redis: Redis, jobKey: string) {
  const jobData = await redis.hgetall(`aether:job:${jobKey}`);
  if (!jobData || !jobData.data) return;

  const job = JSON.parse(jobData.data);
  logger.info({ jobId: jobKey, type: 'document', fileId: job.document_id }, 'Processing document job');

  try {
    await redis.hset(`aether:job:${jobKey}`, 'status', 'PROCESSING');

    const aiUrl = config.aiServiceUrl;

    const indexResp = await fetch(`${aiUrl}/api/v1/documents/index`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        file_id: job.document_id,
        file_path: job.input_path,
        user_id: job.parameters?.userId || 'unknown',
        mime_type: job.parameters?.mimeType || 'application/octet-stream',
      }),
    });

    if (!indexResp.ok) {
      const errText = await indexResp.text();
      throw new Error(`Indexing failed: ${errText}`);
    }

    await redis.hset(`aether:job:${jobKey}`, 'status', 'COMPLETED');
    logger.info({ jobId: jobKey }, 'Document job completed');
  } catch (err) {
    logger.error({ jobId: jobKey, err }, 'Document job failed');
    await redis.hset(`aether:job:${jobKey}`, 'status', 'FAILED');
    await redis.hset(`aether:job:${jobKey}`, 'error', (err as Error).message);
  }
}

async function processClipJob(redis: Redis, jobKey: string) {
  const jobData = await redis.hgetall(`aether:job:${jobKey}`);
  if (!jobData || !jobData.data) return;

  const job = JSON.parse(jobData.data);
  logger.info({ jobId: jobKey, type: 'clip', fileId: job.video_id }, 'Processing clip job');

  try {
    await redis.hset(`aether:job:${jobKey}`, 'status', 'PROCESSING');

    const apiUrl = `http://localhost:${config.port}`;

    const generateResp = await fetch(`${apiUrl}/api/clips/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileId: job.video_id,
        startTime: job.start_time,
        endTime: job.end_time,
      }),
    });

    if (!generateResp.ok) {
      const errText = await generateResp.text();
      throw new Error(`Clip generation failed: ${errText}`);
    }

    await redis.hset(`aether:job:${jobKey}`, 'status', 'COMPLETED');
    logger.info({ jobId: jobKey }, 'Clip job completed');
  } catch (err) {
    logger.error({ jobId: jobKey, err }, 'Clip job failed');
    await redis.hset(`aether:job:${jobKey}`, 'status', 'FAILED');
    await redis.hset(`aether:job:${jobKey}`, 'error', (err as Error).message);
  }
}

async function pollQueues(redis: Redis) {
  for (const [type, queueKey] of Object.entries(QUEUES)) {
    try {
      const jobJson = await redis.brpop(queueKey, 0);
      if (!jobJson) continue;

      const [_key, jobStr] = jobJson;
      const job = JSON.parse(jobStr);

      switch (type) {
        case 'video':
          await processVideoJob(redis, job.id);
          break;
        case 'document':
          await processDocumentJob(redis, job.id);
          break;
        case 'clip':
          await processClipJob(redis, job.id);
          break;
      }
    } catch (err) {
      if ((err as any).message !== 'ERR wrong number of arguments') {
        logger.warn({ err, queue: queueKey }, 'Queue poll error');
      }
    }
  }
}

async function main() {
  logger.info('Starting queue worker');

  const redis = new Redis({
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
    maxRetriesPerRequest: null,
    enableOfflineQueue: true,
  });

  redis.on('connect', () => logger.info('Queue worker connected to Redis'));
  redis.on('error', (err) => logger.warn({ err }, 'Queue worker Redis error'));

  const pollInterval = parseInt(process.env.QUEUE_POLL_INTERVAL || '1000', 10);

  while (true) {
    await pollQueues(redis);
    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }
}

main().catch((err) => {
  logger.error({ err }, 'Queue worker exited');
  process.exit(1);
});
