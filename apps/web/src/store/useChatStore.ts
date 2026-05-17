import { create } from "zustand";
import { chatApi, type ChatMessage } from "@/lib/api";

interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  isStreaming: boolean;
  error: string | null;
  sendMessage: (content: string) => Promise<void>;
  clearMessages: () => void;
  setMessages: (messages: ChatMessage[]) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isLoading: false,
  isStreaming: false,
  error: null,

  sendMessage: async (content: string) => {
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    };

    set((state) => ({
      messages: [...state.messages, userMessage],
      isLoading: true,
      isStreaming: true,
      error: null,
    }));

    try {
      const history = get().messages.slice(-20);
      const response = await chatApi.send(content, history);

      const assistantMessage: ChatMessage = {
        id: Date.now().toString() + 1,
        role: "assistant",
        content: response.message,
        createdAt: new Date().toISOString(),
      };

      set((state) => ({
        messages: [...state.messages, assistantMessage],
        isLoading: false,
        isStreaming: false,
      }));
    } catch (error: any) {
      set({
        error: error.response?.data?.message || "Failed to send message",
        isLoading: false,
        isStreaming: false,
      });
    }
  },

  clearMessages: () => set({ messages: [] }),

  setMessages: (messages: ChatMessage[]) => set({ messages }),
}));