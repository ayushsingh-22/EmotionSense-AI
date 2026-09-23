/**
 * Insights Storage Service
 * Handles all database operations for emotion insights, daily journals, and weekly summaries
 * UPDATED: Now uses unified emotion service for consistency, and Prisma/Neon for storage.
 *
 * SCHEMA NOTE: the original Supabase schema had dedicated `journal_entries` and
 * `weekly_insights` tables. The finalized Neon/Prisma schema (prisma/schema.prisma)
 * does not include them - they were consolidated into `DailyEmotionSummary` and
 * `WeeklyEmotionSummary`. This file stores/reads through those models and
 * reshapes rows back into the old journal/weekly-insight row shapes so callers
 * (insightsRoutes.js) don't need to change. Flag this mapping for review by
 * whoever owns the schema - it's a best-effort compatibility shim, not a
 * database-level guarantee.
 */

import prisma from '../lib/prisma.js';
import journalGenerator from '../journal-service/journalGenerator.js';
import * as storageService from './index.js';
import * as unifiedEmotion from './unifiedEmotionService.js';
import logger from '../utils/logger.js';

const { normalizeEmotion } = unifiedEmotion;

const toWeeklyShape = (userId, summary) => ({
  id: summary.id,
  user_id: userId,
  week_start: summary.weekStart,
  week_end: summary.weekEnd,
  dominant_emotion: summary.dominantEmotion,
  avg_mood_score: summary.averageMoodScore,
  reflection_text: summary.weeklyReflection,
  daily_arc: summary.weeklyArc || [],
  key_highlights: summary.keyHighlights || [],
  emotion_summary: (summary.weeklyMomentFlow && summary.weeklyMomentFlow.emotion_summary) || {},
  created_at: summary.createdAt,
  updated_at: summary.updatedAt
});

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
    // Get journal entries (stored as DailyEmotionSummary rows)
    const summaries = await prisma.dailyEmotionSummary.findMany({
      where: {
        userId,
        ...(startDate || endDate
          ? { date: { ...(startDate ? { gte: startDate } : {}), ...(endDate ? { lte: endDate } : {}) } }
          : {})
      },
      orderBy: { date: 'desc' }
    });

    // If no journals, return empty array
    if (!summaries || summaries.length === 0) return [];

    const journals = summaries.map((summary) => journalGenerator._toJournalShape(userId, summary.date, {
      id: summary.id,
      date: summary.date,
      dominantEmotion: summary.dominantEmotion,
      emotionDistribution: summary.emotionDistribution ?? {},
      moodScore: summary.moodScore,
      totalEntries: summary.totalEntries,
      timeSegments: summary.timeSegments ?? [],
      segmentSummary: summary.segmentSummary ?? {},
      eJournalEntry: summary.eJournalEntry,
      createdAt: summary.createdAt,
      updatedAt: summary.updatedAt
    }));

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
    const rows = await prisma.weeklyEmotionSummary.findMany({
      where: { userId },
      orderBy: { weekStart: 'desc' },
      take: limit
    });

    return rows.map((row) => toWeeklyShape(userId, {
      id: row.id,
      weekStart: row.weekStart,
      weekEnd: row.weekEnd,
      dominantEmotion: row.dominantEmotion,
      averageMoodScore: row.averageMoodScore,
      weeklyReflection: row.weeklyReflection,
      weeklyArc: row.weeklyArc,
      keyHighlights: row.keyHighlights,
      weeklyMomentFlow: row.weeklyMomentFlow,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    }));
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
    const journal = await journalGenerator.getJournalEntry(userId, date);

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
          created_at: journal.generated_at
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
    const trackedDaysCount = await prisma.dailyEmotionSummary.count({ where: { userId } });

    // Get first message date
    const firstMessage = await prisma.message.findFirst({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true }
    });

    // Get emotion distribution from messages (canonical source)
    const messages = await prisma.message.findMany({
      where: { userId, role: 'user', NOT: { emotion: null } },
      select: { emotion: true }
    });

    // Count emotion occurrences
    const emotionCounts = (messages || []).reduce((acc, m) => {
      acc[m.emotion] = (acc[m.emotion] || 0) + 1;
      return acc;
    }, {});

    return {
      trackedDays: trackedDaysCount || 0,
      firstChatDate: firstMessage?.createdAt || null,
      totalEmotions: messages?.length || 0,
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
    const messages = await prisma.message.findMany({
      where: {
        userId,
        role: 'user',
        createdAt: {
          gte: new Date(`${startDate}T00:00:00Z`),
          lte: new Date(`${endDate}T23:59:59Z`)
        }
      },
      orderBy: { emotionConfidence: 'desc' },
      take: 30
    });

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
        confidence: msg.emotionConfidence,
        timestamp: msg.createdAt,
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
    const saved = await storageService.upsertDailyEmotionSummary({
      userId,
      date,
      dominantEmotion: data.emotion_summary?.dominant_emotion ?? data.dominant_emotion,
      emotionDistribution: data.emotion_summary?.emotion_counts ?? {},
      moodScore: data.emotion_summary?.mood_score ?? data.mood_score,
      totalEntries: data.emotion_summary?.total_messages ?? 0,
      timeSegments: data.emotion_summary?.time_segments ?? [],
      keyMoments: data.key_moments ?? data.insights ?? [],
      segmentSummary: {
        overview: data.overview,
        key_moments: data.key_moments,
        analysis: data.analysis,
        closing: data.closing,
        date_time: data.date_time,
        title: data.title,
        context: data.context,
        reflections: data.reflections,
        emotions_text: data.emotions_text,
        insights: data.insights,
        plans: data.plans,
        source: data.source
      },
      summaryText: data.content,
      eJournalEntry: data.content
    });

    return journalGenerator._toJournalShape(userId, date, saved);
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
    const weekEndDate = new Date(weekStart);
    weekEndDate.setDate(weekEndDate.getDate() + 6);
    const weekEnd = weekEndDate.toISOString().split('T')[0];

    const saved = await storageService.upsertWeeklyEmotionSummary({
      userId,
      weekStart,
      weekEnd,
      dominantEmotion: data.dominant_emotion,
      averageMoodScore: data.avg_mood_score,
      weeklyReflection: data.reflection_text,
      weeklyArc: data.daily_arc ?? [],
      keyHighlights: data.key_highlights ?? [],
      weeklyMomentFlow: { emotion_summary: data.emotion_summary ?? {} }
    });

    return toWeeklyShape(userId, saved);
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
