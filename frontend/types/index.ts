// Emotion types and interfaces
export type EmotionType = 'anger' | 'disgust' | 'fear' | 'joy' | 'neutral' | 'sadness' | 'surprise';

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
    content: string;
    message: string;
    emotion: string | null;
    emotionConfidence: number | null;
    confidence: number | null;
    metadata?: Record<string, unknown>;
    audioUrl?: string | null;
    timestamp: string;
  };
  aiResponse: {
    id: string;
    content: string;
    message: string;
    model?: string;
    timestamp: string;
    metadata?: Record<string, unknown>;
    audioUrl?: string | null;
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
  anger: { color: '#E74C3C', emoji: '🤬', bgColor: 'bg-red-500' },
  disgust: { color: '#16A085', emoji: '🤢', bgColor: 'bg-teal-600' },
  fear: { color: '#9B59B6', emoji: '😨', bgColor: 'bg-purple-500' },
  joy: { color: '#F39C12', emoji: '😀', bgColor: 'bg-orange-500' },
  neutral: { color: '#95A5A6', emoji: '😐', bgColor: 'bg-gray-500' },
  sadness: { color: '#3498DB', emoji: '😭', bgColor: 'bg-blue-500' },
  surprise: { color: '#E67E22', emoji: '😲', bgColor: 'bg-orange-600' },
};

export interface EmotionFlowSegment {
  id: string;
  segment: string;
  emotion: string | null;
  intensity: number | null;
  summary?: string | null;
}

export interface SegmentInsight {
  segment: string;
  dominantEmotion: string | null;
  intensity: number | null;
  summary: string | null;
  keywords: string[];
  moodScore: number | null;
  messageCount: number;
  analysisCount: number;
}

export interface DashboardKeyMoment extends EmotionFlowSegment {
  date?: string;
  timeOfDay?: string;
}

export interface DailyTimeSegment {
  label: string;
  dominantEmotion: string | null;
  moodScore: number | null;
  entryCount: number;
  valence?: number | null;
  energy?: number | null;
}

export interface DailyTrendPoint {
  timestamp: string;
  emotion: string;
  moodScore: number;
  confidence?: number | null;
}

export interface DailyCompassPoint {
  segment: string;
  valence: number;
  energy: number;
  moodScore: number | null;
  emotion: string | null;
}

export interface DailyEmotionSummary {
  id: string | null;
  userId: string;
  date: string;
  dominantEmotion: string | null;
  emotionDistribution: Record<string, number>;
  moodScore: number | null;
  totalEntries: number;
  timeSegments: DailyTimeSegment[];
  trendPoints: DailyTrendPoint[];
  compassPoints: DailyCompassPoint[];
  keyMoments: DashboardKeyMoment[];
  emotionFlow?: EmotionFlowSegment[];
  segmentSummary?: SegmentInsight[];
  eJournalEntry?: string | null;
  summaryText?: string | null;
  createdAt?: string;
  updatedAt?: string;
  generatedAt?: string;
  source?: string;
  hasData?: boolean;
}

export interface WeeklyArcPoint {
  date: string;
  moodScore: number | null;
  dominantEmotion: string | null;
}

export interface WeeklyEmotionSummary {
  id: string | null;
  userId: string;
  weekStart: string;
  weekEnd: string;
  dominantEmotion: string | null;
  weeklyArc: WeeklyArcPoint[];
  averageMoodScore: number | null;
  keyHighlights: Array<{
    date: string;
    emotion: string;
    intensity: number;
    excerpt: string;
    timeOfDay?: string;
  }>;
  weeklyMomentFlow?: Array<{
    date: string;
    flow: EmotionFlowSegment[];
  }>;
  weeklyReflection?: string | null;
  weeklySummaryText?: string | null;
  createdAt?: string;
  updatedAt?: string;
  generatedAt?: string;
  source?: string;
}

export interface TrackingMetadata {
  trackedSince: string | null;
  trackedDays: number;
}
