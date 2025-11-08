'use client';

import { useRef, useCallback, KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Send, Mic, MicOff } from 'lucide-react';
import { SpeechRecognition } from '@/components/chat/SpeechRecognition';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  placeholder?: string;
  voiceMode?: boolean;
  onVoiceModeToggle?: () => void;
  onSpeechTranscript?: (transcript: string) => void;
  onSpeechError?: (error: string) => void;
  className?: string;
}

export function ChatInput({
  value,
  onChange,
  onSubmit,
  disabled = false,
  placeholder = "Type your message...",
  voiceMode = false,
  onVoiceModeToggle,
  onSpeechTranscript,
  onSpeechError,
  className
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  const handleTextareaChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const textarea = e.target;
    onChange(textarea.value);
    
    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto';
    // Set height to scrollHeight with max limit
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
  }, [onChange]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !disabled) {
        onSubmit();
      }
    }
  }, [value, disabled, onSubmit]);

  // Handle voice mode toggle
  const handleVoiceToggle = useCallback(() => {
    if (onVoiceModeToggle) {
      onVoiceModeToggle();
    }
  }, [onVoiceModeToggle]);

  return (
    <div className={cn("p-4 lg:p-6", className)}>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-end gap-3">
          {/* Text Input */}
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={value}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              placeholder={voiceMode ? "Voice mode active - click mic to speak" : placeholder}
              disabled={disabled || voiceMode}
              rows={1}
              className={cn(
                "w-full min-h-[48px] max-h-[200px] resize-none",
                "px-4 py-3 rounded-2xl border-2 transition-all duration-300",
                "focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10",
                "bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm",
                "border-gray-200 dark:border-gray-600",
                "placeholder:text-gray-500 dark:placeholder:text-gray-400",
                "text-gray-900 dark:text-gray-100",
                "scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600",
                disabled && "opacity-50 cursor-not-allowed",
                voiceMode && "bg-blue-50/50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-600"
              )}
              style={{
                resize: 'none',
                lineHeight: '1.5'
              }}
            />
            
            {/* Voice indicator overlay */}
            {voiceMode && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                  <Mic className="h-4 w-4 animate-pulse" />
                  <span className="text-sm font-medium">Voice mode active</span>
                </div>
              </div>
            )}
          </div>

          {/* Voice Toggle Button */}
          {(onVoiceModeToggle || onSpeechTranscript) && (
            <div className="flex-shrink-0">
              {voiceMode ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleVoiceToggle}
                  className={cn(
                    "h-12 w-12 p-0 rounded-xl transition-all duration-300",
                    "border-2 border-red-300 dark:border-red-600",
                    "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400",
                    "hover:bg-red-100 dark:hover:bg-red-900/40",
                    "hover:scale-105 active:scale-95"
                  )}
                  title="Switch to text mode"
                >
                  <MicOff className="h-5 w-5" />
                </Button>
              ) : (
                onSpeechTranscript && (
                  <SpeechRecognition
                    onTranscript={onSpeechTranscript}
                    onError={onSpeechError}
                    disabled={disabled}
                    className="h-12 w-12 rounded-xl"
                  />
                )
              )}
            </div>
          )}

          {/* Send Button */}
          <Button
            type="button"
            onClick={onSubmit}
            disabled={!value.trim() || disabled || voiceMode}
            className={cn(
              "h-12 px-6 rounded-xl transition-all duration-300",
              "bg-gradient-to-r from-blue-500 to-purple-600",
              "hover:from-blue-600 hover:to-purple-700",
              "disabled:from-gray-400 disabled:to-gray-500",
              "shadow-lg hover:shadow-xl",
              "transform hover:scale-105 active:scale-95",
              "flex-shrink-0 gap-2"
            )}
          >
            <Send className="h-4 w-4" />
            <span className="hidden sm:inline">Send</span>
          </Button>
        </div>

        {/* Helper Text */}
        <div className="flex items-center justify-between mt-3 text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-4">
            {!voiceMode && (
              <span>Press Enter to send, Shift+Enter for new line</span>
            )}
          </div>
          <div>
            MantrAI uses emotion detection for personalized responses
          </div>
        </div>
      </div>
    </div>
  );
}