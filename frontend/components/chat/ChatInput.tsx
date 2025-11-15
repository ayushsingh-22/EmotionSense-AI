'use client';

import { useRef, useCallback, KeyboardEvent, memo, type ChangeEvent } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Send, Loader2 } from 'lucide-react';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  placeholder?: string;
  isLoading?: boolean;
  className?: string;
  isEditing?: boolean;
  editingLabel?: string;
  onCancelEdit?: () => void;
  onSpeechTranscript?: (transcript: string) => void;
  onSpeechError?: (error: string) => void;
}

export const ChatInput = memo(function ChatInput({
  value,
  onChange,
  onSubmit,
  disabled = false,
  placeholder = "Ask me anything...",
  isLoading = false,
  className,
  isEditing = false,
  editingLabel,
  onCancelEdit,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  const handleTextareaChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    const textarea = e.target;
    onChange(textarea.value);
    
    textarea.style.height = 'auto';
    const newHeight = Math.min(textarea.scrollHeight, 120);
    textarea.style.height = newHeight + 'px';
  }, [onChange]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !isLoading) {
      e.preventDefault();
      if (value.trim() && !disabled) {
        onSubmit();
      }
    }
  }, [value, disabled, onSubmit, isLoading]);

  const canSubmit = Boolean(value.trim()) && !disabled && !isLoading;

  return (
    <div
      className={cn(
        'space-y-3 rounded-3xl border-2 border-primary/20 bg-background/80 p-5 shadow-2xl backdrop-blur-lg',
        'hover:border-primary/40 transition-all duration-300',
        className
      )}
    >
      {isEditing && (
        <div className="flex items-center justify-between rounded-2xl bg-primary/10 px-4 py-2.5 text-sm text-primary backdrop-blur-sm">
          <span className="font-medium">{editingLabel || 'Editing previous message'}</span>
          {onCancelEdit && (
            <Button variant="ghost" size="sm" onClick={onCancelEdit} className="h-8 px-3 text-primary hover:bg-primary/20 rounded-xl">
              Cancel
            </Button>
          )}
        </div>
      )}

      <div className="flex items-end gap-3">
        <div className="relative flex-1">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled || isLoading}
            rows={1}
            className={cn(
              'w-full min-h-[52px] max-h-[140px] resize-none rounded-2xl border-2 border-border/40 bg-background/90 px-5 py-4 text-base text-foreground transition-all',
              'focus:border-primary/60 focus:ring-4 focus:ring-primary/20 dark:bg-background/95',
              'placeholder:text-muted-foreground/60',
              'disabled:opacity-60 disabled:cursor-not-allowed',
              'shadow-inner'
            )}
            style={{
              lineHeight: '1.6',
              fontFamily: 'inherit',
            }}
          />
        </div>

        <Button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit}
          className={cn(
            'h-12 w-12 flex-shrink-0 rounded-2xl p-0 shadow-lg transition-all duration-300',
            'flex items-center justify-center',
            'bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 hover:from-blue-600 hover:via-indigo-600 hover:to-purple-700 text-white',
            'disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed disabled:shadow-none',
            canSubmit && 'hover:scale-110 hover:shadow-2xl hover:shadow-primary/40 active:scale-95',
            'border-2 border-white/20'
          )}
          title="Send message (Shift+Enter for new line)"
        >
          {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
        </Button>
      </div>

      <div className="px-2 text-xs text-muted-foreground/70 font-medium">✨ Shift + Enter for new line</div>
    </div>
  );
});

ChatInput.displayName = 'ChatInput';