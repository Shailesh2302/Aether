import { useChatStore } from "@/store/useChatStore";

export function useChat() {
  const {
    messages,
    isLoading,
    isStreaming,
    error,
    sendMessage,
    clearMessages,
  } = useChatStore();

  return {
    messages,
    isLoading,
    isStreaming,
    error,
    sendMessage,
    clearMessages,
  };
}