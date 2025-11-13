import axios from 'axios';
import { withCache, PerformanceMonitor } from './performance';
import type {
  TextAnalysisResult,
  VoiceAnalysisResult,
  MultiModalResult,
  ChatMessageResult,
} from '@/types';

// Create axios instance with optimized config
export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000, // Reduced timeout for faster failure
});

// Request interceptor for performance monitoring
api.interceptors.request.use(
  (config) => {
    const requestId = `${config.method?.toUpperCase()}-${config.url}`;
    PerformanceMonitor.start(requestId);
    console.log(`[API Request] ${requestId}`);
    return config;
  },
  (error) => {
    console.error('[API Request Error]', error);
    return Promise.reject(error);
  }
);

// Response interceptor with performance logging
api.interceptors.response.use(
  (response) => {
    const requestId = `${response.config.method?.toUpperCase()}-${response.config.url}`;
    PerformanceMonitor.end(requestId);
    return response;
  },
  (error) => {
    const requestId = `${error.config?.method?.toUpperCase()}-${error.config?.url}`;
    PerformanceMonitor.end(requestId);
    console.error('[API Response Error]', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// API Functions

/**
 * Analyze text for emotions with caching
 */
export const analyzeText = async (text: string): Promise<TextAnalysisResult> => {
  const cacheKey = `text-analysis-${text.slice(0, 50)}`;
  
  return withCache(cacheKey, async () => {
    const response = await api.post<{ 
      success: boolean; 
      data: { 
        emotion: string; 
        confidence: number; 
        scores: Record<string, number>; 
        recordId?: string;
      } 
    }>('/api/analyze/text', { text });
    
    // Backend returns { success: true, data: { emotion, confidence, scores, recordId } }
    // But we expect the full analysis result structure
    const backendData = response.data.data;
    
    // Transform the simplified backend response to match our expected structure
    return {
      originalText: text,
      processedText: text.toLowerCase().trim(),
      emotion: backendData.emotion,
      confidence: backendData.confidence,
      scores: backendData.scores,
      models_used: ['BiLSTM', 'HuggingFace'],
      combination_strategy: 'Weighted Average',
      individual_results: undefined // Not provided by current backend
    };
  });
};

/**
 * Analyze voice/audio file for emotions
 */
export const analyzeVoice = async (audioFile: File): Promise<VoiceAnalysisResult> => {
  const formData = new FormData();
  formData.append('audio', audioFile);

  const response = await api.post<VoiceAnalysisResult>('/api/analyze/voice', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

/**
 * Analyze both text and voice for multi-modal emotion detection
 */
export const analyzeMultiModal = async (
  text: string,
  audioFile: File
): Promise<MultiModalResult> => {
  const formData = new FormData();
  formData.append('text', text);
  formData.append('audio', audioFile);

  const response = await api.post<MultiModalResult>('/api/analyze/multimodal', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

/**
 * Regenerate AI response for a given emotion
 */
export const regenerateResponse = async (
  emotion: string,
  context?: string
): Promise<{ response: string }> => {
  const response = await api.post<{ response: string }>('/api/response/regenerate', {
    emotion,
    context,
  });
  return response.data;
};

/**
 * Convert text to speech
 */
export const textToSpeech = async (text: string): Promise<Blob> => {
  const response = await api.post(
    '/api/tts',
    { text },
    {
      responseType: 'blob',
    }
  );
  return response.data;
};

/**
 * Send chat message with emotion analysis and AI response
 */
export const sendChatMessage = async (
  message: string,
  userId?: string,
  sessionId?: string,
  includeAudio = false
): Promise<ChatMessageResult> => {
  const response = await api.post<{ 
    success: boolean; 
    data?: ChatMessageResult;
    error?: string;
  }>('/api/chat/message', { 
    message, 
    userId,
    sessionId,
    includeAudio,
    memoryLength: 10
  });
  
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Failed to send chat message');
  }
  
  return response.data.data;
};

/**
 * Get chat sessions for a user
 */
export const getChatSessions = async (userId: string) => {
  const response = await api.get(`/api/chat/sessions`, {
    params: { userId }
  });
  return response.data.data;
};

/**
 * Get messages for a specific chat session
 */
export const getChatMessages = async (sessionId: string, userId: string) => {
  const response = await api.get(`/api/chat/sessions/${sessionId}/messages`, {
    params: { userId }
  });
  return response.data.data;
};

/**
 * Create a new chat session
 */
export const createChatSession = async (userId: string, sessionTitle?: string) => {
  const response = await api.post('/api/chat/sessions', {
    userId,
    sessionTitle
  });
  return response.data.data;
};

/**
 * Update session title
 */
export const updateChatSessionTitle = async (sessionId: string, userId: string, title: string) => {
  const response = await api.put(`/api/chat/sessions/${sessionId}/title`, {
    userId,
    title
  });
  return response.data.data;
};

/**
 * Delete a chat session
 */
export const deleteChatSession = async (sessionId: string, userId: string) => {
  const response = await api.delete(`/api/chat/sessions/${sessionId}`, {
    params: { userId }
  });
  return response.data;
};

/**
 * Health check
 */
export const healthCheck = async (): Promise<{ status: string; timestamp: string }> => {
  const response = await api.get<{ status: string; timestamp: string }>('/api/health');
  return response.data;
};

/**
 * Send voice chat message with audio
 */
export const sendVoiceMessage = async (
  audioFile: File,
  transcript: string,
  userId: string,
  sessionId?: string,
  language: string = 'en-US'
): Promise<ChatMessageResult> => {
  const formData = new FormData();
  formData.append('audio', audioFile);
  formData.append('transcript', transcript);
  formData.append('userId', userId);
  formData.append('language', language);
  
  if (sessionId) {
    formData.append('sessionId', sessionId);
  }

  const response = await api.post<{ success: boolean; data: ChatMessageResult }>(
    '/api/chat/voice',
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );

  return response.data.data;
};

/**
 * Request microphone permission
 */
export const requestMicrophonePermission = async (): Promise<boolean> => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // Close the stream immediately after getting permission
    stream.getTracks().forEach((track) => track.stop());
    return true;
  } catch {
    return false;
  }
};

/**
 * Emergency Contact API Functions
 */

export interface EmergencyContact {
  id: string;
  user_id: string;
  contact_name: string;
  contact_email: string;
  contact_phone?: string;
  notify_enabled: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Check if user has an emergency contact
 */
export const hasEmergencyContact = async (userId: string): Promise<boolean> => {
  try {
    const response = await api.get<{ success: boolean; hasEmergencyContact: boolean }>(
      `/api/emergency/check/${userId}`
    );
    return response.data.hasEmergencyContact;
  } catch (error) {
    console.error('Error checking emergency contact:', error);
    return false;
  }
};

/**
 * Get emergency contact for a user
 */
export const getEmergencyContact = async (userId: string): Promise<EmergencyContact | null> => {
  try {
    const response = await api.get<{ success: boolean; data: EmergencyContact }>(
      `/api/emergency/${userId}`
    );
    return response.data.data;
  } catch (error) {
    console.error('Error fetching emergency contact:', error);
    return null;
  }
};

/**
 * Save emergency contact
 */
export const saveEmergencyContact = async (
  userId: string,
  contactName: string,
  contactEmail: string,
  contactPhone?: string
): Promise<EmergencyContact | null> => {
  try {
    const response = await api.post<{ success: boolean; data: EmergencyContact }>(
      '/api/emergency/save',
      {
        userId,
        contactName,
        contactEmail,
        contactPhone
      }
    );
    return response.data.data;
  } catch (error) {
    console.error('Error saving emergency contact:', error);
    throw error;
  }
};

/**
 * Update emergency contact
 */
export const updateEmergencyContact = async (
  userId: string,
  contactName: string,
  contactEmail: string,
  contactPhone?: string
): Promise<EmergencyContact | null> => {
  try {
    const response = await api.put<{ success: boolean; data: EmergencyContact }>(
      '/api/emergency/update',
      {
        userId,
        contactName,
        contactEmail,
        contactPhone
      }
    );
    return response.data.data;
  } catch (error) {
    console.error('Error updating emergency contact:', error);
    throw error;
  }
};

/**
 * Delete emergency contact
 */
export const deleteEmergencyContact = async (userId: string): Promise<boolean> => {
  try {
    const response = await api.delete<{ success: boolean }>(
      `/api/emergency/${userId}`
    );
    return response.data.success;
  } catch (error) {
    console.error('Error deleting emergency contact:', error);
    throw error;
  }
};
