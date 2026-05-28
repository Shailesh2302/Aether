import { create } from "zustand";
import { persist } from "zustand/middleware";
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
  deleteUploadedFile: (id: string) => void;
  fetchFiles: () => Promise<void>;
  deleteFile: (id: string) => Promise<void>;
  clearError: () => void;
  addLocalFile: (file: ApiFile) => void;
}

function safeFiles(arr: unknown): ApiFile[] {
  return Array.isArray(arr) ? arr.filter((f): f is ApiFile => f && typeof f === 'object' && 'id' in f) : [];
}

export const useUploadStore = create<UploadState>()(
  persist(
    (set) => ({
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

          for (let i = 0; i <= 90; i += 10) {
            await new Promise((resolve) => setTimeout(resolve, 50));
            set((state) => ({
              files: state.files.map((f) =>
                f.id === tempId ? { ...f, progress: i } : f
              ),
            }));
          }

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
          } catch {
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

      deleteUploadedFile: (id: string) => {
        set((state) => ({
          uploadedFiles: state.uploadedFiles.filter((f) => f.id !== id),
        }));
      },

      fetchFiles: async () => {
        set({ isLoading: true, error: null });
        try {
          const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
          if (!token) {
            console.log("No token found in localStorage");
            set({ isLoading: false });
            return;
          }
          const files = await filesApi.list();
          console.log("Fetched files:", files);
          set({ uploadedFiles: files, isLoading: false });
        } catch (error: any) {
          console.error("Failed to fetch files:", error);
          set({ isLoading: false, error: error.message });
        }
      },

      deleteFile: async (id: string) => {
        try {
          await filesApi.delete(id);
        } catch {
        }
        set((state) => ({
          uploadedFiles: state.uploadedFiles.filter((f) => f.id !== id),
        }));
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: "aether-files",
      partialize: (state) => ({ uploadedFiles: state.uploadedFiles }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.uploadedFiles = safeFiles(state.uploadedFiles);
        }
      },
    }
  )
);