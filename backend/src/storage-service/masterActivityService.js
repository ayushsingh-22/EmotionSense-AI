import { createClient } from '@supabase/supabase-js';

class MasterActivityService {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }

  /**
   * Insert a new activity into master_user_activity table
   * @param {Object} activityData - Activity data to insert
   * @param {string} activityData.user_id - User ID (UUID)
   * @param {string} activityData.activity_type - Type of activity ('chat_message', 'ai_response')
   * @param {string} activityData.content - Main content (message text, etc)
   * @param {string} activityData.role - Role ('user', 'assistant')
   * @param {string} activityData.source - Source ('chat')
   * @param {Object} activityData.emotion_data - Emotion analysis results
   * @param {Object} activityData.metadata - Additional metadata
   * @param {string} activityData.session_id - Session ID (optional)
   * @returns {Object} Inserted activity record
   */
  async insertActivity({
    user_id,
    activity_type,
    content,
    role = 'assistant',
    source = 'chat', 
    emotion_data = {},
    metadata = {},
    session_id = null
  }) {
    try {
      // Validate required fields
      if (!user_id) {
        throw new Error('user_id is required');
      }
      
      if (!activity_type) {
        throw new Error('activity_type is required');
      }
      
      const validActivityTypes = ['chat_message', 'ai_response'];
      const validRoles = ['user', 'assistant'];
      const validSources = ['chat'];
      
      if (!validActivityTypes.includes(activity_type)) {
        throw new Error(`Invalid activity_type. Must be one of: ${validActivityTypes.join(', ')}`);
      }
      
      if (!validRoles.includes(role)) {
        throw new Error(`Invalid role. Must be one of: ${validRoles.join(', ')}`);
      }
      
      if (!validSources.includes(source)) {
        throw new Error(`Invalid source. Must be one of: ${validSources.join(', ')}`);
      }

      // Calculate local_date from current timestamp in IST
      const now = new Date();
      const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
      const istDate = new Date(now.getTime() + istOffset);
      const local_date = istDate.toISOString().split('T')[0];

      const activityRecord = {
        user_id,
        session_id,
        activity_type,
        role,
        source,
        content,
        emotion_data: emotion_data || {},
        metadata: metadata || {},
        local_date,
        created_at: now.toISOString()
      };

      const { data, error } = await this.supabase
        .from('master_user_activity')
        .insert(activityRecord)
        .select()
        .single();

      if (error) {
        console.error('Error inserting activity:', error);
        throw new Error(`Failed to insert activity: ${error.message}`);
      }

      console.log(`✅ Inserted ${activity_type} activity for user ${user_id}`);
      return data;

    } catch (error) {
      console.error('MasterActivityService.insertActivity error:', error);
      throw error;
    }
  }

  /**
   * Get activities for a user with filtering options
   * @param {Object} options - Query options
   * @param {string} options.user_id - User ID (required)
   * @param {string} options.startDate - Start date (YYYY-MM-DD format)
   * @param {string} options.endDate - End date (YYYY-MM-DD format)
   * @param {string|string[]} options.activity_type - Activity type(s) to filter by
   * @param {number} options.limit - Maximum number of records to return (default: 100)
   * @param {number} options.offset - Number of records to skip (default: 0)
   * @returns {Object} { data: activities[], count: total_count }
   */
  async getActivities({
    user_id,
    startDate,
    endDate,
    activity_type,
    limit = 100,
    offset = 0
  }) {
    try {
      if (!user_id) {
        throw new Error('user_id is required');
      }

      let query = this.supabase
        .from('master_user_activity')
        .select('*', { count: 'exact' })
        .eq('user_id', user_id);

      // Apply filters
      if (startDate) {
        query = query.gte('local_date', startDate);
      }
      
      if (endDate) {
        query = query.lte('local_date', endDate);
      }
      
      if (activity_type) {
        if (Array.isArray(activity_type)) {
          query = query.in('activity_type', activity_type);
        } else {
          query = query.eq('activity_type', activity_type);
        }
      }

      // Apply pagination and ordering
      query = query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) {
        console.error('Error fetching activities:', error);
        throw new Error(`Failed to fetch activities: ${error.message}`);
      }

      return { data: data || [], count: count || 0 };

    } catch (error) {
      console.error('MasterActivityService.getActivities error:', error);
      throw error;
    }
  }

  /**
   * Get activities for a specific session
   * @param {string} session_id - Session ID
   * @param {number} limit - Maximum number of records (default: 100)
   * @returns {Array} Array of activity records
   */
  async getSessionActivities(session_id, limit = 100) {
    try {
      if (!session_id) {
        throw new Error('session_id is required');
      }

      const { data, error } = await this.supabase
        .from('master_user_activity')
        .select('*')
        .eq('session_id', session_id)
        .order('created_at', { ascending: true })
        .limit(limit);

      if (error) {
        console.error('Error fetching session activities:', error);
        throw new Error(`Failed to fetch session activities: ${error.message}`);
      }

      return data || [];

    } catch (error) {
      console.error('MasterActivityService.getSessionActivities error:', error);
      throw error;
    }
  }

  /**
   * Get latest activities for a user (for quick overview)
   * @param {string} user_id - User ID
   * @param {number} limit - Maximum number of records (default: 20)
   * @returns {Array} Array of activity records
   */
  async getLatestActivitiesForUser(user_id, limit = 20) {
    try {
      if (!user_id) {
        throw new Error('user_id is required');
      }

      const { data, error } = await this.supabase
        .from('master_user_activity')
        .select('*')
        .eq('user_id', user_id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching latest activities:', error);
        throw new Error(`Failed to fetch latest activities: ${error.message}`);
      }

      return data || [];

    } catch (error) {
      console.error('MasterActivityService.getLatestActivitiesForUser error:', error);
      throw error;
    }
  }

  /**
   * Get session chat messages only (for chat UI)
   * @param {string} session_id - Session ID
   * @param {number} limit - Maximum number of messages (default: 100)
   * @returns {Array} Array of chat messages formatted for UI
   */
  async getSessionChatMessages(session_id, limit = 100) {
    try {
      if (!session_id) {
        throw new Error('session_id is required');
      }

      const { data, error } = await this.supabase
        .from('master_user_activity')
        .select('*')
        .eq('session_id', session_id)
        .in('activity_type', ['chat_message', 'ai_response'])
        .order('created_at', { ascending: true })
        .limit(limit);

      if (error) {
        console.error('Error fetching session chat messages:', error);
        throw new Error(`Failed to fetch session chat messages: ${error.message}`);
      }

      // Format for chat UI
      const formattedMessages = (data || []).map(activity => ({
        id: activity.id,
        content: activity.content,
        role: activity.activity_type === 'chat_message' ? 'user' : 'assistant',
        emotion: activity.emotion_data?.emotion || null,
        emotion_confidence: activity.emotion_data?.confidence || null,
        metadata: activity.metadata || {},
        audio_url: activity.metadata?.audio_url || null,
        created_at: activity.created_at,
        // Include original activity data for reference
        activity_type: activity.activity_type,
        emotion_data: activity.emotion_data
      }));

      return formattedMessages;

    } catch (error) {
      console.error('MasterActivityService.getSessionChatMessages error:', error);
      throw error;
    }
  }

  /**
   * Get emotion insights for a user within a date range
   * @param {string} user_id - User ID
   * @param {string} startDate - Start date (YYYY-MM-DD)
   * @param {string} endDate - End date (YYYY-MM-DD)
   * @returns {Object} Emotion insights summary
   */
  async getEmotionInsights(user_id, startDate, endDate) {
    try {
      if (!user_id || !startDate || !endDate) {
        throw new Error('user_id, startDate, and endDate are required');
      }

      const { data, error } = await this.supabase
        .from('master_user_activity')
        .select('emotion_data, activity_type, created_at, local_date')
        .eq('user_id', user_id)
        .gte('local_date', startDate)
        .lte('local_date', endDate)
        .not('emotion_data', 'eq', '{}')
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching emotion insights:', error);
        throw new Error(`Failed to fetch emotion insights: ${error.message}`);
      }

      // Process emotion data
      const emotionCounts = {};
      const dailyEmotions = {};
      let totalActivities = 0;
      let totalConfidence = 0;
      let confidenceCount = 0;

      (data || []).forEach(activity => {
        const { emotion_data, local_date } = activity;
        
        if (emotion_data?.emotion) {
          const emotion = emotion_data.emotion;
          emotionCounts[emotion] = (emotionCounts[emotion] || 0) + 1;
          
          // Daily tracking
          if (!dailyEmotions[local_date]) {
            dailyEmotions[local_date] = {};
          }
          dailyEmotions[local_date][emotion] = (dailyEmotions[local_date][emotion] || 0) + 1;
          
          totalActivities++;
          
          if (emotion_data.confidence) {
            totalConfidence += emotion_data.confidence;
            confidenceCount++;
          }
        }
      });

      // Find dominant emotion
      const dominantEmotion = Object.keys(emotionCounts).reduce((a, b) => 
        emotionCounts[a] > emotionCounts[b] ? a : b, null);

      const insights = {
        period: { startDate, endDate },
        totalActivities,
        dominantEmotion,
        emotionDistribution: emotionCounts,
        dailyEmotions,
        averageConfidence: confidenceCount > 0 ? totalConfidence / confidenceCount : 0,
        activityCount: totalActivities
      };

      return insights;

    } catch (error) {
      console.error('MasterActivityService.getEmotionInsights error:', error);
      throw error;
    }
  }

  /**
   * Get activity statistics for a user
   * @param {string} user_id - User ID
   * @param {string} period - Time period ('today', 'week', 'month')
   * @returns {Object} Activity statistics
   */
  async getActivityStats(user_id, period = 'week') {
    try {
      if (!user_id) {
        throw new Error('user_id is required');
      }

      const now = new Date();
      let startDate;
      
      switch (period) {
        case 'today':
          startDate = now.toISOString().split('T')[0];
          break;
        case 'week':
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          startDate = weekAgo.toISOString().split('T')[0];
          break;
        case 'month':
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          startDate = monthAgo.toISOString().split('T')[0];
          break;
        default:
          throw new Error('Invalid period. Use "today", "week", or "month"');
      }

      const { data, error } = await this.supabase
        .from('master_user_activity')
        .select('activity_type, emotion_data, local_date')
        .eq('user_id', user_id)
        .gte('local_date', startDate);

      if (error) {
        console.error('Error fetching activity stats:', error);
        throw new Error(`Failed to fetch activity stats: ${error.message}`);
      }

      // Process statistics
      const stats = {
        period,
        totalActivities: data.length,
        activityTypes: {},
        emotionBreakdown: {},
        dailyActivity: {}
      };

      (data || []).forEach(activity => {
        // Activity type counts
        stats.activityTypes[activity.activity_type] = 
          (stats.activityTypes[activity.activity_type] || 0) + 1;

        // Emotion counts
        if (activity.emotion_data?.emotion) {
          const emotion = activity.emotion_data.emotion;
          stats.emotionBreakdown[emotion] = 
            (stats.emotionBreakdown[emotion] || 0) + 1;
        }

        // Daily activity counts
        stats.dailyActivity[activity.local_date] = 
          (stats.dailyActivity[activity.local_date] || 0) + 1;
      });

      return stats;

    } catch (error) {
      console.error('MasterActivityService.getActivityStats error:', error);
      throw error;
    }
  }
}

