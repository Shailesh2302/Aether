"use client";

import { useRef, useEffect } from "react";
import { useChat } from "@/hooks/useChat";
import { ChatMessageComponent } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { Loader2, MessageSquare } from "lucide-react";

export function ChatInterface() {
  const { messages, isLoading, isStreaming, sendMessage, clearMessages } = useChat();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isStreaming]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          <h2 className="font-semibold">AI Assistant</h2>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearMessages}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Clear chat
          </button>
        )}
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <MessageSquare className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Start a conversation</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Ask me anything about your files, videos, or let me help you with tasks.
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <ChatMessageComponent key={message.id} message={message} />
          ))
        )}
        
        {(isLoading || isStreaming) && (
          <div className="flex gap-3">
            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
            <div className="bg-muted rounded-lg px-4 py-2">
              <p className="text-sm text-muted-foreground">Thinking...</p>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t">
        <ChatInput onSend={sendMessage} disabled={isLoading} />
      </div>
    </div>
  );
}