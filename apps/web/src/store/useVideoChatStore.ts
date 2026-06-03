import { create } from "zustand";
import {
  chatApi,
  type ChatMessage,
  type ChatSource,
  type TranscriptSegment,
  extractErrorMessage,
} from "@/lib/api";

interface VideoChatState {
  fileId: string;
  messages: ChatMessage[];
  sources: ChatSource[];
  transcript: TranscriptSegment[];
  currentTime: number;
  isLoading: boolean;
  error: string | null;
  sendMessage: (content: string) => Promise<void>;
  setCurrentTime: (time: number) => void;
  setTranscript: (transcript: TranscriptSegment[]) => void;
  setFileId: (fileId: string) => void;
  clearChat: () => void;
}

export const useVideoChatStore = create<VideoChatState>((set, get) => ({
  fileId: "",
  messages: [],
  sources: [],
  transcript: [],
  currentTime: 0,
  isLoading: false,
  error: null,

  setFileId: (fileId) => set({ fileId }),

  sendMessage: async (content) => {
    const { fileId, transcript, messages: currentMessages } = get();

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
      const history = currentMessages.slice(-20);
      const response = await chatApi.send(
        content,
        history,
        fileId || undefined,
        transcript.length > 0 ? transcript : undefined
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

  setCurrentTime: (time) => set({ currentTime: time }),
  setTranscript: (transcript) => set({ transcript }),
  clearChat: () => set({ messages: [], sources: [], error: null }),
}));
