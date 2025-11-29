/**
 * Insights API Client
 * Handles all API calls for emotion insights
 * UPDATED: Matches unified backend structure
 */

import { api } from './api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

export interface DailyInsight {
  id: string;
  user_id: string;
  date: string;
  content: string; // Formatted journal text
  emotion: string; // Top-level dominant emotion
  emotion_emoji: string; // Top-level emoji
  emotion_summary: {
    dominant_emotion: string;
    mood_score: number; // 0-100 scale
    emotion_counts: Record<string, number>;
    time_segments: TimeSegment[];
    context_summary: string; // Brief context from messages
    message_count?: number; // Number of messages that day
  };
  created_at: string;
  updated_at: string;
}

export interface KeyHighlight {
  date: string;
  type: 'peak' | 'low' | 'insight';
  description: string;
  emotion: string;
}

export interface WeeklyInsight {
  id: string;
  user_id: string;
  week_start: string;
  week_end: string;
  dominant_emotion: string;
  emotion_emoji: string;
  avg_mood_score: number; // 0-100 scale (NOT 0-1)
  reflection_text: string;
  emotion_summary: Record<string, number>;
  daily_arc: DayPoint[];
  key_highlights: KeyHighlight[];
  total_messages: number;
  total_activities: number;
  peak_mood_day: {
    date: string;
    mood_score: number | null;
    emotion: string;
    activity_count?: number;
    has_data: boolean;
  };
  low_mood_day: {
    date: string;
    mood_score: number | null;
    emotion: string;
    activity_count?: number;
    has_data: boolean;
  };
  mood_variance: number;
  active_days: number;
  created_at: string;
  updated_at: string;
}

export interface TimeSegment {
  period: 'morning' | 'afternoon' | 'evening';
  emotion: string;
  count: number;
}

export interface DayPoint {
  date: string;
  emotion: string;
  mood_score: number | null; // null when no data available
  activity_count: number;
  has_data: boolean;
}

export interface EmotionTimelineData {
  date: string;
  moodScore: number; // 0-100 scale
  dominantEmotion: string;
  emotionEmoji: string;
  emotionCounts: Record<string, number>;
  contextSummary: string;
  messages: Array<{
    id: string;
    content: string;
    emotion: string;
    confidence: number;
    created_at: string;
  }>;
  journal: {
    id: string;
    content: string;
    emotion: string;
    created_at: string;
  } | null;
  timeline: Array<{
    hour: number;
    emotions: string[];
    dominant: string;
    count: number;
  }>;
  timeSegments: TimeSegment[];
}

export interface UserStats {
  trackedDays: number;
  firstChatDate: string | null;
  totalEmotions: number;
  emotionDistribution: Record<string, number>;
}

export interface KeyMoment {
  emotion: string;
  confidence: number;
  timestamp: string;
  context: string;
}

/**
 * Fetch daily insights for a user
 */
export async function getDailyInsights(
  userId: string,
  startDate?: string,
  endDate?: string
): Promise<DailyInsight[]> {
  try {
    const params = new URLSearchParams({ userId });
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    const response = await api.get(`${API_URL}/api/insights/daily?${params}`);
    return response.data.data.insights || [];
  } catch (error) {
    console.error('Error fetching daily insights:', error);
    return [];
  }
}

/**
 * Fetch weekly insights for a user
 */
export async function getWeeklyInsights(
  userId: string,
  limit: number = 4
): Promise<WeeklyInsight[]> {
  try {
    const params = new URLSearchParams({ userId, limit: limit.toString() });
    const response = await api.get(`${API_URL}/api/insights/weekly?${params}`, {
      timeout: 30000, // 30 second timeout for LLM generation
    });
    return response.data.data.insights || [];
  } catch (error) {
    console.error('Error fetching weekly insights:', error);
    return [];
  }
}

/**
 * Fetch monthly insights for a user
 */
export async function getMonthlyInsights(
  userId: string,
  year: number,
  month: number
): Promise<DailyInsight[]> {
  try {
    const params = new URLSearchParams({ 
      userId, 
      year: year.toString(), 
      month: month.toString() 
    });
    const response = await api.get(`${API_URL}/api/insights/monthly?${params}`);
    return response.data.data.insights || [];
  } catch (error) {
    console.error('Error fetching monthly insights:', error);
    return [];
  }
}

/**
 * Fetch emotion timeline for a specific date
 */
export async function getEmotionTimeline(
  userId: string,
  date: string
): Promise<EmotionTimelineData | null> {
  try {
    const params = new URLSearchParams({ userId });
    const response = await api.get(`${API_URL}/api/insights/timeline/${date}?${params}`);
    return response.data.data || null;
  } catch (error) {
    console.error('Error fetching emotion timeline:', error);
    return null;
  }
}

/**
 * Fetch user statistics
 */
export async function getUserStats(userId: string): Promise<UserStats> {
  try {
    const params = new URLSearchParams({ userId });
    const response = await api.get(`${API_URL}/api/insights/stats?${params}`);
    
    // DEBUG: Log the entire response to understand structure
    console.log('🔍 getUserStats response:', {
      status: response.status,
      data: response.data,
      headers: response.headers
    });
    
    return response.data.data || {
      trackedDays: 0,
      firstChatDate: null,
      totalEmotions: 0,
      emotionDistribution: {}
    };
  } catch (error) {
    console.error('Error fetching user stats:', error);
    return {
      trackedDays: 0,
      firstChatDate: null,
      totalEmotions: 0,
      emotionDistribution: {}
    };
  }
}

/**
 * Fetch key emotional moments
 */
export async function getKeyMoments(
  userId: string,
  startDate?: string,
  endDate?: string
): Promise<KeyMoment[]> {
  try {
    const params = new URLSearchParams({ userId });
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    const response = await api.get(`${API_URL}/api/insights/moments?${params}`);
    return response.data.data.moments || [];
  } catch (error) {
    console.error('Error fetching key moments:', error);
    return [];
  }
}
