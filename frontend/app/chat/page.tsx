'use client';

import { useState, useRef, useEffect, useCallback, memo } from 'react';
import { 
  Send, 
  Save,
  MessageCircle,
  Sidebar,
  Mic,
  MessageSquare
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/hooks/use-toast';
import { ChatSidebar } from '@/components/chat/ChatSidebar';
import { SpeechRecognition } from '@/components/chat/SpeechRecognition';
import { VoiceChatComponent } from '@/components/chat/VoiceChatComponent';
import { ChatBubble } from '@/components/chat/ChatBubble';
import { getChatMessages } from '@/lib/api';
import { ChatMessage } from '@/lib/supabase';
import { debounce } from '@/lib/performance';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { cn } from '@/lib/utils';

interface ExtendedChatMessage extends ChatMessage {
  isLoading?: boolean;
  hasContext?: boolean;
  contextLength?: number;
}

// Memoized chat bubble component to prevent unnecessary re-renders
const MemoizedChatBubble = memo(ChatBubble);

export default function ChatPage() {
  const [inputMessage, setInputMessage] = useState('');
  const [messages, setMessages] = useState<ExtendedChatMessage[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarRefreshTrigger, setSidebarRefreshTrigger] = useState(0);
  const [chatMode, setChatMode] = useState<'text' | 'voice'>('text');
  
  const { user } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Debounced scroll to prevent excessive scrolling
  const debouncedScrollToBottom = useCallback(
    debounce(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100),
    []
  );

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    debouncedScrollToBottom();
  }, [messages, debouncedScrollToBottom]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Redirect if not authenticated (check moved below so hooks are always called)

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!inputMessage.trim() || isLoading || !user?.id) return;

    const message = inputMessage.trim();
    setInputMessage('');
    
    try {
      setIsLoading(true);

      // Add user message to UI immediately
      const userMessage: ExtendedChatMessage = {
        id: `temp-${Date.now()}`,
        user_id: user.id,
        session_id: currentSessionId || '',
        role: 'user',
        message: message,
        created_at: new Date().toISOString()
      };
      
      setMessages(prev => [...prev, userMessage]);

      // Add loading assistant message
      const loadingMessage: ExtendedChatMessage = {
        id: `loading-${Date.now()}`,
        user_id: user.id,
        session_id: currentSessionId || '',
        role: 'assistant',
        message: 'Thinking...',
        created_at: new Date().toISOString(),
        isLoading: true
      };
      
      setMessages(prev => [...prev, loadingMessage]);

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
        // Extract user and AI messages from the new backend response format
        const userMessage: ExtendedChatMessage = {
          id: data.data.userMessage.id,
          user_id: user.id,
          session_id: data.data.sessionId,
          role: 'user' as const,
          message: data.data.userMessage.message,
          emotion_detected: data.data.userMessage.emotion,
          confidence_score: data.data.userMessage.confidence,
          created_at: data.data.userMessage.timestamp
        };

        const aiMessage: ExtendedChatMessage = {
          id: data.data.aiResponse.id,
          user_id: user.id,
          session_id: data.data.sessionId,
          role: 'assistant' as const,
          message: data.data.aiResponse.message,
          created_at: data.data.aiResponse.timestamp,
          hasContext: data.data.hasContext,
          contextLength: data.data.contextLength
        };

        // Replace temporary messages with real ones from backend
        setMessages(prev => {
          // Remove temporary user message and loading message
          const filtered = prev.filter(m => !m.id.startsWith('temp-') && !m.id.startsWith('loading-'));
          return [...filtered, userMessage, aiMessage];
        });
        
        // If this was a new session creation, trigger sidebar refresh
        if (!currentSessionId && data.data.sessionId) {
          setSidebarRefreshTrigger(prev => prev + 1);
        }
        
        setCurrentSessionId(data.data.sessionId);
      } else {
        throw new Error(data.error || 'Failed to send message');
      }

      // Show enhanced context notification
      if (data.data.hasContext && data.data.contextLength > 0) {
        toast({
          title: "🧠 Using Conversation Context",
          description: `Your response considers ${data.data.contextLength} previous message${data.data.contextLength > 1 ? 's' : ''} for better continuity`,
          duration: 5000
        });
      }
      
      // Show emotion detection result
      if (data.data.userMessage.emotion && data.data.userMessage.confidence) {
        const emotion = data.data.userMessage.emotion as string;
        const confidence = Math.round(data.data.userMessage.confidence * 100);
        
        const emotionEmojiMap = {
          happy: "😊", 
          sad: "😢", 
          angry: "😠", 
          fear: "😨", 
          surprise: "😲", 
          disgust: "🤢", 
          neutral: "😐"
        } as const;
        
        type EmotionKey = keyof typeof emotionEmojiMap;
        const emotionEmoji = emotionEmojiMap[emotion as EmotionKey] || "🤔";
        
        toast({
          title: `${emotionEmoji} Emotion Detected`,
          description: `${emotion.charAt(0).toUpperCase() + emotion.slice(1)} (${confidence}% confidence)`,
          duration: 3000
        });
      }

    } catch (error) {
      console.error('Failed to send message:', error);
      
      // Remove temporary user message and loading message
      setMessages(prev => prev.filter(m => !m.isLoading && !m.id.startsWith('temp-')));
      
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }, [inputMessage, isLoading, user?.id, currentSessionId]);

  const handleSessionSelect = async (sessionId: string) => {
    if (!user?.id) return;
    
    try {
      const data = await getChatMessages(sessionId, user.id);
      setMessages(data.messages || []);
      setCurrentSessionId(sessionId);
    } catch (error) {
      console.error('Failed to load session messages:', error);
      toast({
        title: "Error",
        description: "Failed to load chat history.",
        variant: "destructive"
      });
    }
  };

  const handleNewSession = () => {
    setMessages([]);
    setCurrentSessionId(null);
    inputRef.current?.focus();
  };

  const handleSpeechTranscript = (transcript: string) => {
    setInputMessage(transcript);
  };

  const handleSpeechError = (error: string) => {
    toast({
      title: "Speech Recognition Error",
      description: error,
      variant: "destructive"
    });
  };

  const handleVoiceMessageReceived = (response: Record<string, unknown>) => {
    // Add user and AI messages to the chat
    const userMessage = response.userMessage as {
      id?: string;
      message: string;
      emotion?: string;
      confidence?: number;
      timestamp?: string;
    } | undefined;
    
    const aiResponse = response.aiResponse as {
      id?: string;
      message: string;
      timestamp?: string;
    } | undefined;
    
    const sessionId = response.sessionId as string;

    if (userMessage) {
      const userMsg: ExtendedChatMessage = {
        id: userMessage.id || `voice-user-${Date.now()}`,
        user_id: user?.id || '',
        session_id: sessionId,
        role: 'user',
        message: userMessage.message,
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
        message: aiResponse.message,
        created_at: aiResponse.timestamp || new Date().toISOString()
      };
      setMessages(prev => [...prev, aiMsg]);
    }

    // Update session ID if new
    if (sessionId && !currentSessionId) {
      setCurrentSessionId(sessionId);
      setSidebarRefreshTrigger(prev => prev + 1);
    }
  };

  const handleVoiceError = (error: string) => {
    toast({
      title: "Voice Chat Error",
      description: error,
      variant: "destructive"
    });
  };

  return (
    <AuthGuard requireAuth={true}>
      <div className="h-[calc(100vh-4rem)] flex overflow-hidden bg-gray-50 dark:bg-gray-900">
        {/* Sidebar */}
        <div className={cn(
          "transition-all duration-300 ease-in-out flex-shrink-0 border-r border-gray-200 dark:border-gray-700",
          sidebarOpen ? "w-80" : "w-0 -ml-80 overflow-hidden"
        )}>
          <ChatSidebar
            onSessionSelect={handleSessionSelect}
            onNewSession={handleNewSession}
            currentSessionId={currentSessionId || undefined}
            className="h-full w-80"
            refreshTrigger={sidebarRefreshTrigger}
          />
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-gray-800">
          {/* Header */}
          <div className="flex-shrink-0 flex items-center justify-between p-4 lg:p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950">
            <div className="flex items-center gap-4 min-w-0">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setSidebarOpen(!sidebarOpen);
                }}
                className="hover:bg-white/50 dark:hover:bg-gray-800/50 flex-shrink-0"
              >
                <Sidebar className="h-4 w-4" />
              </Button>
              <div className="min-w-0">
                <h1 className="text-xl lg:text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent truncate">
                  Chat with MantrAI
                </h1>
                <p className="text-sm text-muted-foreground hidden sm:block">
                  Your intelligent emotional companion
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 lg:gap-3 flex-shrink-0">
              {/* Mode Toggle */}
              <div className="flex items-center gap-1 bg-white/50 dark:bg-gray-800/50 rounded-lg p-1 border border-gray-200 dark:border-gray-700">
                <Button
                  type="button"
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
                  type="button"
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
                  <Mic className="h-4 w-4" />
                  <span className="hidden sm:inline">Voice</span>
                </Button>
              </div>
              
              {currentSessionId && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2 bg-white/50 dark:bg-gray-800/50 border-white/20 hidden sm:flex"
                >
                  <Save className="h-4 w-4" />
                  <span className="hidden lg:inline">Saved</span>
                </Button>
              )}
              <Button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleNewSession();
                }}
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

        {/* Messages */}
        <ScrollArea className="flex-1 p-6 bg-gradient-to-b from-gray-50/50 to-white dark:from-gray-900/50 dark:to-gray-900">
          <div className="max-w-4xl mx-auto">
            {messages.length === 0 ? (
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
                    🎙️ Voice Mode Active - Click microphone to start speaking
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {messages.map((message) => (
                  <MemoizedChatBubble
                    key={message.id}
                    message={message.message}
                    isUser={message.role === 'user'}
                    timestamp={message.created_at}
                    emotion={message.emotion_detected}
                    confidence={message.confidence_score}
                    isLoading={message.isLoading}
                    hasContext={message.hasContext}
                    contextLength={message.contextLength}
                  />
                ))}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Input - Conditional rendering based on mode */}
        {chatMode === 'text' ? (
          <div className="flex-shrink-0 p-6 border-t bg-gradient-to-r from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
            <form 
              onSubmit={handleSubmit} 
              className="max-w-4xl mx-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <textarea
                    ref={inputRef}
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        e.stopPropagation();
                        handleSubmit(e);
                      }
                    }}
                    placeholder="Share your thoughts and feelings... (Shift+Enter for new line)"
                    disabled={isLoading}
                    rows={1}
                    className={cn(
                      "w-full min-h-[48px] max-h-[200px] resize-none auto-resize-textarea chat-input",
                      "text-base leading-relaxed p-4 rounded-2xl border-2",
                      "focus:border-blue-500 transition-all duration-300",
                      "bg-white/80 dark:bg-gray-800/80",
                      "border-gray-200 dark:border-gray-600",
                      "placeholder:text-gray-500 dark:placeholder:text-gray-400",
                      "scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600",
                      "break-anywhere"
                    )}
                    style={{
                      resize: 'none',
                      lineHeight: '1.5',
                      minHeight: '48px',
                      maxHeight: '200px'
                    }}
                    onInput={(e) => {
                      const target = e.target as HTMLTextAreaElement;
                      target.style.height = 'auto';
                      target.style.height = Math.min(target.scrollHeight, 200) + 'px';
                    }}
                  />
                </div>
                
                <SpeechRecognition
                  onTranscript={handleSpeechTranscript}
                  onError={handleSpeechError}
                  disabled={isLoading}
                />
                
                <Button
                  type="submit"
                  disabled={!inputMessage.trim() || isLoading}
                  className="gap-2 h-12 px-6 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 flex-shrink-0"
                >
                  <Send className="h-4 w-4" />
                  Send
                </Button>
              </div>
              
              <div className="text-xs text-muted-foreground mt-3 text-center">
                MantrAI uses emotion detection to provide personalized responses with empathy and understanding
              </div>
            </form>
          </div>
        ) : (
          <div className="flex-shrink-0 p-6 border-t bg-gradient-to-r from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
            <div className="max-w-4xl mx-auto">
              <VoiceChatComponent
                userId={user?.id || ''}
                sessionId={currentSessionId || undefined}
                language="en-US"
                onMessageReceived={handleVoiceMessageReceived}
                onError={handleVoiceError}
              />
              <div className="text-xs text-muted-foreground mt-3 text-center">
                🎙️ Voice Mode - Real-time speech recognition with emotional intelligence
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
    </AuthGuard>
  );
}