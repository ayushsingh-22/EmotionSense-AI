'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, RotateCcw, Volume2, VolumeX, Mic, MicOff } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useChat } from '@/contexts/ChatContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { EMOTION_CONFIG } from '@/types';
import { cn } from '@/lib/utils';

export default function ChatPage() {
  const [inputMessage, setInputMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const { user } = useAuth();
  const {
    messages,
    sendMessage,
    regenerateLastResponse,
    isLoading,
    isTyping,
    playAudio,
    isPlayingAudio,
    startNewSession,
  } = useChat();
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Redirect if not authenticated
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Please sign in to access the chat feature.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || isLoading) return;

    const message = inputMessage.trim();
    setInputMessage('');
    await sendMessage(message);
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getEmotionColor = (emotion: string) => {
    return EMOTION_CONFIG[emotion as keyof typeof EMOTION_CONFIG]?.color || '#666';
  };

  const getEmotionEmoji = (emotion: string) => {
    return EMOTION_CONFIG[emotion as keyof typeof EMOTION_CONFIG]?.emoji || '😐';
  };

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-8rem)]">
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Emotional Chat Companion</h1>
            <p className="text-muted-foreground">
              Express your feelings and get empathetic AI responses
            </p>
          </div>
          <Button
            onClick={startNewSession}
            variant="outline"
            disabled={isLoading}
          >
            New Chat
          </Button>
        </div>

        {/* Chat Area */}
        <Card className="flex-1 flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Chat Session</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col p-0">
            {/* Messages */}
            <ScrollArea className="flex-1 px-4">
              <div className="space-y-4 pb-4">
                {messages.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground mb-2">
                      Start a conversation by sharing how you&apos;re feeling
                    </p>
                    <p className="text-sm text-muted-foreground">
                      The AI will analyze your emotions and provide empathetic responses
                    </p>
                  </div>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        'flex',
                        message.message_type === 'user' ? 'justify-end' : 'justify-start'
                      )}
                    >
                      <div
                        className={cn(
                          'max-w-[70%] rounded-lg p-3',
                          message.message_type === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        )}
                      >
                        <div className="space-y-2">
                          <p className="text-sm">{message.content}</p>
                          
                          {/* Emotion and metadata */}
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center space-x-2">
                              <span className="opacity-70">
                                {formatTimestamp(message.created_at)}
                              </span>
                              {message.emotion_detected && (
                                <Badge
                                  variant="secondary"
                                  style={{
                                    backgroundColor: getEmotionColor(message.emotion_detected) + '20',
                                    color: getEmotionColor(message.emotion_detected),
                                  }}
                                >
                                  {getEmotionEmoji(message.emotion_detected)}{' '}
                                  {message.emotion_detected}
                                  {message.confidence_score && (
                                    <span className="ml-1">
                                      ({Math.round(message.confidence_score * 100)}%)
                                    </span>
                                  )}
                                </Badge>
                              )}
                            </div>
                            
                            {/* TTS Button for AI messages */}
                            {message.message_type === 'assistant' && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => playAudio(message.content)}
                                disabled={isPlayingAudio}
                                className="h-6 w-6 p-0"
                              >
                                {isPlayingAudio ? (
                                  <VolumeX className="h-3 w-3" />
                                ) : (
                                  <Volume2 className="h-3 w-3" />
                                )}
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
                
                {/* Typing indicator */}
                {isTyping && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-lg p-3 max-w-[70%]">
                      <div className="flex items-center space-x-1">
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
                          <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce delay-75" />
                          <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce delay-150" />
                        </div>
                        <span className="text-xs text-muted-foreground ml-2">
                          AI is thinking...
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Input Area */}
            <div className="border-t p-4">
              <div className="flex items-center space-x-2 mb-2">
                <Button
                  onClick={regenerateLastResponse}
                  variant="outline"
                  size="sm"
                  disabled={isLoading || messages.length === 0}
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Regenerate
                </Button>
              </div>
              
              <form onSubmit={handleSubmit} className="flex space-x-2">
                <div className="flex-1 relative">
                  <Input
                    ref={inputRef}
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    placeholder="Share how you're feeling..."
                    disabled={isLoading}
                    className="pr-12"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="absolute right-1 top-1 h-8 w-8 p-0"
                    onClick={() => setIsRecording(!isRecording)}
                    disabled={isLoading}
                  >
                    {isRecording ? (
                      <MicOff className="h-4 w-4 text-red-500" />
                    ) : (
                      <Mic className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <Button
                  type="submit"
                  disabled={!inputMessage.trim() || isLoading}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}