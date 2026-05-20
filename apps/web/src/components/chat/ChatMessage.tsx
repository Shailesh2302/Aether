import { useState, useMemo } from "react";
import { cn, formatDuration } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Bot, User, Copy, Check, Clock } from "lucide-react";
import type { ChatMessage } from "@/lib/api";

interface ChatMessageProps {
  message: ChatMessage;
  sources?: Array<{
    timestamp?: number;
    text: string;
  }>;
  onTimestampClick?: (timestamp: number) => void;
}

export function ChatMessageComponent({ message, sources = [], onTimestampClick }: ChatMessageProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const contentWithTimestamps = useMemo(() => {
    if (!sources.length || isUser) return message.content;
    
    const parts: Array<{ type: 'text' | 'timestamp'; value: string | number }> = [];
    let lastIndex = 0;
    
    const sortedSources = [...sources].filter(s => s.timestamp).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    
    for (const source of sortedSources) {
      const timestamp = source.timestamp;
      if (!timestamp) continue;
      
      const timestampStr = `[${formatDuration(timestamp)}]`;
      const idx = message.content.indexOf(timestampStr, lastIndex);
      
      if (idx !== -1) {
        if (idx > lastIndex) {
          parts.push({ type: 'text', value: message.content.slice(lastIndex, idx) });
        }
        parts.push({ type: 'timestamp', value: timestamp });
        lastIndex = idx + timestampStr.length;
      }
    }
    
    if (lastIndex < message.content.length) {
      parts.push({ type: 'text', value: message.content.slice(lastIndex) });
    }
    
    return parts.length > 0 ? parts : message.content;
  }, [message.content, sources, isUser]);

  const renderContent = () => {
    if (Array.isArray(contentWithTimestamps)) {
      return contentWithTimestamps.map((part, i) => 
        part.type === 'timestamp' ? (
          <button
            key={i}
            onClick={() => onTimestampClick?.(part.value as number)}
            className="text-primary underline hover:text-primary/80 font-medium mx-0.5"
          >
            {formatDuration(part.value as number)}
          </button>
        ) : (
          <span key={i}>{part.value}</span>
        )
      );
    }
    return contentWithTimestamps;
  };

  return (
    <div
      className={cn(
        "flex gap-3",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarImage src={undefined} />
        <AvatarFallback className={isUser ? "bg-primary" : "bg-muted"}>
          {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
        </AvatarFallback>
      </Avatar>
      <div
        className={cn(
          "rounded-lg px-4 py-3 max-w-[80%]",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted"
        )}
      >
        <p className="text-sm whitespace-pre-wrap">{renderContent()}</p>
        <div className={cn(
          "flex items-center justify-between mt-2 gap-4",
          isUser ? "text-primary-foreground/60" : "text-muted-foreground"
        )}>
          <div className="flex items-center gap-1 text-xs">
            <Clock className="h-3 w-3" />
            <span>{new Date(message.createdAt).toLocaleTimeString()}</span>
          </div>
          
          {!isUser && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleCopy}
            >
              {copied ? (
                <Check className="h-3 w-3" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}