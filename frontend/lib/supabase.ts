import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

// Types for database tables
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

export interface ChatMessage {
  id: string;
  session_id: string;
  user_id: string;
  message_type: 'user' | 'assistant';
  content: string;
  emotion_detected?: string;
  confidence_score?: number;
  audio_url?: string;
  created_at: string;
}