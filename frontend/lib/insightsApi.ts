/**
 * Insights API Client
 * Handles all API calls for emotion insights
 */

import { api } from './api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

export interface DailyInsight {
  id: string;
  user_id: string;
  date: string;
  dominant_emotion: string;
  mood_score: number;
  journal_text: string;
  emotion_counts: Record<string, number>;
  time_segments: TimeSegment[];
  created_at: string;
  updated_at: string;
}

export interface KeyHighlight {
  date: string;
  type: 'peak' | 'low';
  description: string;
  emotion: string;
}

export interface WeeklyInsight {
  id: string;
  user_id: string;
  week_start: string;
  week_end: string;
  dominant_emotion: string;
  avg_mood_score: number;
  reflection_text: string;
  emotion_summary: Record<string, number>;
  daily_arc: DayPoint[];
  key_highlights: (string | KeyHighlight)[];
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
  mood_score: number;
}

export interface EmotionTimelineData {
  date: string;
  emotions: Array<{
    id: string;
    emotion: string;
    confidence: number;
    created_at: string;
  }>;
  journal: DailyInsight | null;
  timeline: Array<{
    hour: number;
    emotions: string[];
    dominant: string;
    count: number;
  }>;
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
    const response = await api.get(`${API_URL}/api/insights/weekly?${params}`);
    return response.data.data.insights || [];
  } catch (error) {
    console.error('Error fetching weekly insights:', error);
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
