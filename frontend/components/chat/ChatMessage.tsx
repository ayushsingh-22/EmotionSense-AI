'use client';

import { memo, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Bot, User, Copy, Edit3, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface ChatMessageProps {
  id: string;
  message: string;
  role: 'user' | 'assistant';
  timestamp?: string;
  isLoading?: boolean;
  editable?: boolean;
  onEditRequest?: (id: string) => void;
  onRegenerate?: () => void;
  isEdited?: boolean;
  isHighlighted?: boolean;
}

const messageVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
};

export const ChatMessage = memo(function ChatMessage({
  id,
  message,
  role,
  timestamp,
  isLoading = false,
  editable = false,
  onEditRequest,
  onRegenerate,
  isEdited = false,
  isHighlighted = false,
}: ChatMessageProps) {
  const isUser = role === 'user';

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(message);
    } catch (error) {
      console.error('Failed to copy message', error);
    }
  }, [message]);

  const formattedTime = useMemo(() => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  }, [timestamp]);

  return (
    <motion.div
      variants={messageVariants}
      initial="initial"
      animate="animate"
      layout
      className={cn(
        'group relative flex w-full gap-4',
        isUser ? 'justify-end' : 'justify-start'
      )}
    >
      {!isUser && (
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-sm">
          <Bot className="h-4 w-4" />
        </div>
      )}

      <div
        className={cn(
          'max-w-2xl space-y-2 rounded-2xl border border-border/60 bg-background/90 px-4 py-3 text-sm leading-relaxed shadow-sm backdrop-blur transition-colors',
          isUser && 'bg-primary/10 text-foreground border-primary/40',
          isHighlighted && 'ring-2 ring-primary/60'
        )}
      >
        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="h-2 w-2 animate-bounce rounded-full bg-current" style={{ animationDelay: '0ms' }} />
            <span className="h-2 w-2 animate-bounce rounded-full bg-current" style={{ animationDelay: '120ms' }} />
            <span className="h-2 w-2 animate-bounce rounded-full bg-current" style={{ animationDelay: '240ms' }} />
          </div>
        ) : (
          <p className="whitespace-pre-wrap break-words text-base text-foreground/90">
            {message}
          </p>
        )}

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {isEdited && <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium">Edited</span>}
          {formattedTime && <span>{formattedTime}</span>}

          <div className="ml-auto flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <Button
              variant="ghost"
              size="icon"
              title="Copy message"
              onClick={handleCopy}
              className="h-7 w-7 text-muted-foreground hover:text-primary"
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>

            {isUser && editable && onEditRequest && (
              <Button
                variant="ghost"
                size="icon"
                title="Edit message"
                onClick={() => onEditRequest(id)}
                className="h-7 w-7 text-muted-foreground hover:text-primary"
              >
                <Edit3 className="h-3.5 w-3.5" />
              </Button>
            )}

            {!isUser && onRegenerate && (
              <Button
                variant="ghost"
                size="icon"
                title="Regenerate response"
                onClick={onRegenerate}
                className="h-7 w-7 text-muted-foreground hover:text-primary"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {isUser && (
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-sm">
          <User className="h-4 w-4" />
        </div>
      )}
    </motion.div>
  );
});

ChatMessage.displayName = 'ChatMessage';