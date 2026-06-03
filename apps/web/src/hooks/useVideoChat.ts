import { useVideoChatStore } from "@/store/useVideoChatStore";

export function useVideoChat() {
  const {
    fileId,
    messages,
    sources,
    transcript,
    currentTime,
    isLoading,
    error,
    sendMessage,
    setCurrentTime,
    setTranscript,
    setFileId,
    clearChat,
  } = useVideoChatStore();

  return {
    fileId,
    messages,
    sources,
    transcript,
    currentTime,
    isLoading,
    error,
    sendMessage,
    setCurrentTime,
    setTranscript,
    setFileId,
    clearChat,
  };
}
