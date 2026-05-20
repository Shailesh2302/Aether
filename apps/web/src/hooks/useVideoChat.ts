import { useVideoChatStore } from "@/store/useVideoChatStore";

export function useVideoChat() {
  const {
    fileId,
    messages,
    sources,
    transcript,
    currentTime,
    isLoading,
    isProcessing,
    error,
    sendMessage,
    setCurrentTime,
    clearChat,
    setTranscript,
    setFileId,
  } = useVideoChatStore();

  return {
    fileId,
    messages,
    sources,
    transcript,
    currentTime,
    isLoading,
    isProcessing,
    error,
    sendMessage,
    setCurrentTime,
    clearChat,
    setTranscript,
    setFileId,
  };
}