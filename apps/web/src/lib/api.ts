import axios, { type AxiosInstance, type AxiosProgressEvent } from "axios";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

const TOKEN_KEY = "aether-token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
}

export const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearToken();
      if (
        typeof window !== "undefined" &&
        !window.location.pathname.startsWith("/login") &&
        !window.location.pathname.startsWith("/register")
      ) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export function extractErrorMessage(error: unknown, fallback = "Something went wrong"): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { error?: string; message?: string } | undefined;
    return data?.error || data?.message || error.message || fallback;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

// ============================================================================
// Types
// ============================================================================

export interface User {
  id: string;
  email: string;
  name: string | null;
  avatar: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    files: number;
    sessions: number;
    clips: number;
  };
}

export interface UserStats {
  totalFiles: number;
  totalClips: number;
  totalSessions: number;
  storageUsed: number;
}

export type FileStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

export interface FileItem {
  id: string;
  name: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string | null;
  path: string;
  thumbnailUrl?: string | null;
  duration?: number | null;
  status: FileStatus;
  processingJob?: string | null;
  metadata?: Record<string, unknown> | null;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export type ClipStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

export interface Clip {
  id: string;
  title: string;
  description: string | null;
  startTime: number;
  endTime: number;
  thumbnail: string | null;
  videoUrl: string | null;
  status: ClipStatus;
  tags: string[];
  fileId: string | null;
  userId: string;
  file?: {
    id: string;
    name: string;
    originalName: string;
  };
  createdAt: string;
  updatedAt: string;
}

export type MessageRole = "USER" | "ASSISTANT" | "SYSTEM";

export interface Message {
  id: string;
  sessionId: string;
  userId: string;
  role: MessageRole;
  content: string;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface Session {
  id: string;
  userId: string;
  fileId: string | null;
  title: string;
  type: "CHAT" | "SEARCH" | "CLIP" | "ANALYTICS";
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
}

export interface ChatSource {
  fileId: string;
  fileName: string;
  timestamp?: number;
  text: string;
}

export interface ChatResponse {
  message: string;
  sources?: ChatSource[];
  sessionId?: string;
}

export interface TranscriptSegment {
  id?: string;
  startTime: number;
  endTime: number;
  text: string;
}

export interface SearchResult {
  id: string;
  fileId: string;
  fileName: string;
  snippet: string;
  timestamp?: number;
  score: number;
  mimeType?: string;
}

export interface VideoMoment {
  start_sec: number;
  end_sec: number;
  description: string;
  importance_score: number;
}

export interface VideoHighlight {
  start_sec: number;
  end_sec: number;
  title: string;
  summary: string;
  importance_score: number;
  category: string;
}

export interface VideoTopic {
  topic: string;
  timestamp_sec: number;
  keywords: string[];
  relevance_score: number;
}

export interface SmartClip {
  start_sec: number;
  end_sec: number;
  title: string;
  description: string;
  importance_score: number;
  category: string;
}

export interface MomentsResponse {
  file_id: string;
  moments: VideoMoment[];
  total_duration_sec: number;
  transcript_segments: TranscriptSegment[];
}

export interface HighlightsResponse {
  file_id: string;
  highlights: VideoHighlight[];
  video_summary: string;
  topics_covered: string[];
}

export interface TopicsResponse {
  file_id: string;
  topics: VideoTopic[];
  total_duration_sec: number;
}

export interface SmartClipsResponse {
  file_id: string;
  clips: SmartClip[];
}

export interface VideoSummaryResponse {
  file_id?: string;
  summary: string;
  topics?: string[];
  key_themes?: string[];
  duration_sec?: number;
}

export interface VideoStatusResponse {
  file_id: string;
  status: string;
  progress: number;
  transcript_ready: boolean;
  indexed: boolean;
  moments_detected: number;
  highlights_generated: number;
}

// ============================================================================
// Auth API
// ============================================================================

export const authApi = {
  async register(email: string, password: string, name: string) {
    const { data } = await api.post<{ user: User; token: string }>(
      "/auth/register",
      { email, password, name }
    );
    if (data.token) setToken(data.token);
    return data;
  },

  async login(email: string, password: string) {
    const { data } = await api.post<{ user: User; token: string }>(
      "/auth/login",
      { email, password }
    );
    if (data.token) setToken(data.token);
    return data;
  },

  async logout() {
    try {
      await api.post("/auth/logout");
    } finally {
      clearToken();
    }
  },

  async me() {
    const { data } = await api.get<User>("/auth/me");
    return data;
  },
};

// ============================================================================
// User API
// ============================================================================

export const userApi = {
  async getProfile() {
    const { data } = await api.get<User>("/users/profile");
    return data;
  },

  async updateProfile(payload: { name?: string; email?: string; avatar?: string }) {
    const { data } = await api.put<User>("/users/profile", payload);
    return data;
  },

  async getStats() {
    const { data } = await api.get<UserStats>("/users/stats");
    return data;
  },
};

// ============================================================================
// Files API
// ============================================================================

export const filesApi = {
  async list(): Promise<FileItem[]> {
    const { data } = await api.get<{ files?: FileItem[] } | FileItem[]>("/files");
    if (Array.isArray(data)) return data;
    return data.files ?? [];
  },

  async get(id: string) {
    const { data } = await api.get<{ file: FileItem } | FileItem>(`/files/${id}`);
    if ("file" in data) return data.file;
    return data;
  },

  async delete(id: string) {
    const { data } = await api.delete(`/files/${id}`);
    return data;
  },

  async upload(file: File, onProgress?: (progress: number) => void) {
    const formData = new FormData();
    formData.append("file", file);
    const { data } = await api.post<{ file: FileItem } | FileItem>(
      "/files/upload",
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (e: AxiosProgressEvent) => {
          if (onProgress && e.total) {
            onProgress(Math.round((e.loaded * 100) / e.total));
          }
        },
      }
    );
    if ("file" in data) return data.file;
    return data;
  },

