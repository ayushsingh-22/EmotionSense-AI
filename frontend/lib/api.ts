import axios from 'axios';
import type {
  TextAnalysisResult,
  VoiceAnalysisResult,
  MultiModalResult,
  ChatMessageResult,
} from '@/types';

// Create axios instance with default config
export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 seconds timeout
});

// Request interceptor for logging
api.interceptors.request.use(
  (config) => {
    console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('[API Request Error]', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    console.log(`[API Response] ${response.config.url} - ${response.status}`);
    return response;
  },
  (error) => {
    console.error('[API Response Error]', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// API Functions

/**
 * Analyze text for emotions
 */
export const analyzeText = async (text: string): Promise<TextAnalysisResult> => {
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
    processedText: text,
    emotion: backendData.emotion,
    confidence: backendData.confidence,
    scores: backendData.scores,
    models_used: ['BiLSTM', 'HuggingFace'],
    combination_strategy: 'Weighted Average',
    individual_results: undefined // Not provided by current backend
  };
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
  includeAudio = false
): Promise<ChatMessageResult> => {
  const response = await api.post<{ 
    success: boolean; 
    data: ChatMessageResult 
  }>('/api/chat/message', { 
    message, 
    userId, 
    includeAudio 
  });
  
  return response.data.data;
};

/**
 * Health check
 */
export const healthCheck = async (): Promise<{ status: string; timestamp: string }> => {
  const response = await api.get<{ status: string; timestamp: string }>('/api/health');
  return response.data;
};
