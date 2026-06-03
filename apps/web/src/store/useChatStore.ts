import { create } from "zustand";
import { chatApi, type ChatMessage, type ChatSource, extractErrorMessage } from "@/lib/api";

interface ChatState {
  messages: ChatMessage[];
  sources: ChatSource[];
  isLoading: boolean;
  error: string | null;
  sendMessage: (
    content: string,
    options?: { fileId?: string; transcript?: { startTime: number; endTime: number; text: string }[] }
  ) => Promise<void>;
  clearMessages: () => void;
  setMessages: (messages: ChatMessage[]) => void;
  clearError: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  sources: [],
  isLoading: false,
  error: null,

  sendMessage: async (content, options) => {
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    };

    set((state) => ({
      messages: [...state.messages, userMessage],
      isLoading: true,
      error: null,
    }));

    try {
      const history = get().messages.slice(-20);
      const response = await chatApi.send(
        content,
        history,
        options?.fileId,
        options?.transcript
      );

      const assistantMessage: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        role: "assistant",
        content: response.message,
        createdAt: new Date().toISOString(),
      };

      set((state) => ({
        messages: [...state.messages, assistantMessage],
        sources: response.sources ?? [],
        isLoading: false,
      }));
    } catch (error) {
      set({
        error: extractErrorMessage(error, "Failed to send message"),
        isLoading: false,
      });
    }
  },

  clearMessages: () => set({ messages: [], sources: [], error: null }),
  setMessages: (messages) => set({ messages }),
  clearError: () => set({ error: null }),
}));
