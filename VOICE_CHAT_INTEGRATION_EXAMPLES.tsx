/**
 * Example: Integrating Voice Chat Component into Your Chat Page
 * 
 * This file shows how to use the VoiceChatComponent in your existing chat application.
 */

'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@supabase/auth-helpers-react';
import { VoiceChatComponent } from '@/components/chat/VoiceChatComponent';
import { ChatBubble } from '@/components/chat/ChatBubble';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

interface ChatMessage {
  id: string;
  text: string;
  isUser: boolean;
  emotion?: string;
  timestamp?: string;
  emotion_confidence?: number;
}

export default function VoiceChatIntegrationExample() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string>();
  const [isLoading, setIsLoading] = useState(false);

  // Handle voice message response
  const handleVoiceMessageReceived = (response: any) => {
    // Add user message to chat
    setMessages((prev) => [
      ...prev,
      {
        id: response.userMessage.id,
        text: response.userMessage.transcript,
        isUser: true,
        emotion: response.emotion.detected,
        emotion_confidence: response.emotion.confidence,
        timestamp: response.userMessage.timestamp,
      },
    ]);

    // Add AI response to chat
    setMessages((prev) => [
      ...prev,
      {
        id: response.aiResponse.id,
        text: response.aiResponse.message,
        isUser: false,
        timestamp: response.aiResponse.timestamp,
      },
    ]);

    // Set session ID if this was first message
    if (!sessionId && response.sessionId) {
      setSessionId(response.sessionId);
    }
  };

  // Handle voice error
  const handleVoiceError = (error: string) => {
    console.error('Voice chat error:', error);
    // You could show a toast here:
    // toast({
    //   title: 'Error',
    //   description: error,
    //   variant: 'destructive'
    // });
  };

  if (!user) {
    return <div className="p-4 text-center">Please log in to use voice chat</div>;
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800">
      {/* Sidebar - Chat History */}
      <aside className="w-64 border-r bg-white dark:bg-gray-800 p-4 overflow-y-auto">
        <h2 className="text-lg font-bold mb-4">Chat History</h2>
        {/* Your chat session list would go here */}
        <div className="text-sm text-gray-500">
          {sessionId && `Session: ${sessionId.substring(0, 8)}...`}
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col">
        {/* Messages Display */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center space-y-4">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  Welcome to Voice Chat
                </h1>
                <p className="text-gray-600 dark:text-gray-400 max-w-md">
                  Click the microphone button below to start speaking. Your voice will be
                  transcribed in real-time, and you'll get an AI response with audio.
                </p>
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <ChatBubble
                  key={msg.id}
                  message={msg.text}
                  isUser={msg.isUser}
                  timestamp={msg.timestamp}
                  emotion={msg.emotion}
                  confidence={msg.emotion_confidence}
                  isLoading={isLoading}
                />
              ))}
              {isLoading && (
                <div className="flex items-center gap-2 text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Processing your message...</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Voice Chat Component */}
        <div className="border-t bg-white dark:bg-gray-800 p-6">
          <VoiceChatComponent
            userId={user.id}
            sessionId={sessionId}
            language="en-US"
            onMessageReceived={handleVoiceMessageReceived}
            onError={handleVoiceError}
            disabled={isLoading}
          />
        </div>
      </main>
    </div>
  );
}

/**
 * Alternative: Using Voice Chat with Text Chat Combined
 * 
 * This example shows how to have both voice and text chat options
 */

