import { logger } from '../config/logger.js';
import { config } from '../config/env.js';

export interface ProcessingJob {
  id: string;
  type: 'video' | 'document' | 'audio';
  inputPath: string;
  outputPath?: string;
  options?: Record<string, unknown>;
}

export interface ProcessingResult {
  success: boolean;
  output?: string;
  metadata?: Record<string, unknown>;
  error?: string;
}

class RustService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.RUST_WORKER_URL || 'http://localhost:3003';
  }

  async processVideo(job: ProcessingJob): Promise<ProcessingResult> {
    try {
      logger.info({ job }, 'Processing video with Rust worker');
      
      const response = await fetch(`${this.baseUrl}/process/video`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          job_id: job.id,
          input_path: job.inputPath,
          output_path: job.outputPath,
          options: job.options,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Rust worker error: ${error}`);
      }

      const result = await response.json();
      logger.info({ jobId: job.id, result }, 'Video processing completed');
      
      return {
        success: true,
        output: result.output_path,
        metadata: result.metadata,
      };
    } catch (error) {
      logger.error({ error, job }, 'Video processing failed');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async processDocument(job: ProcessingJob): Promise<ProcessingResult> {
    try {
      logger.info({ job }, 'Processing document with Rust worker');
      
      const response = await fetch(`${this.baseUrl}/process/document`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          job_id: job.id,
          input_path: job.inputPath,
          output_path: job.outputPath,
          options: job.options,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Rust worker error: ${error}`);
      }

      const result = await response.json();
      logger.info({ jobId: job.id, result }, 'Document processing completed');
      
      return {
        success: true,
        output: result.output_path,
        metadata: result.metadata,
      };
    } catch (error) {
      logger.error({ error, job }, 'Document processing failed');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async extractAudio(job: ProcessingJob): Promise<ProcessingResult> {
    try {
      logger.info({ job }, 'Extracting audio with Rust worker');
      
      const response = await fetch(`${this.baseUrl}/extract/audio`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          job_id: job.id,
          input_path: job.inputPath,
          output_path: job.outputPath,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Rust worker error: ${error}`);
      }

      const result = await response.json();
      logger.info({ jobId: job.id, result }, 'Audio extraction completed');
      
      return {
        success: true,
        output: result.output_path,
      };
    } catch (error) {
      logger.error({ error, job }, 'Audio extraction failed');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async transcribeAudio(job: ProcessingJob): Promise<ProcessingResult> {
    try {
      logger.info({ job }, 'Transcribing audio with Rust worker');
      
      const response = await fetch(`${this.baseUrl}/transcribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          job_id: job.id,
          input_path: job.inputPath,
          options: job.options,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Rust worker error: ${error}`);
      }

      const result = await response.json();
      logger.info({ jobId: job.id, result }, 'Transcription completed');
      
      return {
        success: true,
        metadata: {
          transcription: result.transcription,
          segments: result.segments,
        },
      };
    } catch (error) {
      logger.error({ error, job }, 'Transcription failed');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }
}

export const rustService = new RustService();