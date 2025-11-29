/**
 * Storage Service Enhancements for Master User Activity Integration
 * 
 * This file provides additional functions to integrate master_user_activity
 * into the existing storage service layer.
 * 
 * Add these to backend/src/storage-service/index.js
 */

import * as masterActivity from './masterActivityService.js';
import logger from '../utils/logger.js';

/**
 * Get enriched chat messages with full emotion data from master_user_activity
 * 
 * Enhancement to existing getChatMessages function
 */
export const getEnrichedChatMessages = async (userId, sessionId, limit = null) => {
  try {
    // Get activities from master_user_activity
    const { data: activities, error } = await supabase
      .from('master_user_activity')
      .select('*')
      .eq('user_id', userId)
      .eq('session_id', sessionId)
      .eq('source', 'chat')
      .order('created_at', { ascending: true });

    if (error) {
      logger.error('Error fetching enriched messages:', error);
      // Fallback to regular messages
      return await getChatMessages(userId, sessionId, limit);
    }

    // Transform to message format with full emotion data
    return (activities || []).map(activity => ({
      id: activity.message_id || activity.id,
      session_id: activity.session_id,
      user_id: activity.user_id,
      role: activity.role,
      content: activity.content,
      emotion: activity.primary_emotion,
      emotion_confidence: activity.emotion_confidence,
      emotion_scores: activity.emotion_scores,
      mood_score: activity.mood_score,
      metadata: activity.meta,
      audio_url: activity.meta?.audio_url,
      voice_transcript: activity.voice_transcript,
      created_at: activity.created_at,
      // Additional fields from master_activity
      emotion_emoji: activity.primary_emotion_emoji,
      activity_source: activity.source,
      local_date: activity.local_date
    }));
  } catch (error) {
    logger.error('Error in getEnrichedChatMessages:', error);
    throw error;
  }
};

/**
 * Get user analysis results from master_user_activity
 * 
 * Replacement for getAnalysisResultsByUser that uses master_user_activity
 */
export const getAnalysisResultsFromActivity = async (userId, limit = 10) => {
  try {
    const { data, error } = await supabase
      .from('master_user_activity')
      .select('*')
      .eq('user_id', userId)
      .neq('primary_emotion', 'neutral')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      logger.error('Error fetching analysis results:', error);
      return [];
    }

    // Transform to analysis result format
    return (data || []).map(activity => ({
      id: activity.id,
      userId: activity.user_id,
      type: activity.source,
      input: activity.content,
      emotion: activity.primary_emotion,
      confidence: activity.emotion_confidence,
      scores: activity.emotion_scores,
      moodScore: activity.mood_score,
      timestamp: activity.created_at,
      metadata: activity.meta
    }));
  } catch (error) {
    logger.error('Error in getAnalysisResultsFromActivity:', error);
    return [];
  }
};

/**
 * Get user message statistics from master_user_activity
 * 
 * Returns aggregated stats about user's emotional journey
 */
export const getUserActivityStats = async (userId, daysBack = 30) => {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);
    const startISO = startDate.toISOString().split('T')[0];
    const endISO = new Date().toISOString().split('T')[0];

    // Get all activities in range
    const activities = await masterActivity.getActivitiesByDateRange(userId, startISO, endISO);

    if (activities.length === 0) {
      return {
        period: `Last ${daysBack} days`,
        totalMessages: 0,
        uniqueDays: 0,
        dominantEmotion: 'neutral',
        averageMoodScore: 50,
        emotionDistribution: {},
        messagesBySource: {},
        trends: []
      };
    }

    // Calculate stats
    const uniqueDates = new Set(activities.map(a => a.local_date));
    const emotionCounts = {};
    const sourceCount = {};
    let totalMoodScore = 0;

    activities.forEach(activity => {
      // Emotion counts
      if (activity.primary_emotion) {
        emotionCounts[activity.primary_emotion] = 
          (emotionCounts[activity.primary_emotion] || 0) + 1;
      }

      // Source counts
      if (activity.source) {
        sourceCount[activity.source] = (sourceCount[activity.source] || 0) + 1;
      }

      // Mood score
      totalMoodScore += (activity.mood_score || 50);
    });

    // Find dominant emotion
    const dominantEmotion = Object.keys(emotionCounts).reduce((a, b) =>
      emotionCounts[a] > emotionCounts[b] ? a : b,
      'neutral'
    );

    // Calculate trends (daily mood progression)
    const dailyTrends = {};
    activities.forEach(activity => {
      const date = activity.local_date;
      if (!dailyTrends[date]) {
        dailyTrends[date] = [];
      }
      dailyTrends[date].push(activity.mood_score || 50);
    });

    const trends = Object.entries(dailyTrends)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, scores]) => ({
        date,
        averageMoodScore: Math.round(
          scores.reduce((a, b) => a + b, 0) / scores.length
        )
      }));

    return {
      period: `Last ${daysBack} days`,
      totalMessages: activities.length,
      uniqueDays: uniqueDates.size,
      dominantEmotion,
      averageMoodScore: Math.round(totalMoodScore / activities.length),
      emotionDistribution: emotionCounts,
      messagesBySource: sourceCount,
      trends,
      startDate: startISO,
      endDate: endISO
    };
  } catch (error) {
    logger.error('Error calculating user activity stats:', error);
    throw error;
  }
};