// Create the service instance
const masterActivityService = new MasterActivityService();

/**
 * Wrapper function to save chat activity with proper mapping
 */
export async function saveActivity({
  userId,
  sessionId,
  messageId,
  content,
  role,
  source,
  primaryEmotion,
  emotionConfidence,
  emotionScores,
  voiceTranscript,
  meta
}) {
  try {
    // Map the parameters to the expected format
    const activityType = role === 'user' ? 'chat_message' : 'ai_response';
    
    // CRITICAL FIX: Use correct emotion_data keys that match what insights API expects
    // Insights queries for: emotion_data.emotion, emotion_data.confidence
    const result = await masterActivityService.insertActivity({
      user_id: userId,
      activity_type: activityType,
      role: role,
      source: source,
      content: content,
      emotion_data: {
        emotion: primaryEmotion,           // CHANGED: was primary_emotion
        confidence: emotionConfidence,     // CHANGED: was emotion_confidence
        scores: emotionScores,             // CHANGED: was emotion_scores
        transcript: voiceTranscript        // CHANGED: was voice_transcript
      },
      metadata: {
        session_id: sessionId,
        message_id: messageId,
        ...meta
      },
      session_id: sessionId
    });
    
    return result;
  } catch (error) {
    console.error('saveActivity wrapper error:', error);
    throw error;
  }
}

export default masterActivityService;