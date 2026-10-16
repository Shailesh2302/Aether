import Redis from 'ioredis';
import { config } from '../config/env.js';
import { logger } from '../config/logger.js';

export interface VideoJobData {
  id: string;
  type: string;
  input_path: string;
  output_path?: string;
  video_id: string;
  parameters?: Record<string, any>;
  status: string;
}

export interface DocumentJobData {
  id: string;
  type: string;
  input_path: string;
  output_path?: string;
  document_id: string;
  parameters?: Record<string, any>;
  status: string;
}

export interface ClipJobData {
  id: string;
  type: string;
  input_path: string;
  output_path?: string;
  video_id: string;
  start_time: number;
  end_time: number;
  parameters?: Record<string, any>;
  status: string;
}

class QueueService {
  private redis: Redis | null = null;
  private redisConnected = false;
  private videoQueueName = 'aether:video:queue';
  private documentQueueName = 'aether:document:queue';
  private clipQueueName = 'aether:clip:queue';

  constructor() {
    this.initRedis();
  }

  private initRedis() {
    try {
      this.redis = new Redis({
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
        maxRetriesPerRequest: 1,
        retryStrategy: () => null,
        enableOfflineQueue: false,
        connectTimeout: 5000,
      });

      this.redis.on('connect', () => {
        this.redisConnected = true;
        logger.info('Redis connected for queue service');
      });

      this.redis.on('error', (err) => {
        this.redisConnected = false;
        logger.warn({ err }, 'Redis connection error - queue service will operate in degraded mode');
      });
    } catch (err) {
      this.redisConnected = false;
      logger.warn({ err }, 'Failed to initialize Redis - queue operations will be skipped');
    }
  }

  private async safeRedisOperation(operation: string, fn: (redis: Redis) => Promise<any>): Promise<any> {
    if (!this.redis || !this.redisConnected) {
      logger.warn({ operation }, 'Redis unavailable - skipping queue operation');
      return null;
    }

    try {
      return await fn(this.redis);
    } catch (err) {
      logger.warn({ err, operation }, 'Redis operation failed');
      return null;
    }
  }

  private createJobId(prefix: string): string {
    return `${prefix}:${Date.now()}:${Math.random().toString(36).substring(2, 9)}`;
  }

  async addVideoProcessingJob(data: { fileId: string; filePath: string; mimeType: string; userId: string; fileVersion?: number; originalName?: string }): Promise<string> {
    const jobId = this.createJobId('video');

    const job: VideoJobData = {
      id: jobId,
      type: 'VideoProcess',
      input_path: data.filePath,
      video_id: data.fileId,
      parameters: {
        mimeType: data.mimeType,
        userId: data.userId,
        ...(data.fileVersion !== undefined ? { fileVersion: data.fileVersion } : {}),
        ...(data.originalName ? { originalName: data.originalName } : {}),
      },
      status: 'Queued',
    };

    await this.safeRedisOperation('lpush', async (redis) => {
      await redis.lpush(this.videoQueueName, JSON.stringify(job));
      await redis.hset(`aether:job:${jobId}`, 'data', JSON.stringify(job));
      await redis.hset(`aether:job:${jobId}`, 'status', 'Queued');
    });

    logger.info({ jobId, fileId: data.fileId }, 'Video processing job added to queue');
    return jobId;
  }

  async addDocumentProcessingJob(data: { fileId: string; filePath: string; mimeType: string; userId: string; fileVersion?: number; originalName?: string }): Promise<string> {
    const jobId = this.createJobId('doc');

    const job: DocumentJobData = {
      id: jobId,
      type: 'DocumentProcess',
      input_path: data.filePath,
      document_id: data.fileId,
      parameters: {
        mimeType: data.mimeType,
        userId: data.userId,
        ...(data.fileVersion !== undefined ? { fileVersion: data.fileVersion } : {}),
        ...(data.originalName ? { originalName: data.originalName } : {}),
      },
      status: 'Queued',
    };

    await this.safeRedisOperation('lpush', async (redis) => {
      await redis.lpush(this.documentQueueName, JSON.stringify(job));
      await redis.hset(`aether:job:${jobId}`, 'data', JSON.stringify(job));
      await redis.hset(`aether:job:${jobId}`, 'status', 'Queued');
    });

    logger.info({ jobId, fileId: data.fileId }, 'Document processing job added to queue');
    return jobId;
  }

  async addClipGenerationJob(data: { fileId: string; filePath: string; startTime: number; endTime: number; userId: string; clipId?: string }): Promise<string> {
    const jobId = this.createJobId('clip');

    const job: ClipJobData = {
      id: jobId,
      type: 'ClipGenerate',
      input_path: data.filePath,
      video_id: data.fileId,
      start_time: data.startTime,
      end_time: data.endTime,
      output_path: `/tmp/aether/clips/clip-${jobId}.mp4`,
      parameters: {
        userId: data.userId,
        ...(data.clipId ? { clipId: data.clipId } : {}),
      },
      status: 'Queued',
    };

    await this.safeRedisOperation('lpush', async (redis) => {
      await redis.lpush(this.clipQueueName, JSON.stringify(job));
      await redis.hset(`aether:job:${jobId}`, 'data', JSON.stringify(job));
      await redis.hset(`aether:job:${jobId}`, 'status', 'Queued');
    });

    logger.info({ jobId, fileId: data.fileId }, 'Clip generation job added to queue');
    return jobId;
  }

  async updateJobStatus(jobId: string, status: string): Promise<void> {
    await this.safeRedisOperation('hset', async (redis) => {
      await redis.hset(`aether:job:${jobId}`, 'status', status);
    });
    logger.info({ jobId, status }, 'Job status updated');
  }

  async getJobStatus(jobId: string): Promise<string | null> {
    const result = await this.safeRedisOperation('hget', async (redis) => {
      return await redis.hget(`aether:job:${jobId}`, 'status');
    });
    return result;
  }

  async getVideoQueueLength(): Promise<number> {
    const result = await this.safeRedisOperation('llen', async (redis) => {
      return await redis.llen(this.videoQueueName);
    });
    return result || 0;
  }

  async getDocumentQueueLength(): Promise<number> {
    const result = await this.safeRedisOperation('llen', async (redis) => {
      return await redis.llen(this.documentQueueName);
    });
    return result || 0;
  }

  async getClipQueueLength(): Promise<number> {
    const result = await this.safeRedisOperation('llen', async (redis) => {
      return await redis.llen(this.clipQueueName);
    });
    return result || 0;
  }

  /** True when a job referencing this file is already waiting in any queue. */
  async hasQueuedJobForFile(fileId: string): Promise<boolean> {
    if (!this.redis || !this.redisConnected) return false;
    try {
      const lists = [this.videoQueueName, this.documentQueueName, this.clipQueueName];
      const [video, document, clip] = await this.redis.pipeline(
        lists.map((key) => ['lrange', key, '0', '-1'] as unknown as ['lrange', string, string, string])
      ).exec() as unknown as Array<[Error | null, string[]]>;
      for (const [, jobs] of [video, document, clip]) {
        for (const raw of jobs ?? []) {
          if (typeof raw === 'string' && raw.includes(fileId)) return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  }

  async disconnect() {
    if (this.redis) {
      await this.redis.quit();
    }
  }

  isConnected(): boolean {
    return this.redisConnected;
  }
}

export const queueService = new QueueService();