/**
 * Get messages by date range with full emotion context
 * 
 * Enhancement to getMessagesByDateRange
 */
export const getEnrichedMessagesByDateRange = async (userId, startISO, endISO) => {
  try {
    // Extract dates
    const startDate = startISO.split('T')[0];
    const endDate = endISO.split('T')[0];

    // Get activities from master_user_activity
    const activities = await masterActivity.getActivitiesByDateRange(userId, startDate, endDate);

    // Filter chat activities
    const chatActivities = activities.filter(a => a.source === 'chat');

    // Transform to message format
    return chatActivities.map(activity => ({
      id: activity.message_id || activity.id,
      user_id: activity.user_id,
      session_id: activity.session_id,
      role: activity.role,
      content: activity.content,
      emotion: activity.primary_emotion,
      emotion_confidence: activity.emotion_confidence,
      emotion_scores: activity.emotion_scores,
      mood_score: activity.mood_score,
      metadata: activity.meta,
      created_at: activity.created_at,
      local_date: activity.local_date
    }));
  } catch (error) {
    logger.error('Error in getEnrichedMessagesByDateRange:', error);
    return [];
  }
};

/**
 * Get session with emotion statistics
 * 
 * Enhancement to existing getChatSession
 */
export const getSessionWithStats = async (userId, sessionId) => {
  try {
    // Get session
    const { data: session, error: sessionError } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('id', sessionId)
      .single();

    if (sessionError) {
      logger.error('Error fetching session:', sessionError);
      return null;
    }

    // Get activities for this session
    const activities = await masterActivity.getActivitiesByDateRange(
      userId,
      null,
      null
    ); // Will be filtered by session below

    const sessionActivities = activities.filter(a => a.session_id === sessionId);

    if (sessionActivities.length === 0) {
      return { ...session, stats: null };
    }

    // Calculate stats
    const userMessages = sessionActivities.filter(a => a.role === 'user');
    const emotionCounts = {};

    userMessages.forEach(msg => {
      if (msg.primary_emotion) {
        emotionCounts[msg.primary_emotion] = 
          (emotionCounts[msg.primary_emotion] || 0) + 1;
      }
    });

    const dominantEmotion = Object.keys(emotionCounts).reduce((a, b) =>
      emotionCounts[a] > emotionCounts[b] ? a : b,
      'neutral'
    );

    const averageMoodScore = Math.round(
      userMessages.reduce((sum, msg) => sum + (msg.mood_score || 50), 0) / userMessages.length
    );

    return {
      ...session,
      stats: {
        messageCount: userMessages.length,
        dominantEmotion,
        averageMoodScore,
        emotionDistribution: emotionCounts,
        startTime: sessionActivities[0]?.created_at,
        endTime: sessionActivities[sessionActivities.length - 1]?.created_at
      }
    };
  } catch (error) {
    logger.error('Error in getSessionWithStats:', error);
    throw error;
  }
};

/**
 * Delete activities for a session (cleanup)
 * 
 * Enhancement to existing deleteChatSession
 */
export const deleteSessionActivities = async (userId, sessionId) => {
  try {
    // Delete from master_user_activity
    const { error: activityError } = await supabase
      .from('master_user_activity')
      .delete()
      .eq('user_id', userId)
      .eq('session_id', sessionId);

    if (activityError) {
      logger.warn('Error deleting session activities:', activityError);
      // Continue anyway - activities may not be migrated yet
    }

    logger.info(`Deleted activities for session ${sessionId}`);
  } catch (error) {
    logger.error('Error in deleteSessionActivities:', error);
    throw error;
  }
};

/**
 * Export all new functions
 */
export {
  getEnrichedChatMessages,
  getAnalysisResultsFromActivity,
  getUserActivityStats,
  getEnrichedMessagesByDateRange,
  getSessionWithStats,
  deleteSessionActivities
};
