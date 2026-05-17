import crypto from 'crypto';
import { promisify } from 'util';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';

const randomBytes = promisify(crypto.randomBytes);

export function generateToken(length = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

export async function generateSecureToken(length = 32): Promise<string> {
  const buffer = await randomBytes(length);
  return buffer.toString('hex');
}

export function generateJwtToken(payload: object, expiresIn = config.jwt.expiry): string {
  return jwt.sign(payload, config.jwt.secret, { expiresIn });
}

export function verifyJwtToken(token: string): object | string {
  return jwt.verify(token, config.jwt.secret);
}

export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let unitIndex = 0;
  let size = bytes;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function getFileExtension(filename: string): string {
  return filename.slice(((filename.lastIndexOf('.') - 1) >>> 0) + 2);
}

export function isImageMimeType(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

export function isVideoMimeType(mimeType: string): boolean {
  return mimeType.startsWith('video/');
}

export function isDocumentMimeType(mimeType: string): boolean {
  const documentTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'text/plain',
  ];
  return documentTypes.some((type) => mimeType.includes(type));
}

export function sanitizeHtml(html: string): string {
  return html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}

export function parseQueryInt(value: string | undefined, defaultValue: number): number {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

export function parseQueryBool(value: string | undefined, defaultValue: boolean): boolean {
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true';
}

export function getFileUrl(filePath: string, baseUrl = config.apiUrl): string {
  const path = filePath.replace(/^\//, '');
  return `${baseUrl}/storage/${path}`;
}