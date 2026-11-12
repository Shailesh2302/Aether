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
    const { fileId } = get();

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
      sources: [],
    }));

    try {
      const response = await chatApi.stream(content, { fileId: fileId || undefined }, {
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
        messages: state.messages.filter((m) => !(m.id === assistantId && !m.content)),
        error: extractErrorMessage(error, "Failed to send message"),
        isLoading: false,
      }));
    }
  },

  setCurrentTime: (time) => set({ currentTime: time }),
  setTranscript: (transcript) => set({ transcript }),
  clearChat: () => set({ messages: [], sources: [], error: null }),
}));
