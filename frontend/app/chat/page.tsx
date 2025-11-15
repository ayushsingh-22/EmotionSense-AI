'use client';

import { useState, useRef, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { ChatMessage } from '@/components/chat/ChatMessage';
import type { UIEvent } from 'react';
import axios from 'axios';
import { MessageSquare, Mic, MicOff } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { toast } from '@/hooks/use-toast';
import { getChatMessages } from '@/lib/api';
import { ChatMessage as ChatMessageType } from '@/lib/supabase';
import { PerformanceMonitor } from '@/lib/performance';
import { useStore } from '@/store/useStore';
import { api } from '@/lib/api';

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
  const [messages, setMessages] = useState<ExtendedChatMessage[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarRefreshTrigger, setSidebarRefreshTrigger] = useState(0);
  const [messageText, setMessageText] = useState('');
  const [chatMode, setChatMode] = useState<'text' | 'voice'>('text');
  const [editingState, setEditingState] = useState<EditingState | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const userAtBottomRef = useRef(true);
  const pendingScrollRef = useRef(false);

  const chatOverrides = useStore((state) => state.chatOverrides);
  const hideChatMessage = useStore((state) => state.hideChatMessage);
  const setEditedChatMessage = useStore((state) => state.setEditedChatMessage);

  useEffect(() => {
    PerformanceMonitor.mark('chat-page-mount');
    return () => {
      PerformanceMonitor.measure('chat-page-lifecycle', 'chat-page-mount');
    };
  }, []);

  const sessionOverrides = useMemo(() => currentSessionId ? chatOverrides[currentSessionId] : undefined, [chatOverrides, currentSessionId]);

  const displayedMessages = useMemo(() => {
    if (!sessionOverrides) {
      return messages;
    }

    const hidden = new Set(sessionOverrides.hiddenMessages);
    return messages
      .filter((message) => !hidden.has(message.id))
      .map((message) => {
        const edited = sessionOverrides.editedMessages[message.id];
        return edited
          ? { ...message, message: edited, editedFrom: message.editedFrom ?? message.id }
          : message;
      });
  }, [messages, sessionOverrides]);

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
    const editing = editingState;

    PerformanceMonitor.mark('message-send-start');
    setIsLoading(true);

    const tempMessage: ExtendedChatMessage = {
      id: `temp-${Date.now()}`,
      user_id: user.id,
      session_id: currentSessionId || '',
      role: 'user',
      content: trimmed,
      message: trimmed,
      created_at: new Date().toISOString(),
      editedFrom: editing?.messageId ?? null,
    };

    setMessages((prev) => {
      const base = editing
        ? prev.filter((m) => m.id !== editing.messageId && m.id !== editing.assistantMessageId)
        : prev;
      return [...base, tempMessage];
    });

    setMessageText('');
    setEditingState(null);

    try {
      const { data } = await api.post('/api/chat/message', {
        message: trimmed,
        sessionId: currentSessionId,
        userId: user.id,
      });

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to send message');
      }

      const payload = data.data;
      if (!payload) {
        throw new Error('Unexpected response from server');
      }
      const newSessionId = payload.sessionId as string;

      const realUserMessage: ExtendedChatMessage = {
        id: payload.userMessage.id,
        user_id: user.id,
        session_id: newSessionId,
        role: 'user',
        content: payload.userMessage.content || payload.userMessage.message,
        message: payload.userMessage.message,
        emotion: payload.userMessage.emotion,
        emotion_detected: payload.userMessage.emotion,
        emotion_confidence: payload.userMessage.emotionConfidence ?? payload.userMessage.confidence,
        confidence_score: payload.userMessage.confidence,
        metadata: payload.userMessage.metadata,
        created_at: payload.userMessage.timestamp,
        editedFrom: editing?.messageId ?? null,
      };

      const aiMessage: ExtendedChatMessage = {
        id: payload.aiResponse.id,
        user_id: user.id,
        session_id: newSessionId,
        role: 'assistant',
        content: payload.aiResponse.content || payload.aiResponse.message,
        message: payload.aiResponse.message,
        emotion: payload.emotion?.detected,
        emotion_detected: payload.emotion?.detected,
        emotion_confidence: payload.emotion?.confidence,
        confidence_score: payload.emotion?.confidence,
        metadata: payload.aiResponse.metadata,
        created_at: payload.aiResponse.timestamp,
        hasContext: payload.hasContext,
        contextLength: payload.contextLength,
      };

      if (!currentSessionId && newSessionId) {
        setSidebarRefreshTrigger((prev) => prev + 1);
      }

      if (editing && currentSessionId) {
        hideChatMessage(currentSessionId, editing.messageId);
        if (editing.assistantMessageId) {
          hideChatMessage(currentSessionId, editing.assistantMessageId);
        }
        setEditedChatMessage(newSessionId, realUserMessage.id, trimmed);
      }

      setMessages((prev) => {
        const withoutTemp = prev.filter((m) => !m.id.startsWith('temp-'));
        const base = editing
          ? withoutTemp.filter((m) => m.id !== editing.messageId && m.id !== editing.assistantMessageId)
          : withoutTemp;
        return [...base, realUserMessage, aiMessage];
      });

      setCurrentSessionId(newSessionId);

        PerformanceMonitor.measure('message-send-complete', 'message-send-start');
    } catch (error) {
      console.error('Failed to send message:', error);
      const description = axios.isAxiosError(error)
        ? error.code === 'ERR_NETWORK'
          ? 'Unable to reach the server. Please ensure the backend is running at NEXT_PUBLIC_API_URL.'
          : error.response?.data?.error || error.message
        : 'Failed to send message. Please try again.';
      toast({ title: 'Error', description, variant: 'destructive' });
      setMessages((prev) => prev.filter((m) => !m.id.startsWith('temp-')));
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, user?.id, editingState, currentSessionId, hideChatMessage, setEditedChatMessage]);

  const handleSessionSelect = useCallback(async (sessionId: string) => {
    if (!user?.id) return;
    try {
      PerformanceMonitor.mark('session-load-start');
      const data = await getChatMessages(sessionId, user.id);
      setMessages(data.messages || []);
      setCurrentSessionId(sessionId);
      setMessageText('');
      setEditingState(null);
      pendingScrollRef.current = false;
      userAtBottomRef.current = false;
      requestAnimationFrame(() => {
        scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'auto' });
      });
      PerformanceMonitor.measure('session-load-complete', 'session-load-start');
    } catch (error) {
      console.error('Failed to load session messages:', error);
      toast({ title: 'Error', description: 'Failed to load chat history.', variant: 'destructive' });
    }
  }, [user?.id]);

  const handleNewSession = useCallback(() => {
    setMessages([]);
    setCurrentSessionId(null);
    setMessageText('');
    setEditingState(null);
    pendingScrollRef.current = false;
    userAtBottomRef.current = true;
  }, []);



  const handleEditRequest = useCallback((messageId: string) => {
    const targetIndex = messages.findIndex((msg) => msg.id === messageId);
    if (targetIndex === -1) return;
    const target = messages[targetIndex];
    if (target.role !== 'user') return;

    const followingAssistant = messages.slice(targetIndex + 1).find((msg) => msg.role === 'assistant');

    setEditingState({
      messageId,
      assistantMessageId: followingAssistant?.id,
      originalText: (target.content || target.message) ?? '',
    });
    setMessageText((target.content || target.message) ?? '');
    setChatMode('text');
  }, [messages]);

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
  }, [currentSessionId, user?.id]);

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