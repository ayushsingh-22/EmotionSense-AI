'use client';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Bot, User, Copy, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { EMOTION_CONFIG } from '@/types';

interface ChatBubbleProps {
  message: string;
  isUser: boolean;
  timestamp?: string;
  emotion?: string;
  confidence?: number;
  isLoading?: boolean;
  hasContext?: boolean;
  contextLength?: number;
}

export function ChatBubble({ 
  message, 
  isUser, 
  timestamp, 
  emotion, 
  confidence,
  isLoading = false,
  hasContext = false,
  contextLength = 0
}: ChatBubbleProps) {
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      toast({
        title: "Copied to clipboard",
        description: "Message copied successfully",
      });
    } catch {
      toast({
        title: "Copy failed",
        description: "Could not copy message",
        variant: "destructive",
      });
    }
  };

  const handleSpeak = () => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(message);
      utterance.rate = 0.8;
      utterance.pitch = 1;
      speechSynthesis.speak(utterance);
    }
  };

  return (
    <div className={cn(
      "flex items-start gap-3 my-6 group",
      isUser ? "justify-end" : "justify-start"
    )}>
      {/* Avatar - Left side for bot */}
      {!isUser && (
        <div className="flex-shrink-0">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
            <Bot className="h-5 w-5 text-white" />
          </div>
        </div>
      )}

      {/* Message Content */}
      <div className={cn(
        "flex flex-col max-w-[70%] space-y-2",
        isUser ? "items-end" : "items-start"
      )}>
        {/* Message Bubble */}
        <div className={cn(
          "relative px-6 py-4 rounded-2xl shadow-lg transition-all duration-300 group-hover:shadow-xl",
          isUser
            ? "bg-gradient-to-br from-blue-500 to-purple-600 text-white rounded-br-md"
            : "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-bl-md"
        )}>
          {isLoading ? (
            <div className="flex items-center space-x-2">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
              <span className="text-sm opacity-70">MantrAI is thinking...</span>
            </div>
          ) : (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{message}</p>
          )}

          {/* Message Actions */}
          {!isLoading && (
            <div className={cn(
              "absolute top-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex space-x-1",
              isUser ? "-left-20" : "-right-20"
            )}>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopy();
                }}
                className="h-7 w-7 p-0 bg-white/90 dark:bg-gray-800/90 hover:bg-white dark:hover:bg-gray-700 shadow-sm"
              >
                <Copy className="h-3 w-3" />
              </Button>
              {!isUser && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSpeak();
                  }}
                  className="h-7 w-7 p-0 bg-white/90 dark:bg-gray-800/90 hover:bg-white dark:hover:bg-gray-700 shadow-sm"
                >
                  <Volume2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Metadata */}
        <div className={cn(
          "flex items-center gap-2 text-xs text-muted-foreground flex-wrap",
          isUser ? "flex-row-reverse" : "flex-row"
        )}>
          {timestamp && (
            <span>{new Date(timestamp).toLocaleTimeString()}</span>
          )}
          
          {emotion && confidence && (
            <Badge 
              variant="secondary" 
              className={cn(
                "text-xs px-2 py-1 rounded-full",
                EMOTION_CONFIG[emotion as keyof typeof EMOTION_CONFIG]?.color || "bg-gray-100"
              )}
            >
              {emotion} ({Math.round(confidence * 100)}%)
            </Badge>
          )}
          
          {hasContext && contextLength > 0 && !isUser && (
            <Badge 
              variant="outline" 
              className="text-xs px-2 py-1 rounded-full bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300"
              title={`Response considers ${contextLength} previous message${contextLength > 1 ? 's' : ''}`}
            >
              🧠 Context: {contextLength}
            </Badge>
          )}
        </div>
      </div>

      {/* Avatar - Right side for user */}
      {isUser && (
        <div className="flex-shrink-0">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg">
            <User className="h-5 w-5 text-white" />
          </div>
        </div>
      )}
    </div>
  );
}