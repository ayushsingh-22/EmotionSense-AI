'use client';

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { VoiceState } from './UnifiedChatInput';

interface OptimizedChatContainerProps {
  children: React.ReactNode;
  voiceState?: VoiceState;
  isLoading?: boolean;
  className?: string;
}

export function OptimizedChatContainer({
  children,
  voiceState = 'idle',
  isLoading = false,
  className
}: OptimizedChatContainerProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  // Enhanced smooth scroll to bottom with performance optimization
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    if (scrollContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      
      if (!isNearBottom || behavior === 'auto') {
        scrollContainerRef.current.scrollTo({
          top: scrollHeight,
          behavior: behavior
        });
      }
    }
  }, []);

  // Debounced scroll handler to check if user is at bottom
  const handleScroll = useCallback(() => {
    if (scrollContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 50;
      
      setIsAtBottom(isNearBottom);
      setShowScrollToBottom(!isNearBottom && scrollHeight > clientHeight);
    }
  }, []);

  // Auto-scroll on new messages (when children change)
  useEffect(() => {
    // Only auto-scroll if user is already at bottom or very close
    if (isAtBottom) {
      // Use requestAnimationFrame for smoother scrolling
      requestAnimationFrame(() => {
        scrollToBottom('smooth');
      });
    }
  }, [children, isAtBottom, scrollToBottom]);

  // Auto-scroll when voice state changes to responding (new AI message)
  useEffect(() => {
    if (voiceState === 'responding') {
      // Ensure AI response is visible
      setTimeout(() => scrollToBottom('smooth'), 100);
    }
  }, [voiceState, scrollToBottom]);

  // Optimize for voice mode - reduce container height when voice is active
  const isVoiceActive = voiceState !== 'idle';
  const containerHeight = isVoiceActive ? 'calc(100vh - 280px)' : 'calc(100vh - 200px)';

  return (
    <div className="relative flex-1 flex flex-col">
      {/* Chat messages container */}
      <motion.div
        ref={scrollContainerRef}
        className={cn(
          "flex-1 overflow-y-auto scroll-smooth",
          "scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent",
          className
        )}
        style={{ height: containerHeight }}
        onScroll={handleScroll}
        layout
        transition={{ duration: 0.3, ease: "easeInOut" }}
      >
        {/* Message list with optimized rendering */}
        <div className="min-h-full flex flex-col">
          <div className="flex-1" />
          <motion.div 
            className="space-y-4 p-4"
            layout
            transition={{ duration: 0.2 }}
          >
            {children}
          </motion.div>
        </div>

        {/* Loading indicator for voice processing */}
        <AnimatePresence>
          {(isLoading || voiceState === 'processing') && (
            <motion.div
              className="flex justify-center py-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className="flex items-center gap-3 px-4 py-2 bg-secondary/80 rounded-full backdrop-blur-sm">
                <div className="flex gap-1">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <motion.div
                      key={i}
                      className="w-2 h-2 bg-primary rounded-full"
                      animate={{
                        scale: [1, 1.2, 1],
                        opacity: [0.6, 1, 0.6]
                      }}
                      transition={{
                        duration: 1,
                        repeat: Infinity,
                        delay: i * 0.2
                      }}
                    />
                  ))}
                </div>
                <span className="text-sm text-muted-foreground">
                  {voiceState === 'processing' ? 'Processing voice...' : 'Thinking...'}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Scroll to bottom button */}
      <AnimatePresence>
        {showScrollToBottom && (
          <motion.button
            className={cn(
              "absolute bottom-24 right-6 z-10",
              "bg-primary text-primary-foreground rounded-full p-3",
              "shadow-lg hover:shadow-xl transition-shadow",
              "border border-border/20"
            )}
            onClick={() => scrollToBottom('smooth')}
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 14l-7 7m0 0l-7-7m7 7V3"
              />
            </svg>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Voice state overlay for responsive feedback */}
      <AnimatePresence>
        {voiceState === 'listening' && (
          <motion.div
            className="absolute top-4 left-1/2 transform -translate-x-1/2 z-20"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <div className="bg-blue-500 text-white px-4 py-2 rounded-full shadow-lg">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                <span className="text-sm font-medium">Listening...</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Gradient overlay to indicate more content above */}
      {!isAtBottom && (
        <div
          className="absolute top-0 left-0 right-0 h-8 pointer-events-none z-10"
          style={{
            background: 'linear-gradient(to bottom, rgba(255,255,255,0.8), transparent)',
          }}
        />
      )}

      {/* Bottom gradient for voice mode compactness */}
      {isVoiceActive && (
        <motion.div
          className="absolute bottom-0 left-0 right-0 h-6 pointer-events-none"
          style={{
            background: 'linear-gradient(to top, rgba(255,255,255,0.8), transparent)',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        />
      )}
    </div>
  );
}

// Custom hook for chat container optimizations
export function useChatScrollOptimization() {
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const lastMessageCountRef = useRef(0);

  const handleNewMessage = useCallback((messageCount: number) => {
    // Only auto-scroll if message count increased (new message)
    if (messageCount > lastMessageCountRef.current) {
      setShouldAutoScroll(true);
    }
    lastMessageCountRef.current = messageCount;
  }, []);

  const handleUserScroll = useCallback(() => {
    setShouldAutoScroll(false);
  }, []);

  const resetAutoScroll = useCallback(() => {
    setShouldAutoScroll(true);
  }, []);

  return {
    shouldAutoScroll,
    handleNewMessage,
    handleUserScroll,
    resetAutoScroll
  };
}