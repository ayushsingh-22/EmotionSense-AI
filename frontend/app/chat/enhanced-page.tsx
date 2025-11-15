'use client';

import { useState, useEffect, useCallback, memo, Suspense, lazy } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { getChatMessages } from '@/lib/api';
import { ChatMessage as ChatMessageType } from '@/lib/supabase';
import { PerformanceMonitor } from '@/lib/performance';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { UnifiedChatInput, VoiceState } from '@/components/chat/UnifiedChatInput';
import { OptimizedChatContainer } from '@/components/chat/OptimizedChatContainer';

// Lazy loaded components for better performance
const ChatLayout = lazy(() => import('@/components/chat/ChatLayout').then(m => ({ default: m.ChatLayout })));
const ChatSidebar = lazy(() => import('@/components/chat/ChatSidebar').then(m => ({ default: m.ChatSidebar })));
const ChatMessage = lazy(() => import('@/components/chat/ChatMessage').then(m => ({ default: m.ChatMessage })));
const TypingIndicator = lazy(() => import('@/components/chat/TypingIndicator').then(m => ({ default: m.TypingIndicator })));

interface ExtendedChatMessage extends ChatMessageType {
  isLoading?: boolean;
  hasContext?: boolean;
  contextLength?: number;
}

// Enhanced loading skeletons with better animations
const MessageSkeleton = memo(function MessageSkeleton() {
  return (
    <div className="flex gap-4 px-4 py-6">
      <div className="w-8 h-8 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded-full flex-shrink-0 animate-pulse" />
      <div className="flex-1 space-y-3">
        <div className="h-4 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded w-20 animate-pulse" />
        <div className="space-y-2">
          <div className="h-4 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded w-3/4 animate-pulse" />
          <div className="h-4 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded w-1/2 animate-pulse" />
        </div>
      </div>
    </div>
  );
});

const SidebarSkeleton = memo(function SidebarSkeleton() {
  return (
    <div className="w-80 h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 p-4">
      <div className="space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-12 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded animate-pulse"
            style={{ animationDelay: `${i * 0.1}s` }}
          />
        ))}
      </div>
    </div>
  );
});

