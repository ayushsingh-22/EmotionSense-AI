'use client';

import { useState, useRef, useEffect, useCallback, memo, Suspense, lazy, useMemo } from 'react';
import { 
  MessageCircle,
  MessageSquare,
  Mic,
  MicOff
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/hooks/use-toast';
import { getChatMessages } from '@/lib/api';
import { ChatMessage as ChatMessageType } from '@/lib/supabase';
import { debounce, PerformanceMonitor } from '@/lib/performance';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { cn } from '@/lib/utils';

// Lazy loaded components for better performance
const ChatLayout = lazy(() => import('@/components/chat/ChatLayout').then(m => ({ default: m.ChatLayout })));
const ChatSidebar = lazy(() => import('@/components/chat/ChatSidebar').then(m => ({ default: m.ChatSidebar })));
const ChatMessage = lazy(() => import('@/components/chat/ChatMessage').then(m => ({ default: m.ChatMessage })));
const ChatInput = lazy(() => import('@/components/chat/ChatInput').then(m => ({ default: m.ChatInput })));
const TypingIndicator = lazy(() => import('@/components/chat/TypingIndicator').then(m => ({ default: m.TypingIndicator })));
const VoiceChatComponent = lazy(() => import('@/components/chat/VoiceChatComponent').then(m => ({ default: m.VoiceChatComponent })));

interface ExtendedChatMessage extends ChatMessageType {
  isLoading?: boolean;
  hasContext?: boolean;
  contextLength?: number;
}

// Loading skeleton components
const MessageSkeleton = memo(function MessageSkeleton() {
  return (
    <div className="flex gap-4 px-4 py-6 animate-pulse">
      <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20" />
        <div className="space-y-2">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
        </div>
      </div>
    </div>
  );
});

const SidebarSkeleton = memo(function SidebarSkeleton() {
  return (
    <div className="w-80 h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 p-4">
      <div className="space-y-4 animate-pulse">
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 bg-gray-200 dark:bg-gray-700 rounded" />
        ))}
      </div>
    </div>
  );
});

