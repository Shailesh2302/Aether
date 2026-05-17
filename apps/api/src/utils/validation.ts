import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required').optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  avatar: z.string().url().optional(),
});

export const createFileSchema = z.object({
  name: z.string().min(1),
  originalName: z.string().min(1),
  mimeType: z.string(),
  size: z.number().positive(),
  path: z.string(),
});

export const createSessionSchema = z.object({
  fileId: z.string().uuid().optional(),
  title: z.string().min(1),
  type: z.enum(['CHAT', 'SEARCH', 'CLIP', 'ANALYTICS']),
  metadata: z.record(z.unknown()).optional(),
});

export const createMessageSchema = z.object({
  sessionId: z.string().uuid(),
  content: z.string().min(1),
  role: z.enum(['USER', 'ASSISTANT', 'SYSTEM']).default('USER'),
  metadata: z.record(z.unknown()).optional(),
});

export const createClipSchema = z.object({
  fileId: z.string().uuid().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  startTime: z.number().min(0),
  endTime: z.number().min(0),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const searchSchema = z.object({
  query: z.string().min(1),
  fileId: z.string().uuid().optional(),
  limit: z.number().min(1).max(100).default(10),
  offset: z.number().min(0).default(0),
});

export const updateClipSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type CreateFileInput = z.infer<typeof createFileSchema>;
export type CreateSessionInput = z.infer<typeof createSessionSchema>;
export type CreateMessageInput = z.infer<typeof createMessageSchema>;
export type CreateClipInput = z.infer<typeof createClipSchema>;
export type SearchInput = z.infer<typeof searchSchema>;
export type UpdateClipInput = z.infer<typeof updateClipSchema>;

export function validateInput<T>(schema: z.ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}