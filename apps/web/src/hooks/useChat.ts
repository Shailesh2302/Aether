import { useChatStore } from "@/store/useChatStore";

export function useChat() {
  const {
    messages,
    sources,
    isLoading,
    error,
    sendMessage,
    clearMessages,
    clearError,
  } = useChatStore();

  return {
    messages,
    sources,
    isLoading,
    error,
    sendMessage,
    clearMessages,
    clearError,
  };
}
