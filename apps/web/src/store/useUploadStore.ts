import { create } from "zustand";
import { filesApi, type FileItem, extractErrorMessage } from "@/lib/api";

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
  isLoading: boolean;
  isFetching: boolean;
  error: string | null;
  uploadFile: (file: File) => Promise<FileItem | null>;
  removeUpload: (id: string) => void;
  clearUploads: () => void;
  fetchFiles: () => Promise<void>;
  deleteFile: (id: string) => Promise<void>;
  addLocalFile: (file: FileItem) => void;
  clearError: () => void;
}

export const useUploadStore = create<UploadState>((set, get) => ({
  uploads: [],
  files: [],
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

  fetchFiles: async () => {
    set({ isFetching: true, error: null });
    try {
      const files = await filesApi.list();
      set({ files, isFetching: false });
    } catch (error) {
      set({
        error: extractErrorMessage(error, "Failed to load files"),
        isFetching: false,
      });
    }
  },

  deleteFile: async (id) => {
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

  addLocalFile: (file) => {
    set((state) => ({ files: [file, ...state.files] }));
  },

  clearError: () => set({ error: null }),
}));
