import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { UnifiedActivity, ActivityQuery } from '@/lib/api';

// Types for the hook
export interface UseUnifiedHistoryOptions {
  activityTypes?: string[];
  limit?: number;
  autoRefresh?: boolean;
  refreshInterval?: number;
  startDate?: string;
  endDate?: string;
}

export interface UnifiedHistoryState {
  activities: UnifiedActivity[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  totalCount: number;
  page: number;
}

export interface EmotionInsights {
  emotionDistribution: Record<string, number>;
  dominantEmotion: string;
  moodTrend: number[];
  activityCount: number;
  timeDistribution: Record<string, number>;
}

/**
 * Custom hook for accessing unified activity data
 * Provides centralized access to user activities with caching, pagination, and real-time insights
 */
export const useUnifiedHistory = (options: UseUnifiedHistoryOptions = {}) => {
  const { user } = useAuth();
  const {
    activityTypes = [],
    limit = 20,
    autoRefresh = false,
    refreshInterval = 30000,
    startDate,
    endDate
  } = options;

  // State management
  const [state, setState] = useState<UnifiedHistoryState>({
    activities: [],
    loading: false,
    error: null,
    hasMore: true,
    totalCount: 0,
    page: 1
  });

  const [emotionInsights, setEmotionInsights] = useState<EmotionInsights | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);

  // Memoized query object to prevent unnecessary API calls
  const query = useMemo((): ActivityQuery => ({
    user_id: user?.id || '',
    activity_type: activityTypes.length > 0 ? activityTypes : undefined,
    startDate,
    endDate,
    limit,
    offset: (state.page - 1) * limit
  }), [user?.id, activityTypes, startDate, endDate, limit, state.page]);

