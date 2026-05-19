import { useCallback } from "react";
import { useUploadStore } from "@/store/useUploadStore";

export function useUpload() {
  const {
    files,
    uploadedFiles,
    isLoading,
    error,
    uploadFile,
    removeFile,
    deleteUploadedFile,
    fetchFiles,
    deleteFile,
    clearError,
  } = useUploadStore();

  const handleUpload = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList) return;

      for (let i = 0; i < fileList.length; i++) {
        await uploadFile(fileList[i]);
      }
    },
    [uploadFile]
  );

  return {
    files,
    uploadedFiles,
    isLoading,
    error,
    handleUpload,
    removeFile,
    deleteUploadedFile,
    fetchFiles,
    deleteFile,
    clearError,
  };
}