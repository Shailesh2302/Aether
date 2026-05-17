export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: 'user' | 'admin' | 'superadmin';
  createdAt: Date;
  updatedAt: Date;
  emailVerified: boolean;
  lastLoginAt?: Date;
}

export interface File {
  id: string;
  userId: string;
  name: string;
  type: FileType;
  size: number;
  mimeType: string;
  url: string;
  thumbnailUrl?: string;
  metadata: FileMetadata;
  createdAt: Date;
  updatedAt: Date;
  status: FileStatus;
}

export type FileType = 'video' | 'pdf' | 'document' | 'spreadsheet' | 'image' | 'audio';

export type FileStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface FileMetadata {
  duration?: number;
  width?: number;
  height?: number;
  pages?: number;
  wordCount?: number;
  sheets?: number;
  encoding?: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: Date;
  updatedAt?: Date;
  attachments?: Attachment[];
  metadata?: MessageMetadata;
}

export interface Attachment {
  id: string;
  name: string;
  type: string;
  url: string;
  size: number;
}

export interface MessageMetadata {
  model?: string;
  tokens?: number;
  finishReason?: string;
}

export interface Job {
  id: string;
  userId: string;
  fileId: string;
  type: JobType;
  status: JobStatus;
  progress: number;
  result?: JobResult;
  error?: string;
  startedAt: Date;
  completedAt?: Date;
  createdAt: Date;
}

export type JobType = 'transcription' | 'translation' | 'summary' | 'embedding' | 'indexing';

export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface JobResult {
  data?: unknown;
  outputUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  messages: Message[];
  fileIds: string[];
  createdAt: Date;
  updatedAt: Date;
  lastMessageAt: Date;
}

export interface Project {
  id: string;
  userId: string;
  name: string;
  description?: string;
  fileIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Document {
  id: string;
  userId: string;
  fileId: string;
  content: string;
  chunks: DocumentChunk[];
  createdAt: Date;
  updatedAt: Date;
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  content: string;
  embedding: number[];
  startIndex: number;
  endIndex: number;
  metadata: Record<string, unknown>;
}

export interface SearchResult {
  id: string;
  documentId: string;
  chunkId: string;
  content: string;
  score: number;
  metadata: Record<string, unknown>;
}

export interface ApiKey {
  id: string;
  userId: string;
  name: string;
  key: string;
  prefix: string;
  createdAt: Date;
  expiresAt?: Date;
  lastUsedAt?: Date;
}

export interface Webhook {
  id: string;
  userId: string;
  url: string;
  events: string[];
  secret: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export type Nullable<T> = T | null;

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;