export default function ChatPage() {
  const [inputMessage, setInputMessage] = useState('');
  const [messages, setMessages] = useState<ExtendedChatMessage[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarRefreshTrigger, setSidebarRefreshTrigger] = useState(0);
  const [chatMode, setChatMode] = useState<'text' | 'voice'>('text');
  const [isTyping, setIsTyping] = useState(false);
  
  const { user } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Performance tracking
  useEffect(() => {
    PerformanceMonitor.mark('chat-page-mount');
    return () => {
      PerformanceMonitor.measure('chat-page-lifecycle', 'chat-page-mount');
    };
  }, []);

  // Debounced scroll to prevent excessive scrolling during rapid message updates
  const debouncedScrollToBottom = useMemo(
    () =>
      debounce(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 150),
    []
  );

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    debouncedScrollToBottom();
  }, [messages, debouncedScrollToBottom]);

  // Focus input on mount and mode changes
  useEffect(() => {
    if (chatMode === 'text') {
      inputRef.current?.focus();
    }
  }, [chatMode]);

  const handleSubmit = useCallback(async () => {
    if (!inputMessage.trim() || isLoading || !user?.id) return;

    const message = inputMessage.trim();
    setInputMessage('');
    
    try {
      PerformanceMonitor.mark('message-send-start');
      setIsLoading(true);
      setIsTyping(true);

      // Add user message to UI immediately for better UX
      const userMessage: ExtendedChatMessage = {
        id: `temp-${Date.now()}`,
        user_id: user.id,
        session_id: currentSessionId || '',
        role: 'user',
        content: message,
        message: message,
        created_at: new Date().toISOString()
      };
      
      setMessages(prev => [...prev, userMessage]);

      // Send message to backend
      const response = await fetch('http://localhost:8080/api/chat/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: message.trim(),
          sessionId: currentSessionId,
          userId: user?.id,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Extract user and AI messages from the backend response
        const realUserMessage: ExtendedChatMessage = {
          id: data.data.userMessage.id,
          user_id: user.id,
          session_id: data.data.sessionId,
          role: 'user' as const,
          content: data.data.userMessage.content || data.data.userMessage.message,
          message: data.data.userMessage.message,
          emotion_detected: data.data.userMessage.emotion,
          confidence_score: data.data.userMessage.confidence,
          emotion_confidence: data.data.userMessage.emotionConfidence,
          created_at: data.data.userMessage.timestamp
        };

        const aiMessage: ExtendedChatMessage = {
          id: data.data.aiResponse.id,
          user_id: user.id,
          session_id: data.data.sessionId,
          role: 'assistant' as const,
          content: data.data.aiResponse.content || data.data.aiResponse.message,
          message: data.data.aiResponse.message,
          created_at: data.data.aiResponse.timestamp,
          hasContext: data.data.hasContext,
          contextLength: data.data.contextLength
        };

        // Replace temporary message with real messages
        setMessages(prev => {
          const filtered = prev.filter(m => !m.id.startsWith('temp-'));
          return [...filtered, realUserMessage, aiMessage];
        });
        
        // Update session management
        if (!currentSessionId && data.data.sessionId) {
          setSidebarRefreshTrigger(prev => prev + 1);
        }
        setCurrentSessionId(data.data.sessionId);

        // Show enhanced notifications
        if (data.data.hasContext && data.data.contextLength > 0) {
          toast({
            title: "🧠 Using Conversation Context",
            description: `Response considers ${data.data.contextLength} previous message${data.data.contextLength > 1 ? 's' : ''}`,
            duration: 4000
          });
        }
        
        const emotionConfidence = data.data.userMessage.emotionConfidence ?? data.data.userMessage.confidence;
        if (data.data.userMessage.emotion && emotionConfidence) {
          const emotion = data.data.userMessage.emotion as string;
          const confidence = Math.round(emotionConfidence * 100);
          
          const emotionEmojis = {
            happy: "😊", sad: "😢", angry: "😠", fear: "😨", 
            surprise: "😲", disgust: "🤢", neutral: "😐"
          } as const;
          
          const emoji = emotionEmojis[emotion as keyof typeof emotionEmojis] || "🤔";
          
          toast({
            title: `${emoji} Emotion Detected`,
            description: `${emotion.charAt(0).toUpperCase() + emotion.slice(1)} (${confidence}% confidence)`,
            duration: 3000
          });
        }

        PerformanceMonitor.measure('message-send-complete', 'message-send-start');
      } else {
        throw new Error(data.error || 'Failed to send message');
      }

    } catch (error) {
      console.error('Failed to send message:', error);
      
      // Remove temporary message on error
      setMessages(prev => prev.filter(m => !m.id.startsWith('temp-')));
      
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
      setIsTyping(false);
    }
  }, [inputMessage, isLoading, user?.id, currentSessionId]);

  const handleSessionSelect = useCallback(async (sessionId: string) => {
    if (!user?.id) return;
    
    try {
      PerformanceMonitor.mark('session-load-start');
      const data = await getChatMessages(sessionId, user.id);
      setMessages(data.messages || []);
      setCurrentSessionId(sessionId);
      PerformanceMonitor.measure('session-load-complete', 'session-load-start');
    } catch (error) {
      console.error('Failed to load session messages:', error);
      toast({
        title: "Error",
        description: "Failed to load chat history.",
        variant: "destructive"
      });
    }
  }, [user?.id]);

  const handleNewSession = useCallback(() => {
    setMessages([]);
    setCurrentSessionId(null);
    if (chatMode === 'text') {
      inputRef.current?.focus();
    }
  }, [chatMode]);

  const handleSpeechTranscript = useCallback((transcript: string) => {
    setInputMessage(transcript);
  }, []);

  const handleSpeechError = useCallback((error: string) => {
    toast({
      title: "Speech Recognition Error",
      description: error,
      variant: "destructive"
    });
  }, []);

  const handleVoiceMessageReceived = useCallback((response: Record<string, unknown>) => {
    const userMessage = response.userMessage as {
      id?: string; message?: string; transcript?: string;
      emotion?: string; confidence?: number; timestamp?: string;
    } | undefined;
    
    const aiResponse = response.aiResponse as {
      id?: string; message: string; timestamp?: string;
    } | undefined;
    
    const sessionId = response.sessionId as string;

    if (userMessage) {
      const messageText = userMessage.transcript || userMessage.message || '';
      
      const userMsg: ExtendedChatMessage = {
        id: userMessage.id || `voice-user-${Date.now()}`,
        user_id: user?.id || '',
        session_id: sessionId,
        role: 'user',
        content: messageText,
        message: messageText,
        emotion_detected: userMessage.emotion,
        confidence_score: userMessage.confidence,
        created_at: userMessage.timestamp || new Date().toISOString()
      };
      setMessages(prev => [...prev, userMsg]);
    }

    if (aiResponse) {
      const aiMsg: ExtendedChatMessage = {
        id: aiResponse.id || `voice-ai-${Date.now()}`,
        user_id: user?.id || '',
        session_id: sessionId,
        role: 'assistant',
        content: aiResponse.message,
        message: aiResponse.message,
        created_at: aiResponse.timestamp || new Date().toISOString()
      };
      setMessages(prev => [...prev, aiMsg]);
    }

    if (sessionId && !currentSessionId) {
      setCurrentSessionId(sessionId);
      setSidebarRefreshTrigger(prev => prev + 1);
    }
  }, [user?.id, currentSessionId]);

  const handleVoiceError = useCallback((error: string) => {
    toast({
      title: "Voice Chat Error",
      description: error,
      variant: "destructive"
    });
  }, []);

  const handleMessageEdit = useCallback((messageId: string, newMessage: string) => {
    // This would trigger a new API call to edit and regenerate response
    // For now, just update the message locally
    setMessages(prev => prev.map(msg => 
      msg.id === messageId ? { ...msg, content: newMessage, message: newMessage } : msg
    ));
    
    toast({
      title: "Message edited",
      description: "The message has been updated. Regenerating response...",
    });
    
    // Here you would call the API to regenerate the response
  }, []);

  // Header component
  const header = (
    <div className="flex items-center gap-4 min-w-0 flex-1">
      <div className="min-w-0 flex-1">
        <h1 className="text-xl lg:text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent truncate">
          Chat with MantrAI
        </h1>
        <p className="text-sm text-muted-foreground hidden sm:block">
          Your intelligent emotional companion
        </p>
      </div>
      
      <div className="flex items-center gap-2 lg:gap-3 flex-shrink-0">
        {/* Mode Toggle */}
        <div className="flex items-center gap-1 bg-white/50 dark:bg-gray-800/50 rounded-lg p-1 border border-gray-200 dark:border-gray-700">
          <Button
            variant={chatMode === 'text' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setChatMode('text')}
            className={cn(
              "gap-2",
              chatMode === 'text' 
                ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white' 
                : 'hover:bg-white/50 dark:hover:bg-gray-700/50'
            )}
          >
            <MessageSquare className="h-4 w-4" />
            <span className="hidden sm:inline">Text</span>
          </Button>
          <Button
            variant={chatMode === 'voice' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setChatMode('voice')}
            className={cn(
              "gap-2",
              chatMode === 'voice' 
                ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white' 
                : 'hover:bg-white/50 dark:hover:bg-gray-700/50'
            )}
          >
            {chatMode === 'voice' ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
            <span className="hidden sm:inline">Voice</span>
          </Button>
        </div>
        
        <Button
          onClick={handleNewSession}
          variant="outline"
          size="sm"
          disabled={isLoading}
          className="bg-white/50 dark:bg-gray-800/50 border-white/20 hover:bg-white/80 dark:hover:bg-gray-800/80"
        >
          <span className="hidden sm:inline">New Chat</span>
          <span className="sm:hidden">New</span>
        </Button>
      </div>
    </div>
  );

  // Sidebar component
  const sidebar = (
    <Suspense fallback={<SidebarSkeleton />}>
      <ChatSidebar
        onSessionSelect={handleSessionSelect}
        onNewSession={handleNewSession}
        currentSessionId={currentSessionId || undefined}
        refreshTrigger={sidebarRefreshTrigger}
      />
    </Suspense>
  );

  // Chat messages area
  const chatArea = (
    <ScrollArea className="h-full">
      <div className="max-w-4xl mx-auto">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full min-h-[400px]">
            <div className="text-center py-16">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mx-auto mb-6 shadow-lg">
                <MessageCircle className="h-10 w-10 text-white" />
              </div>
              <h3 className="text-2xl font-semibold mb-4 text-primary">Start a conversation</h3>
              <p className="text-muted-foreground text-lg leading-relaxed max-w-md mx-auto">
                Share your thoughts and feelings. MantrAI is here to listen and provide emotional support with empathy and understanding.
              </p>
              {chatMode === 'voice' && (
                <p className="text-blue-600 dark:text-blue-400 text-sm mt-4 font-medium">
                  🎙️ Voice Mode Active - Use the microphone to start speaking
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-0">
            {messages.map((message) => (
              <Suspense key={message.id} fallback={<MessageSkeleton />}>
                <ChatMessage
                  id={message.id}
                  message={(message.content || message.message) ?? ''}
                  role={message.role}
                  timestamp={message.created_at}
                  emotion={message.emotion_detected}
                  confidence={message.confidence_score}
                  isLoading={message.isLoading}
                  hasContext={message.hasContext}
                  contextLength={message.contextLength}
                  onEdit={handleMessageEdit}
                  editable={message.role === 'user'}
                />
              </Suspense>
            ))}
            
            {isTyping && (
              <Suspense fallback={<MessageSkeleton />}>
                <TypingIndicator />
              </Suspense>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>
    </ScrollArea>
  );

  // Input area
  const inputArea = (
    <div className="p-4 lg:p-6">
      {chatMode === 'text' ? (
        <Suspense fallback={<div className="h-16 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />}>
          <ChatInput
            value={inputMessage}
            onChange={setInputMessage}
            onSubmit={handleSubmit}
            disabled={isLoading}
            placeholder="Share your thoughts and feelings... (Shift+Enter for new line)"
            onSpeechTranscript={handleSpeechTranscript}
            onSpeechError={handleSpeechError}
          />
        </Suspense>
      ) : (
        <div className="max-w-4xl mx-auto">
          <Suspense fallback={<div className="h-16 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />}>
            <VoiceChatComponent
              userId={user?.id || ''}
              sessionId={currentSessionId || undefined}
              language="en-US"
              onMessageReceived={handleVoiceMessageReceived}
              onError={handleVoiceError}
            />
          </Suspense>
          <div className="text-xs text-muted-foreground mt-3 text-center">
            🎙️ Voice Mode - Real-time speech recognition with emotional intelligence
          </div>
        </div>
      )}
    </div>
  );

  return (
    <AuthGuard requireAuth={true}>
      <Suspense fallback={
        <div className="h-[calc(100vh-4rem)] flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">Loading chat...</p>
          </div>
        </div>
      }>
        <ChatLayout
          header={header}
          sidebar={sidebar}
          input={inputArea}
          className="bg-gradient-to-br from-gray-50/30 to-white/80 dark:from-gray-900/30 dark:to-gray-900/80"
        >
          {chatArea}
        </ChatLayout>
      </Suspense>
    </AuthGuard>
  );
}