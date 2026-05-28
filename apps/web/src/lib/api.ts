import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== "undefined") {
        localStorage.removeItem("token");
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  createdAt?: string;
}

export interface File {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  thumbnailUrl?: string;
  duration?: number;
  createdAt: string;
  userId?: string;
  status?: "pending" | "processing" | "completed" | "failed";
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface SearchResult {
  id: string;
  fileId: string;
  fileName: string;
  snippet: string;
  timestamp?: number;
  score: number;
}

export interface Clip {
  id: string;
  title: string;
  startTime: number;
  endTime: number;
  fileId: string;
  createdAt: string;
}

export interface TranscriptSegment {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
}

export const authApi = {
  login: async (email: string, password: string) => {
    const response = await api.post("/auth/login", { email, password });
    return response.data;
  },
  register: async (email: string, password: string, name: string) => {
    const response = await api.post("/auth/register", { email, password, name });
    return response.data;
  },
  logout: async () => {
    const response = await api.post("/auth/logout");
    return response.data;
  },
  me: async () => {
    const response = await api.get("/auth/me");
    return response.data;
  },
};

export const filesApi = {
  list: async () => {
    const response = await api.get("/files");
    const files = response.data.files ?? response.data;
    // Map mimeType to type for consistency
    return Array.isArray(files) ? files.map((f: any) => ({
      ...f,
      type: f.mimeType,
      status: f.status?.toLowerCase(),
    })) : files;
  },
  upload: async (file: globalThis.File, onProgress?: (progress: number) => void) => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await api.post("/files/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (e) => {
        if (onProgress && e.total) {
          onProgress(Math.round((e.loaded * 100) / e.total));
        }
      },
    });
    const data = response.data;
    const f = data.file ?? data;
    return {
      id: f.id,
      name: f.originalName ?? f.name,
      type: f.mimeType,
      size: f.size,
      url: f.url ?? "",
      createdAt: f.createdAt,
      status: f.status ?? "pending",
    };
  },
  delete: async (id: string) => {
    const response = await api.delete(`/files/${id}`);
    return response.data;
  },
  get: async (id: string) => {
    const response = await api.get(`/files/${id}`);
    return response.data;
  },
  updateStatus: async (id: string, status: string) => {
    const response = await api.patch(`/files/${id}`, { status });
    return response.data;
  },
};

export interface ChatResponse {
  message: string;
  sources?: Array<{
    fileId: string;
    fileName: string;
    timestamp?: number;
    text: string;
  }>;
}

export const chatApi = {
  send: async (message: string, history: ChatMessage[], fileId?: string, transcript?: TranscriptSegment[]): Promise<ChatResponse> => {
    const response = await api.post("/chat", { message, history, fileId, transcript });
    return response.data;
  },
  stream: async (message: string, history: ChatMessage[], fileId?: string) => {
    const response = await api.post(
      "/chat/stream",
      { message, history, fileId },
      { responseType: "stream" }
    );
    return response.data;
  },
};

export const searchApi = {
  search: async (query: string) => {
    const response = await api.get("/search", { params: { q: query } });
    return response.data;
  },
};

export const clipsApi = {
  list: async (fileId?: string) => {
    const response = await api.get("/clips", { params: { fileId } });
    return response.data;
  },
  create: async (fileId: string, startTime: number, endTime: number, title: string) => {
    const response = await api.post("/clips", { fileId, startTime, endTime, title });
    return response.data;
  },
  generate: async (fileId: string, startTime: number, endTime: number, title?: string) => {
    const response = await api.post("/clips/generate", { fileId, startTime, endTime, title });
    return response.data;
  },
  delete: async (id: string) => {
    const response = await api.delete(`/clips/${id}`);
    return response.data;
  },
};

export const indexingApi = {
  triggerIndex: async (fileId: string) => {
    const response = await api.post("/index", { fileId });
    return response.data;
  },
};

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
  category: string;
  importance_score: number;
}

export interface SmartClip {
  start_sec: number;
  end_sec: number;
  title: string;
  description: string;
  importance_score: number;
  category: string;
}

export interface VideoTopic {
  topic: string;
  timestamp_sec: number;
  keywords: string[];
  relevance_score: number;
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

export interface SmartClipsResponse {
  file_id: string;
  clips: SmartClip[];
}

export interface TopicsResponse {
  file_id: string;
  topics: VideoTopic[];
  total_duration_sec: number;
}

function cleanParams(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([_, v]) => v !== undefined));
}

export const videoIntelligenceApi = {
  getMoments: async (fileId: string, query?: string, topK?: number): Promise<MomentsResponse> => {
    const response = await api.post("/video/moments", cleanParams({ fileId, query, topK }));
    return response.data;
  },
  getHighlights: async (fileId: string, categories?: string[], maxHighlights?: number): Promise<HighlightsResponse> => {
    const response = await api.post("/video/highlights", cleanParams({ fileId, categories, maxHighlights }));
    return response.data;
  },
  getTopics: async (fileId: string): Promise<TopicsResponse> => {
    const response = await api.get("/video/topics", { params: { fileId } });
    return response.data;
  },
};