/**
 * Insights Storage Service
 * Handles all database operations for emotion insights, daily journals, and weekly summaries
 * UPDATED: Now uses unified emotion service for consistency
 */

import { createClient } from '@supabase/supabase-js';
import config from '../config/index.js';
import * as unifiedEmotion from './unifiedEmotionService.js';
import logger from '../utils/logger.js';

const { normalizeEmotion } = unifiedEmotion;

const supabase = createClient(
  config.database.supabase.url, 
  config.database.supabase.serviceRoleKey || config.database.supabase.anonKey
);

/**
 * Get daily insights for a user
 * UPDATED: Returns journals with unified emotion data from messages
 * @param {string} userId - User ID
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @returns {Promise<Array>} Daily journal entries with consistent emotion data
 */
async function getDailyInsights(userId, startDate, endDate) {
  try {
    // Get journal entries
    let query = supabase
      .from('journal_entries')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });

    if (startDate) {
      query = query.gte('date', startDate);
    }
    if (endDate) {
      query = query.lte('date', endDate);
    }

    const { data: journals, error } = await query;

    if (error) throw error;

    // If no journals, return empty array
    if (!journals || journals.length === 0) return [];

    // Enrich each journal with message-based emotion data
    const enrichedJournals = await Promise.all(journals.map(async (journal) => {
      try {
        // Get emotion summary from messages for this date
        const messageSummary = await unifiedEmotion.getDailyEmotionSummary(userId, journal.date);
        
        // Fuse journal emotion with message emotions
        const fusedEmotion = unifiedEmotion.fuseJournalAndMessageEmotions(journal, messageSummary);
        
        // Return enriched journal with consistent emotion data (NORMALIZED)
        const normalizedDominant = normalizeEmotion(fusedEmotion.dominantEmotion);
        return {
          ...journal,
          emotion_summary: {
            ...journal.emotion_summary,
            dominant_emotion: normalizedDominant,
            mood_score: fusedEmotion.moodScore,
            emotion_counts: messageSummary.emotionCounts || journal.emotion_summary?.emotion_counts || {},
            time_segments: messageSummary.timeSegments || journal.emotion_summary?.time_segments || [],
            context_summary: messageSummary.contextSummary || journal.emotion_summary?.context_summary || '',
            message_count: messageSummary.messageCount || 0
          },
          emotion: normalizedDominant,
          emotion_emoji: fusedEmotion.emotionEmoji
        };
      } catch (enrichError) {
        logger.error(`Error enriching journal for ${journal.date}:`, enrichError);
        // Return original journal if enrichment fails
        return journal;
      }
    }));

    return enrichedJournals;
  } catch (error) {
    logger.error('Error fetching daily insights:', error);
    throw error;
  }
}

/**
 * Get weekly insights for a user
 * @param {string} userId - User ID
 * @param {number} limit - Number of weeks to fetch
 * @returns {Promise<Array>} Weekly insight entries
 */
