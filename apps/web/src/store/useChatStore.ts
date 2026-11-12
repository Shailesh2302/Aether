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

export const useChatStore = create<ChatState>((set) => ({
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
    const assistantId = `msg-${Date.now() + 1}`;

    set((state) => ({
      messages: [
        ...state.messages,
        userMessage,
        {
          id: assistantId,
          role: "assistant",
          content: "",
          createdAt: new Date().toISOString(),
        },
      ],
      isLoading: true,
      error: null,
      // Sources belong to the latest answer; clear them so a new question
      // never shows citations from the previous one while it streams.
      sources: [],
    }));

    try {
      const response = await chatApi.stream(content, { fileId: options?.fileId }, {
        onSources: (sources, _versionNotes, versionConflict) => {
          set((state) => ({
            sources,
            messages: state.messages.map((m) =>
              m.id === assistantId ? { ...m, sources, versionConflict } : m
            ),
          }));
        },
        onChunk: (chunk) => {
          set((state) => ({
            messages: state.messages.map((m) =>
              m.id === assistantId ? { ...m, content: m.content + chunk } : m
            ),
          }));
        },
      });

      set((state) => ({
        messages: state.messages.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                content: response.message,
                sources: response.sources ?? m.sources,
                versionConflict: response.versionConflict ?? m.versionConflict,
              }
            : m
        ),
        sources: response.sources ?? [],
        isLoading: false,
      }));
    } catch (error) {
      set((state) => ({
        // Drop the empty placeholder; keep any partial content already streamed.
        messages: state.messages.filter((m) => !(m.id === assistantId && !m.content)),
        error: extractErrorMessage(error, "Failed to send message"),
        isLoading: false,
      }));
    }
  },

  clearMessages: () => set({ messages: [], sources: [], error: null }),
  setMessages: (messages) => set({ messages }),
  clearError: () => set({ error: null }),
}));
