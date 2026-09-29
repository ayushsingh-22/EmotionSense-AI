'use client';

import { memo, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Copy, Edit3, RefreshCw, Check } from 'lucide-react';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
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
  hasContext?: boolean;
  contextLength?: number;
  emotion?: string | null;
  confidence?: number | null;
  onEdit?: (messageId: string, newMessage: string) => void;
}

const messageVariants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
};

// One calm dot colour per emotion instead of a gradient badge — informative
// without competing for attention with the message text.
const EMOTION_DOT: Record<string, string> = {
  joy: 'bg-amber-400',
  sadness: 'bg-blue-400',
  anger: 'bg-red-400',
  fear: 'bg-purple-400',
  surprise: 'bg-pink-400',
  disgust: 'bg-green-400',
  neutral: 'bg-gray-400',
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
  emotion,
  confidence,
}: ChatMessageProps) {
  const isUser = role === 'user';
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
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

  const emotionKey = emotion?.toLowerCase();
  const emotionDot = (emotionKey && EMOTION_DOT[emotionKey]) || 'bg-muted-foreground/50';

  return (
    <motion.div
      variants={messageVariants}
      initial="initial"
      animate="animate"
      layout="position"
      className={cn(
        'group relative flex w-full items-start gap-3',
        isUser ? 'justify-end' : 'justify-start'
      )}
    >
      {!isUser && (
        <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Sparkles className="h-3.5 w-3.5" />
        </div>
      )}

      <div
        className={cn(
          'flex min-w-0 max-w-[85%] flex-col gap-1.5 sm:max-w-[75%] lg:max-w-2xl',
          isUser ? 'items-end' : 'items-start'
        )}
      >
        <div
          className={cn(
            'min-w-0 text-[15px] leading-7 transition-shadow',
            isUser
              ? 'rounded-3xl rounded-tr-lg bg-muted px-4 py-2.5 text-foreground'
              : 'px-0 py-0 text-foreground',
            isHighlighted && 'ring-2 ring-primary/40 rounded-2xl'
          )}
        >
          {isLoading ? (
            <div className="flex items-center gap-1.5 py-1.5">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground/60 [animation-delay:0ms]" />
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground/60 [animation-delay:150ms]" />
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground/60 [animation-delay:300ms]" />
            </div>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none break-words [&>p]:mb-2 [&>p:last-child]:mb-0 [&>ul]:my-2 [&>ol]:my-2 [&>ul]:list-disc [&>ol]:list-decimal [&>ul]:pl-5 [&>ol]:pl-5 [&>li]:mb-1 [&_strong]:font-semibold [&_strong]:text-foreground [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-sm">
              <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                {message}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Meta row: timestamp, edited flag, emotion chip, actions */}
        {!isLoading && (
          <div
            className={cn(
              'flex items-center gap-2 px-1 text-xs text-muted-foreground',
              isUser && 'flex-row-reverse'
            )}
          >
            {formattedTime && <span>{formattedTime}</span>}

            {isEdited && <span className="text-primary/80">Edited</span>}

            {isUser && emotion && (
              <span className="inline-flex items-center gap-1.5" title={confidence ? `${Math.round(confidence * 100)}% confidence` : undefined}>
                <span className={cn('h-1.5 w-1.5 rounded-full', emotionDot)} />
                <span className="capitalize">{emotion}</span>
              </span>
            )}

            <div
              className={cn(
                'flex items-center gap-0.5 opacity-70 transition-opacity sm:opacity-0 sm:group-hover:opacity-100',
              )}
            >
              <Button
                variant="ghost"
                size="icon"
                title="Copy message"
                onClick={handleCopy}
                className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>

              {isUser && editable && onEditRequest && (
                <Button
                  variant="ghost"
                  size="icon"
                  title="Edit message"
                  onClick={() => onEditRequest(id)}
                  className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full"
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
                  className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
});

ChatMessage.displayName = 'ChatMessage';
