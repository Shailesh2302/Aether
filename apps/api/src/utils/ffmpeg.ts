import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { logger } from '../config/logger.js';

export interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  codec: string;
  bitrate: number;
  fps: number;
}

export async function getVideoMetadata(filePath: string): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    const ffprobe = spawn('ffprobe', [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      filePath,
    ]);

    let output = '';

    ffprobe.stdout.on('data', (data) => {
      output += data.toString();
    });

    ffprobe.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ffprobe exited with code ${code}`));
        return;
      }

      try {
        const data = JSON.parse(output);
        const videoStream = data.streams.find((s: { codec_type: string }) => s.codec_type === 'video');
        const format = data.format;

        resolve({
          duration: parseFloat(format.duration || '0'),
          width: videoStream?.width || 0,
          height: videoStream?.height || 0,
          codec: videoStream?.codec_name || 'unknown',
          bitrate: parseInt(format.bit_rate || '0', 10),
          fps: eval(videoStream?.r_frame_rate || '0') || 0,
        });
      } catch (error) {
        reject(error);
      }
    });

    ffprobe.on('error', reject);
  });
}

export async function generateThumbnail(
  videoPath: string,
  outputPath: string,
  timestamp = 1
): Promise<string> {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-y',
      '-ss', timestamp.toString(),
      '-i', videoPath,
      '-vframes', '1',
      '-q:v', '2',
      outputPath,
    ]);

    ffmpeg.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ffmpeg exited with code ${code}`));
        return;
      }
      resolve(outputPath);
    });

    ffmpeg.on('error', reject);
  });
}

export async function extractAudio(videoPath: string, outputPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-y',
      '-i', videoPath,
      '-vn',
      '-acodec', 'libmp3lame',
      '-q:a', '2',
      outputPath,
    ]);

    ffmpeg.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ffmpeg exited with code ${code}`));
        return;
      }
      resolve(outputPath);
    });

    ffmpeg.on('error', reject);
  });
}

export async function trimVideo(
  videoPath: string,
  outputPath: string,
  startTime: number,
  endTime: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const duration = endTime - startTime;
    const ffmpeg = spawn('ffmpeg', [
      '-y',
      '-ss', startTime.toString(),
      '-t', duration.toString(),
      '-i', videoPath,
      '-c', 'copy',
      outputPath,
    ]);

    ffmpeg.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ffmpeg exited with code ${code}`));
        return;
      }
      resolve(outputPath);
    });

    ffmpeg.on('error', reject);
  });
}

export async function getVideoDuration(filePath: string): Promise<number> {
  const metadata = await getVideoMetadata(filePath);
  return metadata.duration;
}

export async function createClipDirectory(clipsDir: string): Promise<void> {
  try {
    await fs.mkdir(clipsDir, { recursive: true });
  } catch (error) {
    logger.error({ error, clipsDir }, 'Failed to create clips directory');
    throw error;
  }
}