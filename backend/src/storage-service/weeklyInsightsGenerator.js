/**
 * Weekly Insights Generator Service
 * Automatically generates weekly emotion summaries from journal entries
 * UPDATED: Uses unified emotion service for consistency
 */

import { createClient } from '@supabase/supabase-js';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import * as unifiedEmotion from './unifiedEmotionService.js';

const supabase = createClient(
  config.database.supabase.url,
  config.database.supabase.serviceRoleKey || config.database.supabase.anonKey
);

/**
 * Reflection templates based on dominant emotion (STRICT 7 EMOTIONS)
 */
const REFLECTION_TEMPLATES = {
  joy: 'This week was filled with positive moments and happiness. You experienced many joyful interactions and maintained an uplifting mood throughout the week.',
  neutral: 'This week brought a balanced emotional state. You navigated daily life with stability and maintained an even keel through various situations.',
  surprise: 'This week was full of unexpected moments and new discoveries. You adapted well to changes and embraced the unknown.',
  sadness: 'This week presented some challenges that affected your mood. Remember that it\'s okay to feel this way, and brighter days are ahead.',
  anger: 'This week had moments of frustration and intensity. Consider reflecting on what triggered these feelings and how to address underlying concerns.',
  fear: 'This week brought some anxious moments. Remember to practice self-care and reach out for support when needed.',
  disgust: 'This week had situations that challenged your comfort zone. It\'s important to acknowledge these feelings and set healthy boundaries.'
};


/**
 * Generate weekly insights for a specific user and week
 * UPDATED: Uses unified emotion service for consistent mood scores
 * @param {string} userId - User ID
 * @param {string} weekStart - Week start date (YYYY-MM-DD, should be Monday)
 * @returns {Promise<Object>} Generated weekly insight
 */
export async function generateWeeklyInsight(userId, weekStart) {
  try {
    logger.info(`Generating weekly insight for user ${userId}, week starting ${weekStart}`);

    // Calculate week end (6 days after start)
    const weekStartDate = new Date(weekStart);
    const weekEndDate = new Date(weekStart);
    weekEndDate.setDate(weekEndDate.getDate() + 6);
    const weekEnd = weekEndDate.toISOString().split('T')[0];

    // Get multiple daily summaries using unified emotion service
    const dailySummaries = await unifiedEmotion.getMultipleDailySummaries(userId, weekStart, weekEnd);

    if (!dailySummaries || dailySummaries.length === 0) {
      logger.warn(`No emotion data found for week ${weekStart}`);
      return null;
    }

    // Calculate emotion distribution
    const emotionCounts = {};
    dailySummaries.forEach(day => {
      const emotion = day.dominantEmotion;
      emotionCounts[emotion] = (emotionCounts[emotion] || 0) + 1;
    });

    // Find dominant emotion
    const dominantEmotion = Object.entries(emotionCounts).reduce((a, b) => 
      b[1] > a[1] ? b : a
    )[0];

    // Calculate average mood score (already 0-100 from unified service)
    const avgMoodScore = Math.round(
      dailySummaries.reduce((sum, day) => sum + day.moodScore, 0) / dailySummaries.length
    );

    // Build daily arc (emotion journey through the week)
    const dailyArc = dailySummaries.map(day => ({
      date: day.date,
      emotion: day.dominantEmotion,
      mood_score: day.moodScore
    })).sort((a, b) => a.date.localeCompare(b.date));

    // Generate key highlights
    const keyHighlights = generateKeyHighlights(dailySummaries, dominantEmotion);

    // Get reflection text
    const reflectionText = REFLECTION_TEMPLATES[dominantEmotion] || 
      'This week brought a variety of emotional experiences as you navigated daily life.';

    // Upsert weekly insight
    const { data: insight, error: upsertError } = await supabase
      .from('weekly_insights')
      .upsert({
        user_id: userId,
        week_start: weekStart,
        week_end: weekEnd,
        dominant_emotion: dominantEmotion,
        avg_mood_score: avgMoodScore, // Already 0-100 from unified service
        reflection_text: reflectionText,
        emotion_summary: emotionCounts,
        daily_arc: dailyArc,
        key_highlights: keyHighlights,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,week_start'
      })
      .select()
      .single();

    if (upsertError) throw upsertError;

    logger.info(`✅ Generated weekly insight for user ${userId}, week ${weekStart}`);
    return insight;

  } catch (error) {
    logger.error('Error generating weekly insight:', error);
    throw error;
  }
}

/**
 * Generate key highlights from daily summaries
 * UPDATED: Works with dailySummaries from unified emotion service
 * @param {Array} dailySummaries - Daily emotion summaries for the week
 * @param {string} dominantEmotion - Dominant emotion for the week
 * @returns {Array} Key highlights
 */
