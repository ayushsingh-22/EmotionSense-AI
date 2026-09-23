// Domain types previously defined in lib/supabase.ts alongside the Supabase
// client. Kept here, independent of any specific data-access client, since
// many components import these shapes without needing the (now removed)
// Supabase client itself.

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface EmotionSession {
  id: string;
  user_id: string;
  session_type: 'text' | 'voice' | 'multimodal' | 'chat';
  emotion_detected: string;
  confidence_score: number;
  input_text?: string;
  audio_url?: string;
  ai_response: string;
  feedback_rating?: number;
  created_at: string;
}

export interface ChatSession {
  id: string;
  user_id: string;
  session_title: string;
  created_at: string;
  updated_at: string;
}

// Row shape returned by GET /api/messages/emotion-history
export interface EmotionHistoryMessage {
  id: string;
  emotion: string;
  emotion_confidence: number | null;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  user_id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  emotion?: string | null;
  emotion_confidence?: number | null;
  metadata?: Record<string, unknown> | null;
  audio_url?: string | null;
  created_at: string;
  // Legacy fields (to support existing components while we migrate usage)
  message?: string;
  emotion_detected?: string | null;
  confidence_score?: number | null;
}