  /**
   * Load activities from the unified API
   */
  const loadActivities = useCallback(async (resetPage = false) => {
    if (!user?.id) return;

    try {
      setState(prev => ({
        ...prev,
        loading: true,
        error: null,
        ...(resetPage && { page: 1, activities: [] })
      }));

      const currentQuery = resetPage ? { ...query, offset: 0 } : query;
      
      // Dynamic import to avoid build issues
      const { getUnifiedActivities } = await import('@/lib/api');
      const result = await getUnifiedActivities(currentQuery);

      setState(prev => ({
        ...prev,
        activities: resetPage ? result.data : [...prev.activities, ...result.data],
        totalCount: result.total_count,
        hasMore: result.data.length === limit,
        loading: false,
        ...(resetPage && { page: 1 })
      }));

    } catch (error) {
      console.error('Error loading unified activities:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to load activities',
        loading: false
      }));
    }
  }, [user?.id, query, limit]);

  /**
   * Load next page of activities
   */
  const loadMore = useCallback(() => {
    if (state.loading || !state.hasMore) return;
    
    setState(prev => ({ ...prev, page: prev.page + 1 }));
  }, [state.loading, state.hasMore]);

  /**
   * Refresh activities (reset to first page)
   */
  const refresh = useCallback(() => {
    loadActivities(true);
  }, [loadActivities]);

  /**
   * Load emotion insights
   */
  const loadEmotionInsights = useCallback(async () => {
    if (!user?.id) return;

    try {
      setInsightsLoading(true);
      
      // Dynamic import
      const { getEmotionInsights } = await import('@/lib/api');
      const insights = await getEmotionInsights(user.id, startDate, endDate);
      
      setEmotionInsights({
        emotionDistribution: insights.emotion_distribution,
        dominantEmotion: insights.dominant_emotion,
        moodTrend: insights.mood_trend,
        activityCount: insights.activity_count,
        timeDistribution: insights.time_distribution
      });

    } catch (error) {
      console.error('Error loading emotion insights:', error);
    } finally {
      setInsightsLoading(false);
    }
  }, [user?.id, startDate, endDate]);

  /**
   * Filter activities by type (client-side)
   */
  const filterByType = useCallback((type: string) => {
    return state.activities.filter(activity => activity.activity_type === type);
  }, [state.activities]);

  /**
   * Get activities for a specific session
   */
  const getSessionActivities = useCallback((sessionId: string) => {
    return state.activities.filter(activity => activity.session_id === sessionId);
  }, [state.activities]);

  /**
   * Get activities for a specific date
   */
  const getActivitiesByDate = useCallback((date: string) => {
    return state.activities.filter(activity => activity.local_date === date);
  }, [state.activities]);

  /**
   * Get emotion summary for loaded activities
   */
  const getEmotionSummary = useCallback(() => {
    const emotionCounts: Record<string, number> = {};
    let totalActivities = 0;

    state.activities.forEach(activity => {
      if (activity.emotion_data?.emotion) {
        const emotion = activity.emotion_data.emotion;
        emotionCounts[emotion] = (emotionCounts[emotion] || 0) + 1;
        totalActivities++;
      }
    });

    const dominantEmotion = Object.entries(emotionCounts)
      .sort(([, a], [, b]) => b - a)[0]?.[0] || 'neutral';

    return {
      emotionCounts,
      dominantEmotion,
      totalActivities
    };
  }, [state.activities]);

  /**
   * Get chat conversations (grouped by session)
   */
  const getChatConversations = useCallback(() => {
    const chatActivities = filterByType('chat_message').concat(filterByType('ai_response'));
    const conversations: Record<string, UnifiedActivity[]> = {};

    chatActivities.forEach(activity => {
      const sessionId = activity.session_id || 'default';
      if (!conversations[sessionId]) {
        conversations[sessionId] = [];
      }
      conversations[sessionId].push(activity);
    });

    // Sort activities within each conversation by timestamp
    Object.keys(conversations).forEach(sessionId => {
      conversations[sessionId].sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    });

    return conversations;
  }, [filterByType]);

  // Load initial data when user or query changes
  useEffect(() => {
    if (user?.id) {
      loadActivities(true);
      loadEmotionInsights();
    }
  }, [user?.id, JSON.stringify(query)]); // Use JSON.stringify for deep comparison

  // Auto-refresh functionality
  useEffect(() => {
    if (!autoRefresh || !user?.id) return;

    const interval = setInterval(() => {
      refresh();
      loadEmotionInsights();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, refresh, loadEmotionInsights, user?.id]);

  // Load more when page changes
  useEffect(() => {
    if (state.page > 1) {
      loadActivities();
    }
  }, [state.page, loadActivities]);

  return {
    // Data
    activities: state.activities,
    emotionInsights,
    
    // State
    loading: state.loading,
    insightsLoading,
    error: state.error,
    hasMore: state.hasMore,
    totalCount: state.totalCount,
    currentPage: state.page,
    
    // Actions
    loadMore,
    refresh,
    loadEmotionInsights,
    
    // Utilities
    filterByType,
    getSessionActivities,
    getActivitiesByDate,
    getEmotionSummary,
    getChatConversations,
    
    // Computed values
    hasActivities: state.activities.length > 0,
    isEmpty: state.activities.length === 0 && !state.loading,
    chatActivities: useMemo(() => filterByType('chat_message'), [filterByType]),
    emotionActivities: useMemo(() => filterByType('emotion_analysis'), [filterByType]),
    voiceActivities: useMemo(() => filterByType('voice_analysis'), [filterByType]),
  };
};

/**
 * Hook for session-specific activities
 */
export const useSessionHistory = (sessionId: string, userId?: string) => {
  const [sessionActivities, setSessionActivities] = useState<UnifiedActivity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSessionMessages = useCallback(async () => {
    if (!sessionId || !userId) return;

    try {
      setLoading(true);
      setError(null);
      
      // Dynamic import
      const { getSessionMessages } = await import('@/lib/api');
      const messages = await getSessionMessages(userId, sessionId);
      
      setSessionActivities(messages);
    } catch (err) {
      console.error('Error loading session messages:', err);
      setError(err instanceof Error ? err.message : 'Failed to load session messages');
    } finally {
      setLoading(false);
    }
  }, [sessionId, userId]);

  useEffect(() => {
    loadSessionMessages();
  }, [loadSessionMessages]);

  return {
    activities: sessionActivities,
    loading,
    error,
    refresh: loadSessionMessages,
    messageCount: sessionActivities.length,
    lastActivity: sessionActivities[sessionActivities.length - 1] || null
  };
};

/**
 * Hook for date-specific activities
 */
export const useDailyHistory = (date: string) => {
  const { user } = useAuth();
  const [dailyActivities, setDailyActivities] = useState<UnifiedActivity[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user?.id || !date) return;

    const loadDailyActivities = async () => {
      try {
        setLoading(true);
        
        // Dynamic import
        const { getUnifiedActivities } = await import('@/lib/api');
        const result = await getUnifiedActivities({
          user_id: user.id,
          startDate: date,
          endDate: date,
          limit: 1000 // Get all activities for the day
        });
        
        setDailyActivities(result.data);
      } catch (error) {
        console.error('Error loading daily activities:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDailyActivities();
  }, [user?.id, date]);

  return {
    activities: dailyActivities,
    loading,
    activityCount: dailyActivities.length,
    emotionSummary: useMemo(() => {
      const emotions: Record<string, number> = {};
      dailyActivities.forEach(activity => {
        if (activity.emotion_data?.emotion) {
          const emotion = activity.emotion_data.emotion;
          emotions[emotion] = (emotions[emotion] || 0) + 1;
        }
      });
      return emotions;
    }, [dailyActivities])
  };
};