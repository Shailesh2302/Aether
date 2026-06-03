import { useCallback } from "react";
import { useUploadStore } from "@/store/useUploadStore";

export function useUpload() {
  const {
    uploads,
    files,
    isLoading,
    isFetching,
    error,
    uploadFile,
    removeUpload,
    clearUploads,
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
    uploads,
    files,
    isLoading,
    isFetching,
    error,
    uploadFile,
    handleUpload,
    removeUpload,
    clearUploads,
    fetchFiles,
    deleteFile,
    clearError,
  };
}
