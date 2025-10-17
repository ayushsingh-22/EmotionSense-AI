'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { ChatMessage } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { sendChatMessage, regenerateResponse, textToSpeech } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import type { ChatMessageResult } from '@/types';

interface ChatContextType {
  messages: ChatMessage[];
  currentSessionId: string | null;
  isLoading: boolean;
  isTyping: boolean;
  sendMessage: (content: string) => Promise<void>;
  regenerateLastResponse: () => Promise<void>;
  startNewSession: () => void;
  loadChatHistory: (sessionId?: string) => Promise<void>;
  playAudio: (text: string) => Promise<void>;
  isPlayingAudio: boolean;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  // Generate new session ID
  const generateSessionId = () => {
    return `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  // Start new chat session
  const startNewSession = () => {
    const newSessionId = generateSessionId();
    setCurrentSessionId(newSessionId);
    setMessages([]);
  };

  // Send message (SIMPLIFIED - backend handles all data persistence)
  const sendMessage = async (content: string) => {
    if (!user || !content.trim()) return;

    // Create session if none exists
    let sessionId = currentSessionId;
    if (!sessionId) {
      sessionId = generateSessionId();
      setCurrentSessionId(sessionId);
    }

    setIsLoading(true);
    setIsTyping(true);

    try {
      // Add user message to state immediately
      const userMessage: ChatMessage = {
        id: `temp_${Date.now()}`,
        session_id: sessionId,
        user_id: user.id,
        message_type: 'user',
        content,
        created_at: new Date().toISOString(),
      };

      setMessages(prev => [...prev, userMessage]);

      // Call the chat API that handles everything (emotion analysis + AI response + database save)
      console.log('🚀 Sending chat message to backend...');
      const chatResult = await sendChatMessage(content, user.id, false);
      console.log('✅ Chat API response received:', chatResult);

      // Update user message with emotion data from backend
      const updatedUserMessage: ChatMessage = {
        ...userMessage,
        id: chatResult.recordId || userMessage.id, // Use backend record ID if available
        emotion_detected: chatResult.userMessage.emotion,
        confidence_score: chatResult.userMessage.confidence,
      };

      // Add assistant response
      const assistantMessage: ChatMessage = {
        id: `ai_${Date.now()}`,
        session_id: sessionId,
        user_id: user.id,
        message_type: 'assistant',
        content: chatResult.aiResponse.text,
        emotion_detected: chatResult.userMessage.emotion,
        confidence_score: chatResult.userMessage.confidence,
        created_at: new Date().toISOString(),
      };

      // Update messages with both user (with emotion) and assistant response
      setMessages(prev => [
        ...prev.filter(msg => msg.id !== userMessage.id), // Remove temp user message
        updatedUserMessage, // Add updated user message with emotion
        assistantMessage // Add AI response
      ]);

      console.log('✅ Messages updated in frontend state');

    } catch (error) {
      console.error('❌ Error sending message:', error);
      
      // Remove the temporary user message on error
      setMessages(prev => prev.filter(msg => msg.id !== `temp_${Date.now()}`));
      
      toast({
        title: 'Error',
        description: 'Failed to send message. Please try again.',
        variant: 'destructive',
      });
    } finally {
      console.log('🏁 Resetting loading states...');
      setIsLoading(false);
      setIsTyping(false);
    }
  };

  // Regenerate last AI response (SIMPLIFIED - no database update)
  const regenerateLastResponse = async () => {
    const lastUserMessage = [...messages].reverse().find(msg => msg.message_type === 'user');
    const lastAssistantMessage = [...messages].reverse().find(msg => msg.message_type === 'assistant');
    
    if (!lastUserMessage || !lastAssistantMessage || !user) return;

    setIsLoading(true);
    setIsTyping(true);

    try {
      console.log('🔄 Regenerating AI response...');
      const { response } = await regenerateResponse(
        lastAssistantMessage.emotion_detected || 'neutral',
        lastUserMessage.content
      );

      // Update the last assistant message in frontend state only
      setMessages(prev =>
        prev.map(msg =>
          msg.id === lastAssistantMessage.id
            ? { ...msg, content: response }
            : msg
        )
      );

      console.log('✅ Response regenerated successfully');

    } catch (error) {
      console.error('❌ Error regenerating response:', error);
      toast({
        title: 'Error',
        description: 'Failed to regenerate response. Please try again.',
        variant: 'destructive',
      });
    } finally {
      console.log('🏁 Resetting loading states...');
      setIsLoading(false);
      setIsTyping(false);
    }
  };

  // Load chat history (DISABLED - backend manages persistence)
  const loadChatHistory = async () => {
    console.log('📝 Chat history loading disabled - using session-based chat');
    // Note: Chat history is currently session-based only
    // Backend handles all persistence to Supabase emotion_analysis table
    return;
  };

  // Play audio using TTS (with browser fallback)
  const playAudio = async (text: string) => {
    if (isPlayingAudio) return;

    try {
      setIsPlayingAudio(true);
      console.log('🔊 Attempting to generate audio...');
      
      // First try the backend TTS service
      try {
        const audioBlob = await textToSpeech(text);
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        
        audio.onended = () => {
          setIsPlayingAudio(false);
          URL.revokeObjectURL(audioUrl);
          console.log('✅ Backend TTS audio playback completed');
        };
        
        audio.onerror = () => {
          setIsPlayingAudio(false);
          URL.revokeObjectURL(audioUrl);
          console.error('❌ Backend TTS audio playback error');
          // Fall back to browser TTS
          playAudioBrowser(text);
        };

        await audio.play();
        console.log('🎵 Backend TTS audio playback started');
        return;
        
      } catch (backendError) {
        console.warn('⚠️ Backend TTS failed, falling back to browser TTS:', backendError);
        // Fall back to browser's built-in speech synthesis
        playAudioBrowser(text);
      }
      
    } catch (error: unknown) {
      console.error('❌ TTS Error:', error);
      setIsPlayingAudio(false);
      
      toast({
        title: 'Audio Generation Failed',
        description: 'All audio generation methods failed.',
        variant: 'destructive',
      });
    }
  };

  // Browser-based speech synthesis fallback
  const playAudioBrowser = (text: string) => {
    try {
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        
        // Configure voice settings
        utterance.rate = 0.9;
        utterance.pitch = 1.0;
        utterance.volume = 0.8;
        
        // Find a good English voice
        const voices = speechSynthesis.getVoices();
        const englishVoice = voices.find(voice => 
          voice.lang.startsWith('en') && voice.name.includes('Female')
        ) || voices.find(voice => voice.lang.startsWith('en'));
        
        if (englishVoice) {
          utterance.voice = englishVoice;
        }
        
        utterance.onend = () => {
          setIsPlayingAudio(false);
          console.log('✅ Browser TTS audio playback completed');
        };
        
        utterance.onerror = () => {
          setIsPlayingAudio(false);
          console.error('❌ Browser TTS audio playback error');
          toast({
            title: 'Audio Error',
            description: 'Browser text-to-speech failed.',
            variant: 'destructive',
          });
        };
        
        speechSynthesis.speak(utterance);
        console.log('🎵 Browser TTS audio playback started');
        
      } else {
        throw new Error('Speech synthesis not supported');
      }
    } catch (error) {
      setIsPlayingAudio(false);
      console.error('❌ Browser TTS Error:', error);
      toast({
        title: 'Audio Not Available',
        description: 'Text-to-speech is not supported in this browser.',
        variant: 'destructive',
      });
    }
  };

  // Initialize chat on mount
  useEffect(() => {
    if (user && !currentSessionId) {
      startNewSession();
    }
  }, [user]);

  const value = {
    messages,
    currentSessionId,
    isLoading,
    isTyping,
    sendMessage,
    regenerateLastResponse,
    startNewSession,
    loadChatHistory,
    playAudio,
    isPlayingAudio,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}