export function CombinedVoiceAndTextChat() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string>();
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatMode, setChatMode] = useState<'voice' | 'text'>('voice');

  const handleVoiceReceived = (response: any) => {
    // Add messages same as example above
    setMessages((prev) => [
      ...prev,
      {
        id: response.userMessage.id,
        text: response.userMessage.transcript,
        isUser: true,
        emotion: response.emotion.detected,
        emotion_confidence: response.emotion.confidence,
      },
      {
        id: response.aiResponse.id,
        text: response.aiResponse.message,
        isUser: false,
      },
    ]);

    if (!sessionId) {
      setSessionId(response.sessionId);
    }
  };

  const handleTextSubmit = async () => {
    if (!inputText.trim()) return;

    setIsLoading(true);

    try {
      // Call your text chat API
      const response = await fetch('/api/chat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: inputText,
          userId: user?.id,
          sessionId: sessionId,
          includeAudio: false, // Don't generate TTS for text input
        }),
      });

      const data = await response.json();

      if (data.success) {
        setMessages((prev) => [
          ...prev,
          {
            id: data.data.userMessage.id,
            text: inputText,
            isUser: true,
            emotion: data.data.emotion.detected,
            emotion_confidence: data.data.emotion.confidence,
          },
          {
            id: data.data.aiResponse.id,
            text: data.data.aiResponse.message,
            isUser: false,
          },
        ]);

        if (!sessionId) {
          setSessionId(data.data.sessionId);
        }

        setInputText('');
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) {
    return <div>Please log in</div>;
  }

  return (
    <div className="flex flex-col h-screen gap-4 p-4">
      {/* Mode Selector */}
      <div className="flex gap-2">
        <Button
          onClick={() => setChatMode('voice')}
          variant={chatMode === 'voice' ? 'default' : 'outline'}
        >
          🎙️ Voice Chat
        </Button>
        <Button
          onClick={() => setChatMode('text')}
          variant={chatMode === 'text' ? 'default' : 'outline'}
        >
          💬 Text Chat
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4">
        {messages.map((msg) => (
          <ChatBubble
            key={msg.id}
            message={msg.text}
            isUser={msg.isUser}
            emotion={msg.emotion}
            confidence={msg.emotion_confidence}
          />
        ))}
      </div>

      {/* Input Area */}
      <Card className="p-4">
        {chatMode === 'voice' ? (
          <VoiceChatComponent
            userId={user.id}
            sessionId={sessionId}
            onMessageReceived={handleVoiceReceived}
            disabled={isLoading}
          />
        ) : (
          <div className="flex gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleTextSubmit()}
              placeholder="Type your message..."
              className="flex-1 px-4 py-2 border rounded-lg"
              disabled={isLoading}
            />
            <Button onClick={handleTextSubmit} disabled={!inputText.trim() || isLoading}>
              {isLoading ? 'Sending...' : 'Send'}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}

/**
 * Hook: useVoiceChat
 * 
 * Custom hook to manage voice chat state and logic
 */

interface UseVoiceChatOptions {
  userId: string;
  onMessageReceived?: (response: any) => void;
  onError?: (error: string) => void;
}

export function useVoiceChat({ userId, onMessageReceived, onError }: UseVoiceChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string>();
  const [isProcessing, setIsProcessing] = useState(false);

  const addMessage = (message: ChatMessage) => {
    setMessages((prev) => [...prev, message]);
  };

  const handleVoiceResponse = (response: any) => {
    setIsProcessing(false);

    // Add user and AI messages
    addMessage({
      id: response.userMessage.id,
      text: response.userMessage.transcript,
      isUser: true,
      emotion: response.emotion.detected,
      emotion_confidence: response.emotion.confidence,
      timestamp: response.userMessage.timestamp,
    });

    addMessage({
      id: response.aiResponse.id,
      text: response.aiResponse.message,
      isUser: false,
      timestamp: response.aiResponse.timestamp,
    });

    // Set session ID if first message
    if (!sessionId && response.sessionId) {
      setSessionId(response.sessionId);
    }

    // Call callback
    if (onMessageReceived) {
      onMessageReceived(response);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setSessionId(undefined);
  };

  return {
    messages,
    sessionId,
    isProcessing,
    addMessage,
    handleVoiceResponse,
    clearChat,
    setSessionId,
  };
}

/**
 * Usage Example with Hook:
 * 
 * const { messages, sessionId, handleVoiceResponse } = useVoiceChat({
 *   userId: user.id,
 *   onMessageReceived: (response) => {
 *     console.log('Got response:', response);
 *   }
 * });
 * 
 * return (
 *   <>
 *     {messages.map(msg => <ChatBubble {...msg} />)}
 *     <VoiceChatComponent
 *       userId={user.id}
 *       sessionId={sessionId}
 *       onMessageReceived={handleVoiceResponse}
 *     />
 *   </>
 * );
 */
