import prisma from '../lib/prisma.js';

const normalizeActivityRow = (row) => {
  if (!row) {
    return row;
  }

  return {
    id: row.id,
    user_id: row.userId,
    session_id: row.sessionId,
    activity_type: row.activityType,
    role: row.role,
    source: row.source,
    content: row.content,
    emotion_data: row.emotionData ?? {},
    metadata: row.metadata ?? {},
    local_date: row.localDate,
    // Serialize to an ISO string — Prisma returns a native Date object here,
    // but every consumer (e.g. insightsRoutes.js's DateTime.fromISO calls)
    // expects a string, matching what the pre-Prisma Supabase client used to
    // return. Passing a Date object to DateTime.fromISO silently produces an
    // Invalid DateTime, breaking date-keyed grouping without ever throwing.
    created_at: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt
  };
};

class MasterActivityService {
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

      const created = await prisma.masterUserActivity.create({
        data: {
          userId: user_id,
          sessionId: session_id,
          activityType: activity_type,
          role,
          source,
          content,
          emotionData: emotion_data || {},
          metadata: metadata || {},
          localDate: local_date,
          createdAt: now
        }
      });

      console.log(`✅ Inserted ${activity_type} activity for user ${user_id}`);
      return normalizeActivityRow(created);

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

      const where = { userId: user_id };

      if (startDate || endDate) {
        where.localDate = {};
        if (startDate) where.localDate.gte = startDate;
        if (endDate) where.localDate.lte = endDate;
      }

      if (activity_type) {
        where.activityType = Array.isArray(activity_type)
          ? { in: activity_type }
          : activity_type;
      }

      const [rows, count] = await Promise.all([
        prisma.masterUserActivity.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: offset,
          take: limit
        }),
        prisma.masterUserActivity.count({ where })
      ]);

      return { data: rows.map(normalizeActivityRow), count };

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

      const rows = await prisma.masterUserActivity.findMany({
        where: { sessionId: session_id },
        orderBy: { createdAt: 'asc' },
        take: limit
      });

      return rows.map(normalizeActivityRow);

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

      const rows = await prisma.masterUserActivity.findMany({
        where: { userId: user_id },
        orderBy: { createdAt: 'desc' },
        take: limit
      });

      return rows.map(normalizeActivityRow);

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

      const rows = await prisma.masterUserActivity.findMany({
        where: {
          sessionId: session_id,
          activityType: { in: ['chat_message', 'ai_response'] }
        },
        orderBy: { createdAt: 'asc' },
        take: limit
      });

      // Format for chat UI
      const formattedMessages = rows.map((activity) => ({
        id: activity.id,
        content: activity.content,
        role: activity.activityType === 'chat_message' ? 'user' : 'assistant',
        emotion: activity.emotionData?.emotion || null,
        emotion_confidence: activity.emotionData?.confidence || null,
        metadata: activity.metadata || {},
        audio_url: activity.metadata?.audio_url || null,
        created_at: activity.createdAt,
        // Include original activity data for reference
        activity_type: activity.activityType,
        emotion_data: activity.emotionData
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

      const rows = await prisma.masterUserActivity.findMany({
        where: {
          userId: user_id,
          localDate: { gte: startDate, lte: endDate },
          NOT: { emotionData: { equals: {} } }
        },
        orderBy: { createdAt: 'asc' },
        select: { emotionData: true, activityType: true, createdAt: true, localDate: true }
      });

      // Process emotion data
      const emotionCounts = {};
      const dailyEmotions = {};
      let totalActivities = 0;
      let totalConfidence = 0;
      let confidenceCount = 0;

      rows.forEach((activity) => {
        const emotion_data = activity.emotionData;
        const local_date = activity.localDate;

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

      const rows = await prisma.masterUserActivity.findMany({
        where: {
          userId: user_id,
          localDate: { gte: startDate }
        },
        select: { activityType: true, emotionData: true, localDate: true }
      });

      // Process statistics
      const stats = {
        period,
        totalActivities: rows.length,
        activityTypes: {},
        emotionBreakdown: {},
        dailyActivity: {}
      };

      rows.forEach((activity) => {
        // Activity type counts
        stats.activityTypes[activity.activityType] =
          (stats.activityTypes[activity.activityType] || 0) + 1;

        // Emotion counts
        if (activity.emotionData?.emotion) {
          const emotion = activity.emotionData.emotion;
          stats.emotionBreakdown[emotion] =
            (stats.emotionBreakdown[emotion] || 0) + 1;
        }

        // Daily activity counts
        stats.dailyActivity[activity.localDate] =
          (stats.dailyActivity[activity.localDate] || 0) + 1;
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
