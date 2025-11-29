'use client';

import { useState, useRef, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { ChatMessage } from '@/components/chat/ChatMessage';
import type { UIEvent } from 'react';
import { MessageSquare, Mic, MicOff } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useChat } from '@/contexts/ChatContext';
import { Button } from '@/components/ui/button';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { toast } from '@/hooks/use-toast';
import { ChatMessage as ChatMessageType } from '@/lib/supabase';
import { PerformanceMonitor } from '@/lib/performance';
import { useStore } from '@/store/useStore';
import { useSearchParams } from 'next/navigation';

const ChatLayout = lazy(() => import('@/components/chat/ChatLayout').then((m) => ({ default: m.ChatLayout })));
const ChatSidebar = lazy(() => import('@/components/chat/ChatSidebar').then((m) => ({ default: m.ChatSidebar })));
const ChatInput = lazy(() => import('@/components/chat/ChatInput').then((m) => ({ default: m.ChatInput })));
const VoiceChatComponent = lazy(async () => {
  const voiceModule = await import('@/components/chat/VoiceChatComponent');
  return { default: voiceModule.VoiceChatComponent };
});

interface ExtendedChatMessage extends ChatMessageType {
  isLoading?: boolean;
  hasContext?: boolean;
  contextLength?: number;
  editedFrom?: string | null;
}

interface EditingState {
  messageId: string;
  assistantMessageId?: string;
  originalText: string;
}

interface VoiceMessagePayload {
  id?: string;
  transcript?: string;
  message?: string;
  timestamp?: string;
}

interface VoiceResponsePayload {
  sessionId?: string;
  userMessage?: VoiceMessagePayload;
  aiResponse?: VoiceMessagePayload;
}

