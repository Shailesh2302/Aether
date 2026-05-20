import { create } from "zustand";
import { chatApi, type ChatMessage, type TranscriptSegment, type ChatResponse } from "@/lib/api";

interface ChatSource {
  fileId: string;
  fileName: string;
  timestamp?: number;
  text: string;
}

interface VideoChatState {
  fileId: string;
  sessionId: string;
  messages: ChatMessage[];
  sources: ChatSource[];
  transcript: TranscriptSegment[];
  currentTime: number;
  isLoading: boolean;
  isProcessing: boolean;
  error: string | null;
  sendMessage: (content: string) => Promise<void>;
  setCurrentTime: (time: number) => void;
  clearChat: () => void;
  setTranscript: (transcript: TranscriptSegment[]) => void;
  setFileId: (fileId: string) => void;
}

export const useVideoChatStore = create<VideoChatState>((set, get) => ({
  fileId: "",
  sessionId: "",
  messages: [],
  sources: [],
  transcript: [],
  currentTime: 0,
  isLoading: false,
  isProcessing: false,
  error: null,

  setFileId: (fileId: string) => set({ fileId }),

  sendMessage: async (content: string) => {
    const { fileId, transcript, messages: currentMessages } = get();
    
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    };

    set((state) => ({
      messages: [...state.messages, userMessage],
      isLoading: true,
      isProcessing: true,
      error: null,
    }));

    try {
      const history = currentMessages.slice(-20);
      const response: ChatResponse = await chatApi.send(content, history, fileId || undefined, transcript.length > 0 ? transcript : undefined);

      const assistantMessage: ChatMessage = {
        id: Date.now().toString() + 1,
        role: "assistant",
        content: response.message,
        createdAt: new Date().toISOString(),
      };

      set((state) => ({
        messages: [...state.messages, assistantMessage],
        sources: response.sources || [],
        isLoading: false,
        isProcessing: false,
      }));
    } catch (error: any) {
      set({
        error: error.response?.data?.message || "Failed to send message",
        isLoading: false,
        isProcessing: false,
      });
    }
  },

  setCurrentTime: (time: number) => set({ currentTime: time }),

  clearChat: () => set({ messages: [], sources: [], error: null }),

  setTranscript: (transcript: TranscriptSegment[]) => set({ transcript }),
}));