async function getWeeklyInsights(userId, limit = 4) {
  try {
    const { data, error } = await supabase
      .from('weekly_insights')
      .select('*')
      .eq('user_id', userId)
      .order('week_start', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching weekly insights:', error);
    throw error;
  }
}

/**
 * Get emotion timeline for a specific date
 * UPDATED: Uses unified emotion service and includes journal context
 * @param {string} userId - User ID
 * @param {string} date - Date (YYYY-MM-DD)
 * @returns {Promise<Object>} Timeline with hourly emotion breakdown and journal
 */
async function getEmotionTimeline(userId, date) {
  try {
    // Get daily summary from messages (unified source)
    const dailySummary = await unifiedEmotion.getDailyEmotionSummary(userId, date);

    // Get journal entry for this date
    const { data: journal } = await supabase
      .from('journal_entries')
      .select('*')
      .eq('user_id', userId)
      .eq('date', date)
      .single();

    // Fuse emotions if journal exists
    let fusedData = dailySummary;
    if (journal) {
      fusedData = {
        ...dailySummary,
        ...unifiedEmotion.fuseJournalAndMessageEmotions(journal, dailySummary),
        journal: {
          id: journal.id,
          content: journal.content,
          emotion: journal.emotion,
          created_at: journal.created_at
        }
      };
    }

    // Build hourly timeline from messages
    const timeline = buildHourlyTimeline(dailySummary.messages);

    return {
      date,
      moodScore: fusedData.moodScore,
      dominantEmotion: fusedData.dominantEmotion,
      emotionEmoji: fusedData.emotionEmoji,
      emotionCounts: fusedData.emotionCounts,
      contextSummary: fusedData.contextSummary,
      messages: dailySummary.messages,
      journal: fusedData.journal || null,
      timeline,
      timeSegments: fusedData.timeSegments || []
    };
  } catch (error) {
    logger.error('Error fetching emotion timeline:', error);
    throw error;
  }
}

/**
 * Get overall statistics for a user
 * @param {string} userId - User ID
 * @returns {Promise<Object>} User statistics
 */
async function getUserStats(userId) {
  try {
    // Get total tracked days
    const { data: journals, error: journalError } = await supabase
      .from('journal_entries')
      .select('date')
      .eq('user_id', userId);

    if (journalError) throw journalError;

    // Get first message date
    const { data: firstMessage, error: messageError } = await supabase
      .from('messages')
      .select('created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    // Get emotion distribution from messages (canonical source)
    const { data: messages, error: emotionError } = await supabase
      .from('messages')
      .select('emotion')
      .eq('user_id', userId)
      .eq('role', 'user')
      .not('emotion', 'is', null);

    if (emotionError) throw emotionError;

    // Count emotion occurrences
    const emotionCounts = (messages || []).reduce((acc, m) => {
      acc[m.emotion] = (acc[m.emotion] || 0) + 1;
      return acc;
    }, {});

    return {
      trackedDays: journals?.length || 0,
      firstChatDate: firstMessage?.created_at || null,
      totalEmotions: emotions?.length || 0,
      emotionDistribution: emotionCounts
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
 * Get key moments for a date range
 * UPDATED: Uses messages table directly as source of truth
 * @param {string} userId - User ID
 * @param {string} startDate - Start date
 * @param {string} endDate - End date
 * @returns {Promise<Array>} Key emotional moments with context
 */
async function getKeyMoments(userId, startDate, endDate) {
  try {
    // Get messages with high-confidence emotions
    const { data: messages, error } = await supabase
      .from('messages')
      .select('*')
      .eq('user_id', userId)
      .eq('role', 'user')
      .gte('created_at', `${startDate}T00:00:00Z`)
      .lte('created_at', `${endDate}T23:59:59Z`)
      .order('emotion_confidence', { ascending: false })
      .limit(30);

    if (error) throw error;

    if (!messages || messages.length === 0) {
      return [];
    }

    // Build moments from messages
    const moments = messages.slice(0, 15).map(msg => {
      const context = msg.content.length > 100 
        ? msg.content.substring(0, 100) + '...' 
        : msg.content;

      return {
        emotion: msg.emotion,
        confidence: msg.emotion_confidence,
        timestamp: msg.created_at,
        context
      };
    }).filter(m => m.emotion); // Only include messages with emotions

    return moments;
  } catch (error) {
    logger.error('Error fetching key moments:', error);
    return [];
  }
}

/**
 * Build hourly timeline from messages array
 * UPDATED: Works with messages that have emotion field
 * @param {Array} messages - Array of message records with emotions
 * @returns {Array} Hourly breakdown
 */
function buildHourlyTimeline(messages) {
  const hourlyData = {};

  messages.forEach(msg => {
    if (!msg.emotion) return; // Skip messages without emotions
    
    const hour = new Date(msg.created_at).getHours();
    if (!hourlyData[hour]) {
      hourlyData[hour] = {
        hour,
        emotions: [],
        dominant: null,
        count: 0
      };
    }
    hourlyData[hour].emotions.push(msg.emotion);
    hourlyData[hour].count++;
  });

  // Calculate dominant emotion per hour
  Object.keys(hourlyData).forEach(hour => {
    const emotionCounts = hourlyData[hour].emotions.reduce((acc, e) => {
      acc[e] = (acc[e] || 0) + 1;
      return acc;
    }, {});
    
    if (Object.keys(emotionCounts).length > 0) {
      hourlyData[hour].dominant = Object.keys(emotionCounts).reduce((a, b) => 
        emotionCounts[a] > emotionCounts[b] ? a : b
      );
    }
  });

  return Object.values(hourlyData).sort((a, b) => a.hour - b.hour);
}

/**
 * Create or update daily journal
 * @param {string} userId - User ID
 * @param {string} date - Date (YYYY-MM-DD)
 * @param {Object} data - Journal data
 * @returns {Promise<Object>} Created/updated journal
 */
async function upsertDailyJournal(userId, date, data) {
  try {
    const { data: journal, error } = await supabase
      .from('journal_entries')
      .upsert({
        user_id: userId,
        date,
        ...data,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,date'
      })
      .select()
      .single();

    if (error) throw error;
    return journal;
  } catch (error) {
    console.error('Error upserting daily journal:', error);
    throw error;
  }
}

/**
 * Create or update weekly insight
 * @param {string} userId - User ID
 * @param {string} weekStart - Week start date (YYYY-MM-DD)
 * @param {Object} data - Insight data
 * @returns {Promise<Object>} Created/updated insight
 */
async function upsertWeeklyInsight(userId, weekStart, data) {
  try {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const { data: insight, error } = await supabase
      .from('weekly_insights')
      .upsert({
        user_id: userId,
        week_start: weekStart,
        week_end: weekEnd.toISOString().split('T')[0],
        ...data,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,week_start'
      })
      .select()
      .single();

    if (error) throw error;
    return insight;
  } catch (error) {
    console.error('Error upserting weekly insight:', error);
    throw error;
  }
}

export {
  getDailyInsights,
  getWeeklyInsights,
  getEmotionTimeline,
  getUserStats,
  getKeyMoments,
  upsertDailyJournal,
  upsertWeeklyInsight
};
