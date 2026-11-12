import { create } from "zustand";
import {
  filesApi,
  type FileItem,
  type FileListParams,
  extractErrorMessage,
} from "@/lib/api";

export interface UploadItem {
  id: string;
  file: File;
  progress: number;
  status: "pending" | "uploading" | "success" | "error";
  error?: string;
  previewUrl?: string;
}

interface UploadState {
  uploads: UploadItem[];
  files: FileItem[];
  nextCursor: string | null;
  hasMore: boolean;
  /** Last filters used for the file list, replayed by fetchMoreFiles. */
  listParams: FileListParams;
  isLoading: boolean;
  isFetching: boolean;
  error: string | null;
  uploadFile: (file: File) => Promise<FileItem | null>;
  removeUpload: (id: string) => void;
  clearUploads: () => void;
  fetchFiles: (params?: FileListParams) => Promise<void>;
  fetchMoreFiles: () => Promise<void>;
  deleteFile: (id: string) => Promise<void>;
  addLocalFile: (file: FileItem) => void;
  pollFileStatus: (id: string) => void;
  clearError: () => void;
}

const pollTimers = new Map<string, ReturnType<typeof setTimeout>>();

// Monotonic request id so a slow, stale list response cannot overwrite the
// results of a newer search/filter request.
let listRequestSeq = 0;

function stopPoll(id: string) {
  const t = pollTimers.get(id);
  if (t) {
    clearTimeout(t);
    pollTimers.delete(id);
  }
}

export const useUploadStore = create<UploadState>((set, get) => ({
  uploads: [],
  files: [],
  nextCursor: null,
  hasMore: false,
  listParams: {},
  isLoading: false,
  isFetching: false,
  error: null,

  uploadFile: async (file) => {
    const tempId = `upload-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const previewUrl =
      file.type.startsWith("image/") || file.type.startsWith("video/")
        ? URL.createObjectURL(file)
        : undefined;

    set((state) => ({
      uploads: [
        ...state.uploads,
        {
          id: tempId,
          file,
          progress: 0,
          status: "uploading",
          previewUrl,
        },
      ],
      isLoading: true,
    }));

    try {
      const uploaded = await filesApi.upload(file, (progress) => {
        set((state) => ({
          uploads: state.uploads.map((u) =>
            u.id === tempId ? { ...u, progress } : u
          ),
        }));
      });

      set((state) => ({
        uploads: state.uploads.map((u) =>
          u.id === tempId
            ? { ...u, status: "success", progress: 100 }
            : u
        ),
        files: [uploaded, ...state.files],
        isLoading: false,
      }));

      // Files land as PENDING/PROCESSING; poll until the worker finishes
      // so badges flip to Ready without a manual refresh.
      if (uploaded.status === "PENDING" || uploaded.status === "PROCESSING") {
        get().pollFileStatus(uploaded.id);
      }

      return uploaded;
    } catch (error) {
      const message = extractErrorMessage(error, "Upload failed");
      set((state) => ({
        uploads: state.uploads.map((u) =>
          u.id === tempId
            ? { ...u, status: "error", error: message }
            : u
        ),
        isLoading: false,
        error: message,
      }));
      return null;
    }
  },

  removeUpload: (id) => {
    set((state) => {
      const upload = state.uploads.find((u) => u.id === id);
      if (upload?.previewUrl) URL.revokeObjectURL(upload.previewUrl);
      return {
        uploads: state.uploads.filter((u) => u.id !== id),
      };
    });
  },

  clearUploads: () => {
    set((state) => {
      state.uploads.forEach((u) => {
        if (u.previewUrl) URL.revokeObjectURL(u.previewUrl);
      });
      return { uploads: [] };
    });
  },

  fetchFiles: async (params = {}) => {
    const seq = ++listRequestSeq;
    set({ isFetching: true, error: null, listParams: params });
    try {
      const page = await filesApi.list({ limit: 60, ...params });
      if (seq !== listRequestSeq) return;
      set({
        files: page.files,
        nextCursor: page.nextCursor,
        hasMore: page.hasMore,
        isFetching: false,
      });
    } catch (error) {
      if (seq !== listRequestSeq) return;
      set({
        error: extractErrorMessage(error, "Failed to load files"),
        isFetching: false,
      });
    }
  },

  fetchMoreFiles: async () => {
    const { nextCursor, hasMore, isFetching, listParams } = get();
    if (!hasMore || !nextCursor || isFetching) return;
    const seq = ++listRequestSeq;
    set({ isFetching: true, error: null });
    try {
      const page = await filesApi.list({
        limit: 60,
        ...listParams,
        cursor: nextCursor,
      });
      if (seq !== listRequestSeq) return;
      set((state) => {
        const seen = new Set(state.files.map((f) => f.id));
        return {
          files: [...state.files, ...page.files.filter((f) => !seen.has(f.id))],
          nextCursor: page.nextCursor,
          hasMore: page.hasMore,
          isFetching: false,
        };
      });
    } catch (error) {
      if (seq !== listRequestSeq) return;
      set({
        error: extractErrorMessage(error, "Failed to load more files"),
        isFetching: false,
      });
    }
  },

  deleteFile: async (id) => {
    stopPoll(id);
    try {
      await filesApi.delete(id);
      set((state) => ({
        files: state.files.filter((f) => f.id !== id),
      }));
    } catch (error) {
      set({ error: extractErrorMessage(error, "Failed to delete file") });
      // Remove from local list anyway
      set((state) => ({
        files: state.files.filter((f) => f.id !== id),
      }));
    }
  },

  pollFileStatus: (id) => {
    stopPoll(id);
    let attempts = 0;
    const tick = async () => {
      attempts += 1;
      try {
        const file = await filesApi.get(id);
        set((state) => ({
          files: state.files.map((f) => (f.id === id ? file : f)),
        }));
        if (file.status === "COMPLETED" || file.status === "FAILED") {
          stopPoll(id);
          return;
        }
      } catch {
        stopPoll(id);
        return;
      }
      if (attempts < 120) {
        pollTimers.set(id, setTimeout(tick, 5000));
      }
    };
    pollTimers.set(id, setTimeout(tick, 5000));
  },

  addLocalFile: (file) => {
    set((state) => ({ files: [file, ...state.files] }));
  },

  clearError: () => set({ error: null }),
}));
