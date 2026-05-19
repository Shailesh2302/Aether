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
  private redis: Redis;
  private videoQueueName = 'omnimind:video:queue';
  private documentQueueName = 'omnimind:document:queue';
  private clipQueueName = 'omnimind:clip:queue';

  constructor() {
    const redisUrl = process.env.REDIS_URL || `rediss://default:${config.redis.password}@${config.redis.host}:${config.redis.port}`;
    
    this.redis = new Redis(redisUrl, {
      lazyConnect: true,
    });

    this.redis.on('connect', () => {
      logger.info('Redis connected for queue service');
    });

    this.redis.on('error', (err) => {
      logger.error({ err }, 'Redis connection error');
    });
  }

  async connect() {
    await this.redis.connect();
  }

  private createJobId(prefix: string): string {
    return `${prefix}:${Date.now()}:${Math.random().toString(36).substring(2, 9)}`;
  }

  async addVideoProcessingJob(data: { fileId: string; filePath: string; mimeType: string; userId: string }): Promise<string> {
    const jobId = this.createJobId('video');
    
    const job: VideoJobData = {
      id: jobId,
      type: 'VideoProcess',
      input_path: data.filePath,
      video_id: data.fileId,
      parameters: {
        mimeType: data.mimeType,
        userId: data.userId,
      },
      status: 'Queued',
    };

    await this.redis.lpush(this.videoQueueName, JSON.stringify(job));
    
    await this.redis.hset(
      `omnimind:job:${jobId}`,
      'data',
      JSON.stringify(job)
    );
    await this.redis.hset(`omnimind:job:${jobId}`, 'status', 'Queued');

    logger.info({ jobId, fileId: data.fileId }, 'Video processing job added to queue');

    return jobId;
  }

  async addDocumentProcessingJob(data: { fileId: string; filePath: string; mimeType: string; userId: string }): Promise<string> {
    const jobId = this.createJobId('doc');
    
    const job: DocumentJobData = {
      id: jobId,
      type: 'DocumentProcess',
      input_path: data.filePath,
      document_id: data.fileId,
      parameters: {
        mimeType: data.mimeType,
        userId: data.userId,
      },
      status: 'Queued',
    };

    await this.redis.lpush(this.documentQueueName, JSON.stringify(job));
    
    await this.redis.hset(
      `omnimind:job:${jobId}`,
      'data',
      JSON.stringify(job)
    );
    await this.redis.hset(`omnimind:job:${jobId}`, 'status', 'Queued');

    logger.info({ jobId, fileId: data.fileId }, 'Document processing job added to queue');

    return jobId;
  }

  async addClipGenerationJob(data: { fileId: string; filePath: string; startTime: number; endTime: number; userId: string }): Promise<string> {
    const jobId = this.createJobId('clip');
    
    const job: ClipJobData = {
      id: jobId,
      type: 'ClipGenerate',
      input_path: data.filePath,
      video_id: data.fileId,
      start_time: data.startTime,
      end_time: data.endTime,
      output_path: `/tmp/omnimind/clips/clip-${jobId}.mp4`,
      status: 'Queued',
    };

    await this.redis.lpush(this.clipQueueName, JSON.stringify(job));
    
    await this.redis.hset(
      `omnimind:job:${jobId}`,
      'data',
      JSON.stringify(job)
    );
    await this.redis.hset(`omnimind:job:${jobId}`, 'status', 'Queued');

    logger.info({ jobId, fileId: data.fileId }, 'Clip generation job added to queue');

    return jobId;
  }

  async updateJobStatus(jobId: string, status: string): Promise<void> {
    await this.redis.hset(`omnimind:job:${jobId}`, 'status', status);
    logger.info({ jobId, status }, 'Job status updated');
  }

  async getJobStatus(jobId: string): Promise<string | null> {
    return await this.redis.hget(`omnimind:job:${jobId}`, 'status');
  }

  async getVideoQueueLength(): Promise<number> {
    return await this.redis.llen(this.videoQueueName);
  }

  async getDocumentQueueLength(): Promise<number> {
    return await this.redis.llen(this.documentQueueName);
  }

  async getClipQueueLength(): Promise<number> {
    return await this.redis.llen(this.clipQueueName);
  }

  async disconnect() {
    await this.redis.quit();
  }
}

export const queueService = new QueueService();