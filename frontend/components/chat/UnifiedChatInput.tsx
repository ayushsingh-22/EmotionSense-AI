'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Mic, MessageSquare, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { EnhancedVoiceControls, type VoiceState } from './EnhancedVoiceControls';

interface UnifiedChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onVoiceMessage: (audioBlob: Blob) => Promise<void>;
  userId: string;
  sessionId?: string;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  voiceState?: VoiceState;
  onVoiceStateChange?: (state: VoiceState) => void;
}

export function UnifiedChatInput({
  value,
  onChange,
  onSubmit,
  onVoiceMessage,
  userId,
  sessionId,
  disabled = false,
  placeholder = "Type your message or use voice...",
  className,
  voiceState: externalVoiceState = 'idle',
  onVoiceStateChange
}: UnifiedChatInputProps) {
  const [mode, setMode] = useState<'text' | 'voice'>('text');
  const [localVoiceState, setLocalVoiceState] = useState<VoiceState>('idle');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Use external voice state if provided, otherwise use local state
  const currentVoiceState = onVoiceStateChange ? externalVoiceState : localVoiceState;
  const setVoiceState = onVoiceStateChange || setLocalVoiceState;

  // Auto-resize textarea function
  const handleTextareaChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const textarea = e.target;
    onChange(textarea.value);
    
    // Auto-resize logic with smooth transitions
    textarea.style.height = 'auto';
    const newHeight = Math.min(Math.max(textarea.scrollHeight, 60), 200);
    textarea.style.height = newHeight + 'px';
  }, [onChange]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !disabled) {
        onSubmit();
      }
    }
    // Quick voice mode toggle with Ctrl+M
    if (e.key === 'm' && e.ctrlKey) {
      e.preventDefault();
      setMode(prev => prev === 'text' ? 'voice' : 'text');
    }
  }, [value, disabled, onSubmit]);

  // Enhanced voice message handler with state management
  const handleVoiceMessage = useCallback(async (audioBlob: Blob) => {
    setVoiceState('processing');
    try {
      await onVoiceMessage(audioBlob);
      setVoiceState('responding');
      
      // Auto-reset after response (this should be managed by parent component)
      setTimeout(() => {
        setVoiceState('idle');
      }, 3000); // Fallback reset
    } catch (error) {
      console.error('Voice message failed:', error);
      setVoiceState('idle');
    }
  }, [onVoiceMessage, setVoiceState]);

  // Focus management
  useEffect(() => {
    if (mode === 'text' && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [mode]);

  // Dynamic height calculation for smooth transitions
  const isVoiceActive = mode === 'voice' && currentVoiceState !== 'idle';
  const inputHeight = mode === 'text' ? 'auto' : isVoiceActive ? '120px' : '160px';

  return (
    <motion.div
      className={cn(
        "relative bg-background border border-border rounded-2xl",
        "shadow-lg backdrop-blur-sm overflow-hidden",
        className
      )}
      layout
      initial={{ height: 'auto' }}
      animate={{ height: inputHeight }}
      transition={{ 
        duration: 0.3, 
        ease: "easeInOut",
        layout: { duration: 0.3 } 
      }}
    >
      {/* Mode switcher header */}
      <div className="flex items-center justify-between p-3 border-b border-border/50 bg-secondary/30">
        <div className="flex items-center gap-2">
          <motion.div
            className="flex bg-background rounded-lg p-1 shadow-sm"
            layout
          >
            <Button
              variant={mode === 'text' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setMode('text')}
              className="h-8 px-3"
              disabled={disabled}
            >
              <MessageSquare className="h-4 w-4 mr-1" />
              Text
            </Button>
            <Button
              variant={mode === 'voice' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setMode('voice')}
              className="h-8 px-3"
              disabled={disabled}
            >
              <Mic className="h-4 w-4 mr-1" />
              Voice
            </Button>
          </motion.div>
        </div>

        {/* Quick shortcut hint */}
        <div className="text-xs text-muted-foreground hidden sm:block">
          Ctrl+M to switch • {mode === 'text' ? 'Enter to send' : 'Tap mic to talk'}
        </div>
      </div>

      {/* Content area with smooth transitions */}
      <div className="relative overflow-hidden">
        <AnimatePresence mode="wait">
          {mode === 'text' ? (
            <motion.div
              key="text-mode"
              className="p-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex gap-3 items-end">
                <div className="flex-1 relative">
                  <textarea
                    ref={textareaRef}
                    value={value}
                    onChange={handleTextareaChange}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    disabled={disabled}
                    className={cn(
                      "w-full min-h-[60px] max-h-[200px] p-3 rounded-xl resize-none",
                      "bg-secondary/50 border border-border/50 focus:border-primary/50",
                      "transition-all duration-200 placeholder:text-muted-foreground",
                      "focus:outline-none focus:ring-2 focus:ring-primary/20",
                      { 'opacity-50 cursor-not-allowed': disabled }
                    )}
                    style={{ height: 'auto' }}
                  />
                  
                  {/* Character count for long messages */}
                  {value.length > 100 && (
                    <motion.div
                      className="absolute bottom-2 right-2 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      {value.length}/2000
                    </motion.div>
                  )}
                </div>

                <Button
                  onClick={onSubmit}
                  disabled={disabled || !value.trim()}
                  size="lg"
                  className="h-12 w-12 rounded-xl shadow-md hover:shadow-lg transition-all duration-200"
                >
                  <Send className="h-5 w-5" />
                </Button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="voice-mode"
              className="p-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
            >
              <EnhancedVoiceControls
                onVoiceMessage={handleVoiceMessage}
                userId={userId}
                sessionId={sessionId}
                disabled={disabled}
                className="border-0 shadow-none bg-transparent p-0"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Voice state overlay for compact display */}
      <AnimatePresence>
        {mode === 'voice' && currentVoiceState !== 'idle' && (
          <motion.div
            className="absolute inset-0 bg-background/95 backdrop-blur-sm flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="text-center space-y-2">
              {currentVoiceState === 'processing' && (
                <div className="flex items-center gap-2 text-blue-600">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
                  <span>Processing speech...</span>
                </div>
              )}
              
              {currentVoiceState === 'responding' && (
                <div className="flex items-center gap-2 text-green-600">
                  <Volume2 className="h-5 w-5" />
                  <span>AI is responding...</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Subtle glow effect for active voice mode */}
      {mode === 'voice' && currentVoiceState === 'listening' && (
        <motion.div
          className="absolute inset-0 rounded-2xl pointer-events-none"
          style={{
            background: 'linear-gradient(45deg, transparent, rgba(59, 130, 246, 0.1), transparent)',
          }}
          animate={{
            background: [
              'linear-gradient(45deg, transparent, rgba(59, 130, 246, 0.1), transparent)',
              'linear-gradient(225deg, transparent, rgba(59, 130, 246, 0.2), transparent)',
              'linear-gradient(45deg, transparent, rgba(59, 130, 246, 0.1), transparent)',
            ],
          }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      )}
    </motion.div>
  );
}

// Type export for external use
export type { VoiceState };