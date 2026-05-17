import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/env.js';
import { logger } from '../config/logger.js';

export interface StorageResult {
  path: string;
  url: string;
  size: number;
}

class StorageService {
  private uploadDir: string;
  private clipsDir: string;
  private storageType: 'local' | 's3';

  constructor() {
    this.uploadDir = config.upload.uploadDir;
    this.clipsDir = config.upload.clipsDir;
    this.storageType = config.storage.type as 'local' | 's3';
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.uploadDir, { recursive: true });
    await fs.mkdir(this.clipsDir, { recursive: true });
    logger.info({ uploadDir: this.uploadDir, clipsDir: this.clipsDir }, 'Storage initialized');
  }

  async saveFile(buffer: Buffer, originalName: string): Promise<StorageResult> {
    const ext = path.extname(originalName);
    const filename = `${uuidv4()}${ext}`;
    const filePath = path.join(this.uploadDir, filename);
    
    await fs.writeFile(filePath, buffer);
    
    const stats = await fs.stat(filePath);
    
    return {
      path: filePath,
      url: `/storage/uploads/${filename}`,
      size: stats.size,
    };
  }

  async saveClip(buffer: Buffer, originalName: string): Promise<StorageResult> {
    const ext = path.extname(originalName);
    const filename = `${uuidv4()}${ext}`;
    const filePath = path.join(this.clipsDir, filename);
    
    await fs.writeFile(filePath, buffer);
    
    const stats = await fs.stat(filePath);
    
    return {
      path: filePath,
      url: `/storage/clips/${filename}`,
      size: stats.size,
    };
  }

  async deleteFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
      logger.info({ filePath }, 'File deleted');
    } catch (error) {
      logger.error({ error, filePath }, 'Failed to delete file');
      throw error;
    }
  }

  async getFile(filePath: string): Promise<Buffer> {
    return fs.readFile(filePath);
  }

  async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  getFileUrl(relativePath: string): string {
    return `${config.apiUrl}${relativePath}`;
  }

  getUploadDir(): string {
    return this.uploadDir;
  }

  getClipsDir(): string {
    return this.clipsDir;
  }
}

export const storageService = new StorageService();