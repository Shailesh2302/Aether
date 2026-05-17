import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Bot, User } from "lucide-react";
import type { ChatMessage } from "@/lib/api";

interface ChatMessageProps {
  message: ChatMessage;
}

export function ChatMessageComponent({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "flex gap-3",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      <Avatar className="h-8 w-8">
        <AvatarImage src={isUser ? undefined : "/bot-avatar.png"} />
        <AvatarFallback className={isUser ? "bg-primary" : "bg-muted"}>
          {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
        </AvatarFallback>
      </Avatar>
      <div
        className={cn(
          "rounded-lg px-4 py-2 max-w-[80%]",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted"
        )}
      >
        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        <p className="text-xs opacity-60 mt-1">
          {new Date(message.createdAt).toLocaleTimeString()}
        </p>
      </div>
    </div>
  );
}