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
        'space-y-3 rounded-3xl border border-border/60 bg-background/70 p-4 shadow-lg backdrop-blur',
        className
      )}
    >
      {isEditing && (
        <div className="flex items-center justify-between rounded-2xl bg-primary/10 px-3 py-2 text-xs text-primary">
          <span>{editingLabel || 'Editing previous message'}</span>
          {onCancelEdit && (
            <Button variant="ghost" size="sm" onClick={onCancelEdit} className="h-7 px-2 text-primary">
              Cancel
            </Button>
          )}
        </div>
      )}

      <div className="flex items-end gap-2 sm:gap-3">
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
              'w-full min-h-[44px] max-h-[140px] resize-none rounded-2xl border border-transparent bg-background/60 px-4 py-3 text-sm text-foreground transition-all focus:border-primary/50 focus:ring-2 focus:ring-primary/40 dark:bg-background/80',
              'disabled:opacity-60 disabled:cursor-not-allowed'
            )}
            style={{
              lineHeight: '1.5',
              fontFamily: 'inherit',
            }}
          />
        </div>



        <Button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit}
          className={cn(
            'h-10 w-10 flex-shrink-0 rounded-full p-0 shadow-md transition-all duration-200',
            'flex items-center justify-center',
            'bg-gradient-to-br from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white',
            'disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed disabled:shadow-none',
            canSubmit && 'hover:scale-110 hover:shadow-lg active:scale-95'
          )}
          title="Send message (Shift+Enter for new line)"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>

      <div className="px-1 text-xs text-muted-foreground">Shift + Enter for new line</div>
    </div>
  );
});

ChatInput.displayName = 'ChatInput';