export default function ChatPage() {
  const { user } = useAuth();
  const { messages, currentSessionId, isLoading, sendMessage: sendChatMessage, loadExistingSession, startNewSession, setCurrentSessionId, setMessages } = useChat();
  const [localMessages, setLocalMessages] = useState<ExtendedChatMessage[]>([]);
  const [sidebarRefreshTrigger, setSidebarRefreshTrigger] = useState(0);
  const [messageText, setMessageText] = useState('');
  const [chatMode, setChatMode] = useState<'text' | 'voice'>('text');
  const [editingState, setEditingState] = useState<EditingState | null>(null);
  
  const searchParams = useSearchParams();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const userAtBottomRef = useRef(true);
  const pendingScrollRef = useRef(false);

  const chatOverrides = useStore((state) => state.chatOverrides);

  useEffect(() => {
    PerformanceMonitor.mark('chat-page-mount');
    
    // Check for sessionId URL parameter and load that session
    const sessionId = searchParams.get('sessionId');
    if (sessionId && user?.id) {
      console.log('📱 Loading session from URL parameter:', sessionId);
      loadExistingSession(sessionId);
    }
    
    return () => {
      PerformanceMonitor.measure('chat-page-lifecycle', 'chat-page-mount');
    };
  }, [user?.id, searchParams, loadExistingSession]);

  // Sync messages from ChatContext to local extended messages
  useEffect(() => {
    const extendedMessages: ExtendedChatMessage[] = messages.map(msg => ({
      ...msg,
      isLoading: false,
      hasContext: false,
      contextLength: 0,
      editedFrom: null,
    }));
    setLocalMessages(extendedMessages);
  }, [messages]);

  const sessionOverrides = useMemo(() => currentSessionId ? chatOverrides[currentSessionId] : undefined, [chatOverrides, currentSessionId]);

  const displayedMessages = useMemo(() => {
    if (!sessionOverrides) {
      return localMessages;
    }

    const hidden = new Set(sessionOverrides.hiddenMessages);
    return localMessages
      .filter((message) => !hidden.has(message.id))
      .map((message) => {
        const edited = sessionOverrides.editedMessages[message.id];
        return edited
          ? { ...message, message: edited, editedFrom: message.editedFrom ?? message.id }
          : message;
      });
  }, [localMessages, sessionOverrides]);

  const scrollToBottom = useCallback((behavior: 'auto' | 'smooth' = 'smooth') => {
    if (!messagesEndRef.current) {
      return;
    }
    messagesEndRef.current.scrollIntoView({ behavior });
  }, []);

  useEffect(() => {
    if (!pendingScrollRef.current && !userAtBottomRef.current) {
      return;
    }

    const behavior = pendingScrollRef.current ? 'auto' : 'smooth';
    pendingScrollRef.current = false;
    scrollToBottom(behavior);
  }, [displayedMessages, scrollToBottom]);

  const handleScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    const target = event.currentTarget;
    const threshold = 120;
    const distanceFromBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
    userAtBottomRef.current = distanceFromBottom <= threshold;
    if (!userAtBottomRef.current) {
      pendingScrollRef.current = false;
    }
  }, []);

  const handleSendMessage = useCallback(async (input: string) => {
    if (!input.trim() || isLoading || !user?.id) {
      return;
    }

    pendingScrollRef.current = true;
    userAtBottomRef.current = true;

    const trimmed = input.trim();
    setMessageText('');
    setEditingState(null);

    try {
      // Use ChatContext's sendMessage function which handles everything
      await sendChatMessage(trimmed);
      
      // Refresh sidebar to show updated session
      setSidebarRefreshTrigger((prev) => prev + 1);
      
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Error',
        description: 'Failed to send message. Please try again.',
        variant: 'destructive',
      });
    }
  }, [isLoading, user?.id, sendChatMessage]);

  const handleSessionSelect = useCallback(async (sessionId: string) => {
    if (!user?.id) return;
    try {
      await loadExistingSession(sessionId);
      setMessageText('');
      setEditingState(null);
      pendingScrollRef.current = false;
      userAtBottomRef.current = false;
      requestAnimationFrame(() => {
        scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'auto' });
      });
    } catch (error) {
      console.error('Failed to load session:', error);
      toast({ title: 'Error', description: 'Failed to load chat history.', variant: 'destructive' });
    }
  }, [user?.id, loadExistingSession]);

  const handleNewSession = useCallback(() => {
    // Clear local state
    setMessageText('');
    setEditingState(null);
    pendingScrollRef.current = false;
    userAtBottomRef.current = true;
    
    // Call ChatContext's startNewSession to create a new session and clear messages
    startNewSession();
    
    console.log('🆕 Started new chat session');
  }, [startNewSession]);



  const handleEditRequest = useCallback((messageId: string) => {
    const targetIndex = localMessages.findIndex((msg) => msg.id === messageId);
    if (targetIndex === -1) return;
    const target = localMessages[targetIndex];
    if (target.role !== 'user') return;

    const followingAssistant = localMessages.slice(targetIndex + 1).find((msg) => msg.role === 'assistant');

    setEditingState({
      messageId,
      assistantMessageId: followingAssistant?.id,
      originalText: (target.content || target.message) ?? '',
    });
    setMessageText((target.content || target.message) ?? '');
    setChatMode('text');
  }, [localMessages]);

  const handleSubmit = useCallback(() => {
    if (!messageText.trim()) return;
    handleSendMessage(messageText);
  }, [handleSendMessage, messageText]);

  const handleVoiceMessageReceived = useCallback((response: VoiceResponsePayload) => {
    if (userAtBottomRef.current) {
      pendingScrollRef.current = true;
    }

    const { sessionId, userMessage, aiResponse } = response;

    if (userMessage) {
      const messageText = userMessage.transcript || userMessage.message || '';
      const reconstructed: ExtendedChatMessage = {
        id: userMessage.id || `voice-user-${Date.now()}`,
        user_id: user?.id || '',
        session_id: sessionId || currentSessionId || '',
        role: 'user',
        content: messageText,
        message: messageText,
        created_at: userMessage.timestamp || new Date().toISOString(),
      };
      setMessages((prev) => [...prev, reconstructed]);
    }

    if (aiResponse) {
      const messageText = aiResponse.message || '';
      const aiMsg: ExtendedChatMessage = {
        id: aiResponse.id || `voice-ai-${Date.now()}`,
        user_id: user?.id || '',
        session_id: sessionId || currentSessionId || '',
        role: 'assistant',
        content: messageText,
        message: messageText,
        created_at: aiResponse.timestamp || new Date().toISOString(),
      };
      setMessages((prev) => [...prev, aiMsg]);
    }

    if (!currentSessionId && sessionId) {
      setCurrentSessionId(sessionId);
      setSidebarRefreshTrigger((prev) => prev + 1);
    }
  }, [currentSessionId, user?.id, setMessages, setCurrentSessionId]);

  const headerContent = (
    <div className="flex w-full items-center justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-lg font-semibold text-foreground sm:text-xl">EmotionSense Companion</h1>
        <p className="text-sm text-muted-foreground">A calm space to talk through what you feel.</p>
      </div>

      <div className="flex flex-shrink-0 items-center gap-2">
        <div className="flex rounded-full border border-border/60 bg-background p-1">
          <Button
            variant={chatMode === 'text' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setChatMode('text')}
            className="gap-2"
          >
            <MessageSquare className="h-4 w-4" />
            <span className="hidden sm:inline">Text</span>
          </Button>
          <Button
            variant={chatMode === 'voice' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setChatMode('voice')}
            className="gap-2"
          >
            {chatMode === 'voice' ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
            <span className="hidden sm:inline">Voice</span>
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={handleNewSession} disabled={isLoading}>
          New Chat
        </Button>
      </div>
    </div>
  );

  const sidebarRenderer = useCallback((options: { isCollapsed: boolean; isMobile: boolean; closeMobile: () => void }) => (
    <ChatSidebar
      currentSessionId={currentSessionId || undefined}
      onSessionSelect={handleSessionSelect}
      onNewSession={handleNewSession}
      refreshTrigger={sidebarRefreshTrigger}
      isCollapsed={options.isCollapsed}
      closeMobile={options.closeMobile}
    />
  ), [currentSessionId, handleSessionSelect, handleNewSession, sidebarRefreshTrigger]);

  const suggestions = ['How are you feeling today?', "I'm having a difficult day...", 'Tell me about something that made you happy', 'I need someone to talk to'];

  const content = (
    <div className="flex-1 overflow-hidden">
      {displayedMessages.length === 0 ? (
        <div className="flex h-full items-center justify-center">
          <div className="mx-auto max-w-md space-y-4 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <MessageSquare className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">Welcome back</h3>
            <p className="text-sm text-muted-foreground">Share anything on your mind. I&apos;m here to listen and respond with empathy.</p>
            <div className="flex flex-wrap justify-center gap-2">
              {suggestions.map((suggestion) => (
                <Button key={suggestion} variant="outline" size="sm" onClick={() => handleSendMessage(suggestion)}>
                  {suggestion}
                </Button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex h-full flex-col space-y-4">
          {displayedMessages.map((message) => (
            <ChatMessage
              key={message.id}
              id={message.id}
              message={(message.content || message.message) ?? ''}
              role={message.role}
              timestamp={message.created_at}
              isLoading={message.isLoading}
              editable={message.role === 'user'}
              onEditRequest={handleEditRequest}
              isEdited={Boolean(message.editedFrom)}
              isHighlighted={editingState?.messageId === message.id}
            />
          ))}
          {isLoading && (
            <ChatMessage
              id="typing"
              message=""
              role="assistant"
              isLoading
            />
          )}
          <div ref={messagesEndRef} />
        </div>
      )}
    </div>
  );

  const inputArea = chatMode === 'voice' ? (
    <div className="rounded-3xl border border-border/60 bg-background/80 p-4 shadow-lg">
      <Suspense fallback={<div className="flex h-48 items-center justify-center text-muted-foreground">Preparing voice studio…</div>}>
        <VoiceChatComponent
          userId={user?.id || ''}
          sessionId={currentSessionId || undefined}
          onMessageReceived={handleVoiceMessageReceived}
          onError={(error: string) => toast({ title: 'Voice Chat Error', description: error, variant: 'destructive' })}
        />
      </Suspense>
    </div>
  ) : (
    <Suspense fallback={<div className="flex h-20 items-center justify-center text-muted-foreground">Loading composer…</div>}>
      <ChatInput
        value={messageText}
        onChange={setMessageText}
        onSubmit={handleSubmit}
        disabled={isLoading}
        placeholder="Share your thoughts or feelings…"
        isLoading={isLoading}
        isEditing={Boolean(editingState)}
        editingLabel={editingState ? 'Editing your previous message' : undefined}
        onCancelEdit={() => {
          setEditingState(null);
          setMessageText('');
        }}
      />
    </Suspense>
  );

  return (
    <AuthGuard requireAuth>
      <Suspense fallback={<div className="flex h-[calc(100vh-4rem)] items-center justify-center text-muted-foreground">Loading chat…</div>}>
        <ChatLayout
          sidebar={sidebarRenderer}
          input={inputArea}
          header={headerContent}
          contentRef={scrollContainerRef}
          onContentScroll={handleScroll}
        >
          {content}
        </ChatLayout>
      </Suspense>
    </AuthGuard>
  );
}