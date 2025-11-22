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
  hasContext?: boolean;
  contextLength?: number;
  emotion?: string | null;
  confidence?: number | null;
  onEdit?: (messageId: string, newMessage: string) => void;
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
  emotion,
  confidence,
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
        <motion.div 
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary via-primary/80 to-primary/60 text-primary-foreground shadow-lg"
          whileHover={{ scale: 1.1, rotate: 5 }}
          animate={{
            boxShadow: [
              '0 0 20px rgba(168, 85, 247, 0.3)',
              '0 0 30px rgba(168, 85, 247, 0.5)',
              '0 0 20px rgba(168, 85, 247, 0.3)',
            ],
          }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <Bot className="h-5 w-5" />
        </motion.div>
      )}

      <motion.div
        className={cn(
          'max-w-2xl space-y-2 rounded-3xl border-2 px-5 py-4 text-sm leading-relaxed shadow-xl backdrop-blur-sm transition-all duration-300',
          isUser 
            ? 'bg-gradient-to-br from-blue-500/10 via-indigo-500/10 to-purple-500/10 text-foreground border-blue-400/40 shadow-blue-500/20' 
            : 'bg-background/95 border-border/60 shadow-purple-500/10',
          isHighlighted && 'ring-4 ring-primary/40 shadow-2xl',
          'hover:shadow-2xl'
        )}
        whileHover={{ scale: 1.01 }}
      >
        {isLoading ? (
          <div className="flex items-center gap-3 text-muted-foreground py-2">
            <motion.span 
              className="h-2.5 w-2.5 rounded-full bg-gradient-to-r from-primary to-purple-600" 
              animate={{ opacity: 1 }}
              transition={{ duration: 1, repeat: Infinity, repeatType: "reverse", delay: 0 }}
            />
            <motion.span 
              className="h-2.5 w-2.5 rounded-full bg-gradient-to-r from-primary to-purple-600" 
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, repeat: Infinity, repeatType: "reverse", delay: 0.2 }}
            />
            <motion.span 
              className="h-2.5 w-2.5 rounded-full bg-gradient-to-r from-primary to-purple-600" 
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, repeat: Infinity, repeatType: "reverse", delay: 0.4 }}
            />
          </div>
        ) : (
          <>
            <p className="whitespace-pre-wrap break-words text-base text-foreground/95 leading-relaxed">
              {message}
            </p>
            
            {/* Emotion detected badge - only for user messages */}
            {isUser && emotion && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="mt-3 pt-3 border-t border-border/30"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground font-medium">Emotion Detected:</span>
                  <div className={cn(
                    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold",
                    emotion.toLowerCase() === 'joy' && "bg-gradient-to-r from-amber-100 to-yellow-100 text-amber-700 border border-amber-300/50",
                    emotion.toLowerCase() === 'sadness' && "bg-gradient-to-r from-blue-100 to-cyan-100 text-blue-700 border border-blue-300/50",
                    emotion.toLowerCase() === 'anger' && "bg-gradient-to-r from-red-100 to-rose-100 text-red-700 border border-red-300/50",
                    emotion.toLowerCase() === 'fear' && "bg-gradient-to-r from-purple-100 to-indigo-100 text-purple-700 border border-purple-300/50",
                    emotion.toLowerCase() === 'surprise' && "bg-gradient-to-r from-pink-100 to-fuchsia-100 text-pink-700 border border-pink-300/50",
                    emotion.toLowerCase() === 'disgust' && "bg-gradient-to-r from-green-100 to-emerald-100 text-green-700 border border-green-300/50",
                    emotion.toLowerCase() === 'neutral' && "bg-gradient-to-r from-gray-100 to-slate-100 text-gray-700 border border-gray-300/50",
                    !['joy', 'sadness', 'anger', 'fear', 'surprise', 'disgust', 'neutral'].includes(emotion.toLowerCase()) && "bg-muted text-muted-foreground border border-border"
                  )}>
                    <span className="text-sm">
                      {emotion.toLowerCase() === 'joy' && '😀'}
                      {emotion.toLowerCase() === 'sadness' && '😭'}
                      {emotion.toLowerCase() === 'anger' && '🤬'}
                      {emotion.toLowerCase() === 'fear' && '😨'}
                      {emotion.toLowerCase() === 'surprise' && '😲'}
                      {emotion.toLowerCase() === 'disgust' && '🤢'}
                      {emotion.toLowerCase() === 'neutral' && '😐'}
                    </span>
                    <span className="capitalize">{emotion}</span>
                    {confidence !== null && confidence !== undefined && (
                      <span className="opacity-70">
                        ({Math.round(confidence * 100)}%)
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </>
        )}

        <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
          {isEdited && (
            <span className="rounded-full bg-primary/20 px-2.5 py-1 text-[11px] font-semibold text-primary">
              Edited
            </span>
          )}
          {formattedTime && <span className="font-medium">{formattedTime}</span>}

          <div className="ml-auto flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <Button
              variant="ghost"
              size="icon"
              title="Copy message"
              onClick={handleCopy}
              className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-xl transition-all"
            >
              <Copy className="h-4 w-4" />
            </Button>

            {isUser && editable && onEditRequest && (
              <Button
                variant="ghost"
                size="icon"
                title="Edit message"
                onClick={() => onEditRequest(id)}
                className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-xl transition-all"
              >
                <Edit3 className="h-4 w-4" />
              </Button>
            )}

            {!isUser && onRegenerate && (
              <Button
                variant="ghost"
                size="icon"
                title="Regenerate response"
                onClick={onRegenerate}
                className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-xl transition-all"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </motion.div>

      {isUser && (
        <motion.div 
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-500 to-indigo-600 text-white shadow-lg"
          whileHover={{ scale: 1.1, rotate: -5 }}
          animate={{
            boxShadow: [
              '0 0 20px rgba(59, 130, 246, 0.3)',
              '0 0 30px rgba(59, 130, 246, 0.5)',
              '0 0 20px rgba(59, 130, 246, 0.3)',
            ],
          }}
          transition={{ duration: 2, repeat: Infinity, delay: 1, type: 'tween', ease: 'easeInOut' }}
        >
          <User className="h-5 w-5" />
        </motion.div>
      )}
    </motion.div>
  );
});

ChatMessage.displayName = 'ChatMessage';