function generateKeyHighlights(dailySummaries, dominantEmotion) {
  const highlights = [];

  if (!dailySummaries || dailySummaries.length === 0) {
    return highlights;
  }

  // Find peak day (highest mood score)
  const peakDay = dailySummaries.reduce((max, day) => 
    day.moodScore > max.moodScore ? day : max
  );
  
  highlights.push({
    date: peakDay.date,
    type: 'peak',
    description: `Your best day - feeling ${peakDay.dominantEmotion}`,
    emotion: peakDay.dominantEmotion
  });

  // Find low day (lowest mood score) if significantly different
  const lowDay = dailySummaries.reduce((min, day) => 
    day.moodScore < min.moodScore ? day : min
  );

  if (peakDay.date !== lowDay.date && (peakDay.moodScore - lowDay.moodScore) > 20) {
    highlights.push({
      date: lowDay.date,
      type: 'low',
      description: `A challenging day - but you made it through`,
      emotion: lowDay.dominantEmotion
    });
  }

  // Add emotion variety insight if applicable
  const uniqueEmotions = [...new Set(dailySummaries.map(d => d.dominantEmotion))];
  if (uniqueEmotions.length >= 4) {
    const midWeekDay = dailySummaries[Math.floor(dailySummaries.length / 2)];
    highlights.push({
      date: midWeekDay.date,
      type: 'insight',
      description: `Experienced ${uniqueEmotions.length} different emotions - showing emotional flexibility`,
      emotion: 'neutral'
    });
  }

  return highlights;
}

/**
 * Generate weekly insights for all users for the current week
 * @returns {Promise<Array>} Generated insights
 */
export async function generateCurrentWeekInsights() {
  try {
    // Get current week's Monday
    const today = new Date();
    const dayOfWeek = today.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Handle Sunday
    const monday = new Date(today);
    monday.setDate(today.getDate() + mondayOffset);
    const weekStart = monday.toISOString().split('T')[0];

    // Get all users who have journal entries this week
    const { data: users, error } = await supabase
      .from('journal_entries')
      .select('user_id')
      .gte('date', weekStart)
      .neq('user_id', null);

    if (error) throw error;

    const uniqueUsers = [...new Set(users.map(u => u.user_id))];
    logger.info(`Generating weekly insights for ${uniqueUsers.length} users`);

    const results = [];
    for (const userId of uniqueUsers) {
      try {
        const insight = await generateWeeklyInsight(userId, weekStart);
        if (insight) {
          results.push(insight);
        }
      } catch (err) {
        logger.error(`Failed to generate insight for user ${userId}:`, err);
      }
    }

    return results;

  } catch (error) {
    logger.error('Error generating current week insights:', error);
    throw error;
  }
}

/**
 * Backfill weekly insights for all past weeks
 * @param {string} userId - User ID (optional, if not provided will backfill for all users)
 * @returns {Promise<number>} Number of insights generated
 */
export async function backfillWeeklyInsights(userId = null) {
  try {
    logger.info('Starting weekly insights backfill...');

    // Get all users if userId not specified
    let userIds = [];
    if (userId) {
      userIds = [userId];
    } else {
      const { data: users } = await supabase
        .from('journal_entries')
        .select('user_id')
        .neq('user_id', null);
      userIds = [...new Set(users.map(u => u.user_id))];
    }

    let totalGenerated = 0;

    for (const uid of userIds) {
      // Get all unique weeks for this user
      const { data: journals } = await supabase
        .from('journal_entries')
        .select('date')
        .eq('user_id', uid)
        .order('date', { ascending: true });

      if (!journals || journals.length === 0) continue;

      // Group by week
      const weeks = new Set();
      journals.forEach(j => {
        const date = new Date(j.date);
        const dayOfWeek = date.getDay();
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const monday = new Date(date);
        monday.setDate(date.getDate() + mondayOffset);
        weeks.add(monday.toISOString().split('T')[0]);
      });

      logger.info(`Generating ${weeks.size} weekly insights for user ${uid}`);

      for (const weekStart of weeks) {
        try {
          await generateWeeklyInsight(uid, weekStart);
          totalGenerated++;
        } catch (err) {
          logger.error(`Failed to generate insight for ${uid} week ${weekStart}:`, err);
        }
      }
    }

    logger.info(`✅ Backfill complete: ${totalGenerated} weekly insights generated`);
    return totalGenerated;

  } catch (error) {
    logger.error('Error during backfill:', error);
    throw error;
  }
}
