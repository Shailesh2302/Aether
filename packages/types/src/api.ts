import { User, File, Job, Conversation, Project, SearchResult, ApiKey, Webhook } from './index';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  statusCode: number;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface RefreshTokenResponse {
  accessToken: string;
  expiresIn: number;
}

export interface FileUploadResponse {
  file: File;
  uploadUrl: string;
  fields?: Record<string, string>;
}

export interface JobResponse {
  job: Job;
  estimatedTimeRemaining?: number;
}

export interface JobListResponse {
  jobs: Job[];
  total: number;
  page: number;
  limit: number;
}

export interface ConversationResponse {
  conversation: Conversation;
  messages: import('./index').Message[];
}

export interface ConversationListResponse {
  conversations: Conversation[];
  total: number;
  page: number;
  limit: number;
}

export interface ProjectResponse {
  project: Project;
  files: File[];
}

export interface ProjectListResponse {
  projects: Project[];
  total: number;
  page: number;
  limit: number;
}

export interface SearchResponse {
  results: SearchResult[];
  query: string;
  total: number;
  processingTime: number;
}

export interface ChunkResponse {
  id: string;
  documentId: string;
  content: string;
  embedding: number[];
  startIndex: number;
  endIndex: number;
  metadata: Record<string, unknown>;
}

export interface ChunkListResponse {
  chunks: ChunkResponse[];
  total: number;
  page: number;
  limit: number;
}

export interface ApiKeyResponse {
  apiKey: ApiKey;
  secret: string;
}

export interface ApiKeyListResponse {
  apiKeys: ApiKey[];
  total: number;
}

export interface WebhookResponse {
  webhook: Webhook;
}

export interface WebhookListResponse {
  webhooks: Webhook[];
  total: number;
}

export interface WebhookEvent {
  id: string;
  type: string;
  timestamp: Date;
  data: Record<string, unknown>;
  retryCount: number;
}

export interface WebhookEventListResponse {
  events: WebhookEvent[];
  total: number;
  page: number;
  limit: number;
}

export interface UsageResponse {
  userId: string;
  period: 'daily' | 'monthly' | 'yearly';
  startDate: Date;
  endDate: Date;
  usage: UsageStats;
}

export interface UsageStats {
  filesUploaded: number;
  filesProcessed: number;
  storageUsed: number;
  apiCalls: number;
  tokensUsed: number;
  jobsCompleted: number;
}

export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;
  checks: HealthCheck[];
}

export interface HealthCheck {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message?: string;
}