  async triggerIndex(fileId: string) {
    const { data } = await api.post("/index", { fileId });
    return data;
  },
};

// ============================================================================
// Chat API
// ============================================================================

export const chatApi = {
  async send(
    message: string,
    history: ChatMessage[],
    fileId?: string,
    transcript?: TranscriptSegment[]
  ): Promise<ChatResponse> {
    const { data } = await api.post<ChatResponse>("/chat", {
      message,
      history,
      fileId,
      transcript,
    });
    return data;
  },
};

// ============================================================================
// Search API
// ============================================================================

export const searchApi = {
  async search(query: string) {
    const { data } = await api.get<
      { results: SearchResult[] } | SearchResult[]
    >("/search", { params: { q: query } });
    if (Array.isArray(data)) return data;
    return data.results ?? [];
  },
};

// ============================================================================
// Clips API
// ============================================================================

export const clipsApi = {
  async list(fileId?: string): Promise<Clip[]> {
    const { data } = await api.get<{ clips?: Clip[] } | Clip[]>("/clips", {
      params: fileId ? { fileId } : undefined,
    });
    if (Array.isArray(data)) return data;
    return data.clips ?? [];
  },

  async create(payload: {
    fileId: string;
    startTime: number;
    endTime: number;
    title: string;
    description?: string;
  }) {
    const { data } = await api.post<Clip>("/clips", payload);
    return data;
  },

  async generate(payload: {
    fileId: string;
    startTime: number;
    endTime: number;
    title?: string;
  }) {
    const { data } = await api.post("/clips/generate", payload);
    return data;
  },

  async delete(id: string) {
    const { data } = await api.delete(`/clips/${id}`);
    return data;
  },
};

// ============================================================================
// Video Intelligence API
// ============================================================================

function cleanParams<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== null)
  ) as Partial<T>;
}

export const videoIntelligenceApi = {
  async getMoments(
    fileId: string,
    query?: string,
    topK?: number
  ): Promise<MomentsResponse> {
    const { data } = await api.post<MomentsResponse>(
      "/video/moments",
      cleanParams({ fileId, query, topK })
    );
    return data;
  },

  async getHighlights(
    fileId: string,
    categories?: string[],
    maxHighlights?: number
  ): Promise<HighlightsResponse> {
    const { data } = await api.post<HighlightsResponse>(
      "/video/highlights",
      cleanParams({ fileId, categories, maxHighlights })
    );
    return data;
  },

  async getTopics(fileId: string): Promise<TopicsResponse> {
    const { data } = await api.get<TopicsResponse>("/video/topics", {
      params: { fileId },
    });
    return data;
  },
};

// ============================================================================
// Video Features API
// ============================================================================

export const videoApi = {
  async getSummary(fileId: string): Promise<VideoSummaryResponse> {
    const { data } = await api.post<VideoSummaryResponse>(
      "/video-features/summary",
      { fileId }
    );
    return data;
  },

  async getStatus(fileId: string): Promise<VideoStatusResponse> {
    const { data } = await api.get<VideoStatusResponse>(
      `/video-features/status/${fileId}`
    );
    return data;
  },

  async getSmartClips(
    fileId: string,
    maxClips = 5
  ): Promise<SmartClipsResponse> {
    const { data } = await api.post<SmartClipsResponse>(
      "/video-features/smart-clips",
      { fileId, maxClips }
    );
    return data;
  },

  async ask(fileId: string, question: string, signal?: AbortSignal) {
    const response = await fetch(`${API_URL}/video-features/ask`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      },
      body: JSON.stringify({ fileId, question }),
      signal,
    });
    if (!response.ok || !response.body) {
      throw new Error("Failed to get answer");
    }
    return response.body;
  },
};
