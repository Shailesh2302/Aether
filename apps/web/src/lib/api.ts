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
  createdAt: string;
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
  userId: string;
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
  name: string;
  startTime: number;
  endTime: number;
  fileId: string;
  createdAt: string;
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
    return response.data;
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
    return response.data;
  },
  delete: async (id: string) => {
    const response = await api.delete(`/files/${id}`);
    return response.data;
  },
  get: async (id: string) => {
    const response = await api.get(`/files/${id}`);
    return response.data;
  },
};

export const chatApi = {
  send: async (message: string, history: ChatMessage[]) => {
    const response = await api.post("/chat", { message, history });
    return response.data;
  },
  stream: async (message: string, history: ChatMessage[]) => {
    const response = await api.post(
      "/chat/stream",
      { message, history },
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
  create: async (fileId: string, startTime: number, endTime: number, name: string) => {
    const response = await api.post("/clips", { fileId, startTime, endTime, name });
    return response.data;
  },
  delete: async (id: string) => {
    const response = await api.delete(`/clips/${id}`);
    return response.data;
  },
};