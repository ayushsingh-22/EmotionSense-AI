// Emotion types and interfaces
export type EmotionType = 'angry' | 'disgust' | 'fear' | 'happy' | 'neutral' | 'sad' | 'surprise';

export interface EmotionResult {
  emotion: EmotionType;
  confidence: number;
  timestamp?: string;
}

export interface ModelResult {
  model: 'bilstm' | 'huggingface';
  emotion: EmotionType;
  confidence: number;
  scores?: Record<EmotionType, number>;
}

export interface TextAnalysisResult {
  originalText: string;
  processedText: string;
  emotion: string;
  confidence: number;
  scores: Record<string, number>;
  models_used: string[];
  combination_strategy: string;
  individual_results?: {
    bilstm?: {
      emotion: string;
      confidence: number;
      scores: Record<string, number>;
    };
    huggingface?: {
      emotion: string;
      confidence: number;
      scores: Record<string, number>;
    };
  };
}

export interface VoiceAnalysisResult {
  transcript: string;
  voice_emotion: EmotionResult;
  text_emotion: EmotionResult;
  combined_emotion: EmotionResult;
  ai_response: string;
  audio_url?: string;
  timestamp: string;
}

export interface MultiModalResult {
  text_emotion: EmotionResult;
  voice_emotion: EmotionResult;
  weighted_emotion: EmotionResult;
  ai_response: string;
  timestamp: string;
}

export interface ChatMessageResult {
  sessionId: string;
  userMessage: {
    id: string;
    message: string;
    emotion: string;
    confidence: number;
    timestamp: string;
  };
  aiResponse: {
    id: string;
    message: string;
    model?: string;
    timestamp: string;
  };
  emotion: {
    detected: string;
    confidence: number;
    scores: Record<string, number>;
  };
  hasContext: boolean;
  contextLength: number;
  audio?: {
    url: string;
    duration?: number;
  };
}

export interface AnalysisHistory {
  id: string;
  type: 'text' | 'voice' | 'multimodal';
  result: TextAnalysisResult | VoiceAnalysisResult | MultiModalResult;
  timestamp: string;
}

export interface UserPreferences {
  theme: 'light' | 'dark';
  defaultMode: 'text' | 'voice' | 'multimodal';
  voiceEnabled: boolean;
  ttsEnabled: boolean;
}

// Emotion configuration
export const EMOTION_CONFIG: Record<EmotionType, { color: string; emoji: string; bgColor: string }> = {
  angry: { color: '#E74C3C', emoji: '😠', bgColor: 'bg-red-500' },
  disgust: { color: '#16A085', emoji: '🤢', bgColor: 'bg-teal-600' },
  fear: { color: '#9B59B6', emoji: '😨', bgColor: 'bg-purple-500' },
  happy: { color: '#F39C12', emoji: '😊', bgColor: 'bg-orange-500' },
  neutral: { color: '#95A5A6', emoji: '😐', bgColor: 'bg-gray-500' },
  sad: { color: '#3498DB', emoji: '😢', bgColor: 'bg-blue-500' },
  surprise: { color: '#E67E22', emoji: '😲', bgColor: 'bg-orange-600' },
};
