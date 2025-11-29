'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ChatMessage } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { sendChatMessage, regenerateResponse, textToSpeech } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface ChatContextType {
  messages: ChatMessage[];
  currentSessionId: string | null;
  isLoading: boolean;
  isTyping: boolean;
  sendMessage: (content: string) => Promise<void>;
  regenerateLastResponse: () => Promise<void>;
  startNewSession: () => void;
  loadChatHistory: (sessionId?: string) => Promise<void>;
  loadExistingSession: (sessionId: string) => Promise<void>;
  playAudio: (text: string) => Promise<void>;
  isPlayingAudio: boolean;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  setCurrentSessionId: React.Dispatch<React.SetStateAction<string | null>>;
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

  // Start new chat session (request from backend)
  const startNewSession = useCallback(async () => {
    if (!user?.id) {
      toast({
        title: 'Error',
        description: 'User not authenticated',
        variant: 'destructive',
      });
      return;
    }
    try {
      const { id: newSessionId } = await (await import('@/lib/api')).createChatSession(user.id);
      setCurrentSessionId(newSessionId);
      setMessages([]);
    } catch (error) {
      console.error('Failed to create session:', error);
      toast({
        title: 'Error',
        description: 'Failed to create new chat session',
        variant: 'destructive',
      });
    }
  }, [user?.id, toast]);

  // Load chat history for a specific session
  const loadChatHistory = useCallback(async (sessionId?: string) => {
    if (!user?.id || !sessionId) {
      console.log('📝 No sessionId provided or user not authenticated');
      return;
    }

    try {
      console.log('📝 Loading chat history for session:', sessionId);
      setIsLoading(true);
      
      // Import getChatMessages here to avoid circular dependency
      const { getChatMessages } = await import('@/lib/api');
      const data = await getChatMessages(sessionId, user.id);
      
      setCurrentSessionId(sessionId);
      setMessages(data.messages || []);
      
      console.log('✅ Chat history loaded successfully:', data.messages?.length, 'messages');
    } catch (error) {
      console.error('❌ Error loading chat history:', error);
      toast({
        title: 'Error',
        description: 'Failed to load chat history.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, toast]);

  // Load an existing chat session
  const loadExistingSession = useCallback(async (sessionId: string) => {
    if (!user?.id) {
      console.log('❌ User not authenticated, cannot load session');
      return;
    }

    if (sessionId === currentSessionId) {
      console.log('📝 Session already loaded:', sessionId);
      return;
    }

    console.log('📝 Loading existing session:', sessionId);
    setCurrentSessionId(sessionId);
    await loadChatHistory(sessionId);
  }, [user?.id, currentSessionId, loadChatHistory]);

  // Send message (SIMPLIFIED - backend handles all data persistence)
  const sendMessage = useCallback(async (content: string) => {
    if (!user || !content.trim()) return;

    // Create session if none exists
    let sessionId = currentSessionId;
    if (!sessionId) {
      // Request new session from backend
      const { id: newSessionId } = await (await import('@/lib/api')).createChatSession(user.id);
      sessionId = newSessionId;
      setCurrentSessionId(sessionId);
    }

    setIsLoading(true);
    setIsTyping(true);

    try {
      // Add user message to state immediately
      const now = new Date().toISOString();
      const userMessage: ChatMessage = {
        id: `temp_${Date.now()}`,
        session_id: sessionId!,
        user_id: user.id,
        role: 'user',
        content,
        message: content,
        created_at: now,
      };

      setMessages(prev => [...prev, userMessage]);

      // Call the chat API that handles everything (emotion analysis + AI response + database save)
      console.log('🚀 Sending chat message to backend...');
      const chatResult = await sendChatMessage(content, user.id, sessionId!);
      console.log('✅ Chat API response received:', chatResult);

      // Update user message with emotion data from backend
      const updatedUserMessage: ChatMessage = {
        ...userMessage,
        id: chatResult.userMessage.id || userMessage.id, // Use backend record ID if available
        emotion: chatResult.userMessage.emotion,
        emotion_detected: chatResult.userMessage.emotion,
        emotion_confidence: chatResult.userMessage.confidence,
        confidence_score: chatResult.userMessage.confidence,
        metadata: chatResult.userMessage.metadata,
      };

      // Add assistant response
      const assistantMessage: ChatMessage = {
        id: `ai_${Date.now()}`,
        session_id: sessionId!,
        user_id: user.id,
        role: 'assistant',
        content: chatResult.aiResponse.message,
        message: chatResult.aiResponse.message,
        emotion: chatResult.userMessage.emotion,
        emotion_detected: chatResult.userMessage.emotion,
        emotion_confidence: chatResult.userMessage.confidence,
        confidence_score: chatResult.userMessage.confidence,
        metadata: chatResult.aiResponse.metadata,
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
  }, [user, currentSessionId, toast]);

  // Regenerate last AI response (SIMPLIFIED - no database update)
  const regenerateLastResponse = useCallback(async () => {
    const lastUserMessage = [...messages].reverse().find(msg => msg.role === 'user');
    const lastAssistantMessage = [...messages].reverse().find(msg => msg.role === 'assistant');
    
    if (!lastUserMessage || !lastAssistantMessage || !user) return;

    setIsLoading(true);
    setIsTyping(true);

    try {
      console.log('🔄 Regenerating AI response...');
      const lastUserContent = lastUserMessage.content || lastUserMessage.message;
      const { response } = await regenerateResponse(
        lastAssistantMessage.emotion_detected || lastAssistantMessage.emotion || 'neutral',
        lastUserContent || ''
      );

      // Update the last assistant message in frontend state only
      setMessages(prev =>
        prev.map(msg =>
          msg.id === lastAssistantMessage.id
            ? { ...msg, content: response, message: response }
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
  }, [messages, user, toast]);

  // Play audio using TTS (with browser fallback)
  const playAudio = useCallback(async (text: string) => {
    if (isPlayingAudio) return;

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
  }, [isPlayingAudio, toast]);

  // Check if user is new and show welcome message
  const checkIfNewUser = useCallback(async () => {
    if (!user) return;
    
    // For now, we'll consider any user with no messages as new
    // You could enhance this by checking profile creation date or a dedicated flag
    const isNewUser = messages.length === 0;
    
    if (isNewUser) {
      // Add a welcome message from MantrAI
      const welcomeMessage: ChatMessage = {
        id: `welcome_${Date.now()}`,
        session_id: currentSessionId || 'welcome',
        user_id: 'system',
        role: 'assistant',
        content: "Welcome to MantrAI! 👋 I'm here to listen, understand, and support you through our conversations. Feel free to share anything on your mind - whether you're celebrating, struggling, or just want to chat. What would you like to talk about today?",
        message: "Welcome to MantrAI! 👋 I'm here to listen, understand, and support you through our conversations. Feel free to share anything on your mind - whether you're celebrating, struggling, or just want to chat. What would you like to talk about today?",
        created_at: new Date().toISOString(),
      };
      
      setMessages([welcomeMessage]);
    }
  }, [user, messages.length, currentSessionId]);

  // Initialize chat on mount and check for new users
  useEffect(() => {
    if (user && !currentSessionId) {
      startNewSession();
      // Check if this is a new user (no previous chat history)
      checkIfNewUser();
    }
  }, [user, currentSessionId, startNewSession, checkIfNewUser]);

  const value = {
    messages,
    currentSessionId,
    isLoading,
    isTyping,
    sendMessage,
    regenerateLastResponse,
    startNewSession,
    loadChatHistory,
    loadExistingSession,
    playAudio,
    isPlayingAudio,
    setMessages,
    setCurrentSessionId,
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