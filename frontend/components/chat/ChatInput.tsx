'use client';

import { useRef, useCallback, KeyboardEvent, memo, type ChangeEvent } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Send, Loader2, X } from 'lucide-react';

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

  // Auto-resize textarea, capped at roughly 5 lines
  const handleTextareaChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    const textarea = e.target;
    onChange(textarea.value);

    textarea.style.height = 'auto';
    const newHeight = Math.min(textarea.scrollHeight, 128);
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
        'rounded-3xl border border-border bg-card shadow-sm transition-shadow',
        'focus-within:shadow-md focus-within:ring-1 focus-within:ring-primary/30',
        className
      )}
    >
      {isEditing && (
        <div className="flex items-center justify-between rounded-t-3xl border-b border-border/60 bg-primary/5 px-4 py-2 text-sm text-primary">
          <span className="font-medium">{editingLabel || 'Editing previous message'}</span>
          {onCancelEdit && (
            <Button variant="ghost" size="sm" onClick={onCancelEdit} className="h-7 gap-1 px-2 text-primary hover:bg-primary/10 rounded-full">
              <X className="h-3.5 w-3.5" />
              Cancel
            </Button>
          )}
        </div>
      )}

      <div className="flex items-end gap-2 p-2.5">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleTextareaChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || isLoading}
          rows={1}
          title="Enter to send, Shift+Enter for a new line"
          className={cn(
            'max-h-32 min-h-[40px] flex-1 resize-none bg-transparent px-2.5 py-2 text-[15px] leading-relaxed text-foreground',
            'placeholder:text-muted-foreground/60 focus:outline-none',
            'disabled:cursor-not-allowed disabled:opacity-60'
          )}
          style={{ fontFamily: 'inherit' }}
        />

        <Button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit}
          className={cn(
            'h-11 w-11 flex-shrink-0 rounded-full p-0 transition-all',
            'flex items-center justify-center',
            'bg-gradient-to-br from-primary to-secondary text-primary-foreground shadow-sm',
            'disabled:from-muted disabled:to-muted disabled:text-muted-foreground disabled:shadow-none',
            canSubmit && 'hover:opacity-90 active:scale-95'
          )}
          title="Send message"
        >
          {isLoading ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <Send className="h-4.5 w-4.5" />}
        </Button>
      </div>
    </div>
  );
});

ChatInput.displayName = 'ChatInput';
