'use client';

import { useState, useRef, useEffect, useCallback, memo } from 'react';
import { 
  Send, 
  Save,
  MessageCircle,
  Sidebar
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/hooks/use-toast';
import { ChatSidebar } from '@/components/chat/ChatSidebar';
import { SpeechRecognition } from '@/components/chat/SpeechRecognition';
import { ChatBubble } from '@/components/chat/ChatBubble';
import { sendChatMessage, getChatMessages } from '@/lib/api';
import { ChatMessage } from '@/lib/supabase';
import { debounce } from '@/lib/performance';
import { AuthGuard } from '@/components/auth/AuthGuard';

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
  
  const { user } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
      const response = await sendChatMessage(message, user.id, currentSessionId || undefined, false);
      
      // Update session ID if it's a new session
      if (!currentSessionId && response.sessionId) {
        setCurrentSessionId(response.sessionId);
      }

      // Remove loading message and add real response
      setMessages(prev => {
        const filtered = prev.filter(m => !m.isLoading);
        return [
          ...filtered.slice(0, -1), // Remove temp user message
          {
            id: response.userMessage.id,
            user_id: user.id,
            session_id: response.sessionId,
            role: 'user',
            message: response.userMessage.message,
            emotion_detected: response.userMessage.emotion,
            confidence_score: response.userMessage.confidence,
            created_at: response.userMessage.timestamp
          },
          {
            id: response.aiResponse.id,
            user_id: user.id,
            session_id: response.sessionId,
            role: 'assistant',
            message: response.aiResponse.message,
            created_at: response.aiResponse.timestamp,
            hasContext: response.hasContext,
            contextLength: response.contextLength
          }
        ];
      });

      // Show enhanced context notification
      if (response.hasContext && response.contextLength > 0) {
        toast({
          title: "🧠 Using Conversation Context",
          description: `Your response considers ${response.contextLength} previous message${response.contextLength > 1 ? 's' : ''} for better continuity`,
          duration: 5000
        });
      }
      
      // Show emotion detection result
      if (response.userMessage.emotion && response.userMessage.confidence) {
        const emotion = response.userMessage.emotion;
        const confidence = Math.round(response.userMessage.confidence * 100);
        const emotionEmoji = {
          happy: "😊", sad: "😢", angry: "😠", fear: "😨", 
          surprise: "😲", disgust: "🤢", neutral: "😐"
        }[emotion] || "🤔";
        
        toast({
          title: `${emotionEmoji} Emotion Detected`,
          description: `${emotion.charAt(0).toUpperCase() + emotion.slice(1)} (${confidence}% confidence)`,
          duration: 3000
        });
      }

    } catch (error) {
      console.error('Failed to send message:', error);
      
      // Remove loading message
      setMessages(prev => prev.filter(m => !m.isLoading));
      
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

  return (
    <AuthGuard requireAuth={true}>
      <div className="h-[calc(100vh-4rem)] flex">
      {/* Sidebar */}
      {sidebarOpen && (
        <div className="w-80 border-r">
          <ChatSidebar
            onSessionSelect={handleSessionSelect}
            onNewSession={handleNewSession}
            currentSessionId={currentSessionId || undefined}
          />
        </div>
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950">
          <div className="flex items-center gap-4">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setSidebarOpen(!sidebarOpen);
              }}
              className="hover:bg-white/50 dark:hover:bg-gray-800/50"
            >
              <Sidebar className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Chat with MantrAI
              </h1>
              <p className="text-sm text-muted-foreground">
                Your intelligent emotional companion
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {currentSessionId && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2 bg-white/50 dark:bg-gray-800/50 border-white/20"
              >
                <Save className="h-4 w-4" />
                Saved
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
              New Chat
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

        {/* Input */}
        <div className="p-6 border-t bg-gradient-to-r from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
          <form 
            onSubmit={handleSubmit} 
            className="max-w-4xl mx-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <Input
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
                  placeholder="Share your thoughts and feelings..."
                  disabled={isLoading}
                  className="min-h-[48px] text-base rounded-2xl border-2 focus:border-blue-500 transition-all duration-300 bg-white/80 dark:bg-gray-800/80"
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
                className="gap-2 h-12 px-6 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
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
      </div>
    </div>
    </AuthGuard>
  );
}