import { create } from "zustand";
import { filesApi, type File as ApiFile } from "@/lib/api";

interface UploadFile {
  id: string;
  file: globalThis.File;
  progress: number;
  status: "pending" | "uploading" | "success" | "error";
  error?: string;
  previewUrl?: string;
}

interface UploadState {
  files: UploadFile[];
  uploadedFiles: ApiFile[];
  isLoading: boolean;
  error: string | null;
  uploadFile: (file: globalThis.File) => Promise<void>;
  removeFile: (id: string) => void;
  fetchFiles: () => Promise<void>;
  deleteFile: (id: string) => Promise<void>;
  clearError: () => void;
  addLocalFile: (file: ApiFile) => void;
}

export const useUploadStore = create<UploadState>((set, get) => ({
  files: [],
  uploadedFiles: [],
  isLoading: false,
  error: null,

  uploadFile: async (file: globalThis.File) => {
    const tempId = Math.random().toString(36).substring(7);
    const previewUrl = URL.createObjectURL(file);
    
    set((state) => ({
      files: [...state.files, { id: tempId, file, progress: 0, status: "pending", previewUrl }],
    }));

    try {
      set((state) => ({
        files: state.files.map((f) =>
          f.id === tempId ? { ...f, status: "uploading" } : f
        ),
      }));

      // Simulate progress
      for (let i = 0; i <= 90; i += 10) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        set((state) => ({
          files: state.files.map((f) =>
            f.id === tempId ? { ...f, progress: i } : f
          ),
        }));
      }

      // Try to upload to API
      try {
        const uploaded = await filesApi.upload(file, (progress) => {
          set((state) => ({
            files: state.files.map((f) =>
              f.id === tempId ? { ...f, progress } : f
            ),
          }));
        });
        
        set((state) => ({
          files: state.files.filter((f) => f.id !== tempId),
          uploadedFiles: [...state.uploadedFiles, uploaded],
        }));
      } catch (apiError) {
        // If API fails, add as local file (demo mode)
        const localFile: ApiFile = {
          id: `local-${Date.now()}`,
          name: file.name,
          type: file.type,
          size: file.size,
          url: previewUrl,
          userId: "",
          createdAt: new Date().toISOString(),
        };
        
        set((state) => ({
          files: state.files.filter((f) => f.id !== tempId),
          uploadedFiles: [...state.uploadedFiles, localFile],
        }));
        
        // Save to localStorage for persistence
        const allFiles = [...get().uploadedFiles, localFile];
        if (typeof window !== "undefined") {
          localStorage.setItem("omnimind_files", JSON.stringify(allFiles));
        }
      }
    } catch (error: any) {
      set((state) => ({
        files: state.files.map((f) =>
          f.id === tempId ? { ...f, status: "error", error: error.message } : f
        ),
      }));
    }
  },

  addLocalFile: (file: ApiFile) => {
    set((state) => ({
      uploadedFiles: [...state.uploadedFiles, file],
    }));
  },

  removeFile: (id: string) => {
    set((state) => ({
      files: state.files.filter((f) => f.id !== id),
    }));
  },

  fetchFiles: async () => {
    set({ isLoading: true, error: null });
    try {
      // First try API
      const files = await filesApi.list();
      set({ uploadedFiles: files, isLoading: false });
    } catch (error: any) {
      // If API fails, check localStorage
      if (typeof window !== "undefined") {
        const localFiles = localStorage.getItem("omnimind_files");
        if (localFiles) {
          set({ uploadedFiles: JSON.parse(localFiles), isLoading: false });
        } else {
          set({ uploadedFiles: [], isLoading: false });
        }
      } else {
        set({ error: error.message, isLoading: false });
      }
    }
  },

  deleteFile: async (id: string) => {
    try {
      await filesApi.delete(id);
      set((state) => ({
        uploadedFiles: state.uploadedFiles.filter((f) => f.id !== id),
      }));
      if (typeof window !== "undefined") {
        const allFiles = get().uploadedFiles.filter((f) => f.id !== id);
        localStorage.setItem("omnimind_files", JSON.stringify(allFiles));
      }
    } catch (error: any) {
      set({ error: error.message });
    }
  },

  clearError: () => set({ error: null }),
}));