export default function EnhancedChatPage() {
  // Core state management
  const [inputMessage, setInputMessage] = useState('');
  const [messages, setMessages] = useState<ExtendedChatMessage[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarRefreshTrigger, setSidebarRefreshTrigger] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  
  const { user } = useAuth();

  // Performance tracking with enhanced monitoring
  useEffect(() => {
    PerformanceMonitor.start('chat-page-mount');
    return () => {
      PerformanceMonitor.end('chat-page-mount');
    };
  }, []);

  // Load initial chat data
  const loadInitialData = useCallback(async () => {
    if (!user?.id) return;

    try {
      PerformanceMonitor.start('load-initial-messages');
      
      // For now, just start with an empty state
      // Messages will be loaded when a session is selected
      setMessages([]);
      
      PerformanceMonitor.end('load-initial-messages');
    } catch (error) {
      console.error('Failed to load initial data:', error);
      toast({
        title: "Error",
        description: "Failed to load chat history",
        variant: "destructive",
      });
    }
  }, [user?.id]);

  // Load initial messages and session
  useEffect(() => {
    if (user?.id) {
      loadInitialData();
    }
  }, [user?.id, loadInitialData]);

  // Enhanced message submission with voice support
  const handleSendMessage = useCallback(async (message: string) => {
    if (!message.trim() || !user?.id || isLoading) return;

    const messageToSend = message.trim();
    setIsLoading(true);
    setIsTyping(true);

    // Add user message immediately for better UX
    const userMessage: ExtendedChatMessage = {
      id: `temp-user-${Date.now()}`,
      content: messageToSend,
      message: messageToSend,
      role: 'user',
      user_id: user.id,
      session_id: currentSessionId || '',
      created_at: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);

    try {
      PerformanceMonitor.start('send-message');
      
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageToSend,
          userId: user.id,
          sessionId: currentSessionId,
        }),
      });

      const data = await response.json();
      PerformanceMonitor.end('send-message');

      if (data.success) {
        // Update session ID if new
        if (data.sessionId && data.sessionId !== currentSessionId) {
          setCurrentSessionId(data.sessionId);
          setSidebarRefreshTrigger(prev => prev + 1);
        }

        // Add AI response
        const aiMessage: ExtendedChatMessage = {
          id: data.messageId || `ai-${Date.now()}`,
          content: data.response,
          message: data.response,
          role: 'assistant',
          user_id: user.id,
          session_id: data.sessionId || currentSessionId || '',
          created_at: new Date().toISOString(),
          hasContext: data.hasContext,
          contextLength: data.contextLength
        };

        // Update messages by replacing temp user message with real ones
        setMessages(prev => {
          const filteredMessages = prev.filter(msg => msg.id !== userMessage.id);
          return [
            ...filteredMessages,
            { ...userMessage, id: data.userMessageId || userMessage.id },
            aiMessage
          ];
        });
      } else {
        throw new Error(data.error || 'Failed to send message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Remove the temporary user message on error
      setMessages(prev => prev.filter(msg => msg.id !== userMessage.id));
      
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setIsTyping(false);
    }
  }, [user?.id, isLoading, currentSessionId]);

  // Session management
  const handleSessionSelect = useCallback((sessionId: string) => {
    setCurrentSessionId(sessionId);
    setMessages([]);
    setInputMessage('');
    setVoiceState('idle');
    
    // Load messages for selected session
    if (user?.id) {
      getChatMessages(user.id, sessionId)
        .then(data => {
          if (data.messages) {
            setMessages(data.messages);
          }
        })
        .catch(error => {
          console.error('Failed to load session messages:', error);
        });
    }
  }, [user?.id]);

  const handleNewSession = useCallback(() => {
    setCurrentSessionId(null);
    setMessages([]);
    setInputMessage('');
    setVoiceState('idle');
    setSidebarRefreshTrigger(prev => prev + 1);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Global voice toggle with Ctrl+Shift+V
      if (e.ctrlKey && e.shiftKey && e.key === 'V') {
        e.preventDefault();
        // Toggle functionality would be handled by UnifiedChatInput
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Main render
  return (
    <AuthGuard requireAuth={true}>
      <Suspense fallback={
        <div className="h-[calc(100vh-4rem)] flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-gray-600 dark:text-gray-400">Loading enhanced chat...</p>
          </div>
        </div>
      }>
        <ChatLayout 
          sidebar={
            <Suspense fallback={<SidebarSkeleton />}>
              <ChatSidebar
                currentSessionId={currentSessionId || undefined}
                onSessionSelect={handleSessionSelect}
                onNewSession={handleNewSession}
                refreshTrigger={sidebarRefreshTrigger}
                className="hidden lg:block"
              />
            </Suspense>
          }
          input={
            <div className="border-t bg-white dark:bg-gray-900 p-4">
              <UnifiedChatInput
                value={inputMessage}
                onChange={setInputMessage}
                onSubmit={() => handleSendMessage(inputMessage)}
                onVoiceMessage={async () => {}}
                userId={user?.id || ''}
                sessionId={currentSessionId || undefined}
                disabled={isTyping}
                placeholder="Type your message..."
                className="w-full"
              />
            </div>
          }
        >

          {/* Main chat area */}
          <div className="flex-1 flex flex-col">
            {/* Chat messages */}
            <OptimizedChatContainer
              voiceState={voiceState}
              isLoading={isLoading}
              className="flex-1"
            >
              {messages.length === 0 ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center space-y-4 max-w-md">
                    <div className="text-6xl">💬</div>
                    <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                      Start a conversation
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400">
                      Ask me anything or use voice mode for a natural conversation experience.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {messages.map((message, index) => (
                    <Suspense key={message.id || index} fallback={<MessageSkeleton />}>
                      <ChatMessage
                        id={message.id}
                        message={(message.content || message.message) ?? ''}
                        role={message.role}
                        timestamp={message.created_at}
                        isLoading={message.isLoading}
                        hasContext={message.hasContext}
                        contextLength={message.contextLength}
                      />
                    </Suspense>
                  ))}
                  
                  {/* Typing indicator */}
                  {isTyping && (
                    <Suspense fallback={<MessageSkeleton />}>
                      <TypingIndicator />
                    </Suspense>
                  )}
                </>
              )}
            </OptimizedChatContainer>
          </div>
        </ChatLayout>
      </Suspense>
    </AuthGuard>
  );
}