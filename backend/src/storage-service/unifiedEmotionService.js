/**
 * Unified Emotion Service
 * SINGLE SOURCE OF TRUTH for all emotion data across Chat, History, Insights, and Journal
 * 
 * This service consolidates emotion data from messages table and provides
 * unified calculations for all frontend sections to ensure consistency.
 */

import { createClient } from '@supabase/supabase-js';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import { getISTDateStart, getISTDateEnd, utcToISTDate } from '../utils/dateUtils.js';

const supabase = createClient(
  config.database.supabase.url,
  config.database.supabase.serviceRoleKey || config.database.supabase.anonKey
);

/**
 * Emotion scoring map (0-100 scale)
 * This is the CANONICAL emotion-to-score mapping used across all features
 */
export const EMOTION_SCORES = {
  // Negative emotions
  anger: 20,
  disgust: 18,
  fear: 25,
  sadness: 30,
  
  // Neutral
  neutral: 50,
  
  // Positive emotions
  surprise: 70,
  joy: 85
};

/**
 * Get emotion emoji mapping (CANONICAL - 7 emotions only)
 * anger 🤬, disgust 🤢, fear 😨, joy 😀, neutral 😐, sadness 😭, surprise 😲
 */
export const EMOTION_EMOJI = {
  anger: '🤬',
  disgust: '🤢',
  fear: '😨',
  joy: '😀',
  neutral: '😐',
  sadness: '😭',
  surprise: '😲'
};

/**
 * Standard 7 emotions list
 */
export const STANDARD_EMOTIONS = ['anger', 'disgust', 'fear', 'joy', 'neutral', 'sadness', 'surprise'];

/**
 * Normalize emotion labels to standard 7 emotions
 * Handles legacy/variant emotion names
 */
export function normalizeEmotion(emotion) {
  if (!emotion) return 'neutral';
  
  const normalized = emotion.toLowerCase().trim();
  
  // Direct mapping
  if (STANDARD_EMOTIONS.includes(normalized)) {
    return normalized;
  }
  
  // Legacy mappings
  const emotionMap = {
    'happy': 'joy',
    'happiness': 'joy',
    'excited': 'joy',
    'excited': 'joy',
    'joyful': 'joy',
    
    'sad': 'sadness',
    'depressed': 'sadness',
    'melancholy': 'sadness',
    
    'angry': 'anger',
    'frustrated': 'anger',
    'mad': 'anger',
    
    'anxious': 'fear',
    'worried': 'fear',
    'fearful': 'fear',
    'scared': 'fear',
    
    'surprised': 'surprise',
    'shocked': 'surprise',
    
    'disgusted': 'disgust',
    
    'calm': 'neutral',
    'relaxed': 'neutral',
    'peaceful': 'neutral'
  };
  
  return emotionMap[normalized] || 'neutral';
}

/**
 * Calculate mood score from emotion with confidence weighting
 * @param {string} emotion - Emotion label
 * @param {number} confidence - Confidence score (0-1 scale)
 * @returns {number} Mood score (0-100 scale)
 */
export function calculateMoodScore(emotion, confidence = 0.5) {
  if (!emotion) return 50;
  
  const normalizedEmotion = normalizeEmotion(emotion);
  const baseScore = EMOTION_SCORES[normalizedEmotion] || 50;
  
  // Confidence doesn't change score, just indicates reliability
  // Ensure result is within 0-100 range
  return Math.max(0, Math.min(100, Math.round(baseScore)));
}

/**
 * Calculate weighted average mood score from multiple emotions
 * @param {Array} emotions - Array of {emotion, confidence}
 * @returns {number} Average mood score (0-100 scale)
 */
export function calculateAverageMoodScore(emotions) {
  // Edge case: empty or invalid array
  if (!emotions || !Array.isArray(emotions) || emotions.length === 0) {
    return 50; // Neutral baseline
  }

  // Filter out invalid entries (null emotion, invalid confidence)
  const validEmotions = emotions.filter(e => {
    if (!e || !e.emotion) return false;
    const confidence = e.confidence || e.emotion_confidence;
    return confidence !== null && confidence !== undefined && !isNaN(confidence);
  });

  // Edge case: all entries were invalid
  if (validEmotions.length === 0) {
    return 50; // Neutral baseline
  }

  // Calculate weighted average
  let totalWeightedScore = 0;
  let totalWeight = 0;

  validEmotions.forEach(e => {
    const normalizedEmotion = normalizeEmotion(e.emotion);
    const score = EMOTION_SCORES[normalizedEmotion] || 50;
    const confidence = Math.max(0, Math.min(1, e.confidence || e.emotion_confidence || 0.5)); // Clamp 0-1
    const weight = confidence;
    
    totalWeightedScore += score * weight;
    totalWeight += weight;
  });

  // Edge case: total weight is zero (all confidences were 0)
  if (totalWeight === 0) {
    return 50; // Neutral baseline
  }

  const moodScore = Math.round(totalWeightedScore / totalWeight);
  
  // Ensure result is within 0-100 range
  return Math.max(0, Math.min(100, moodScore));
}

/**
 * Get dominant emotion from a list
 * @param {Array} emotions - Array of {emotion, confidence}
 * @returns {string} Dominant emotion
 */
export function getDominantEmotion(emotions) {
  // Edge case: empty or invalid array
  if (!emotions || !Array.isArray(emotions) || emotions.length === 0) {
    return 'neutral';
  }

  // Filter out invalid entries
  const validEmotions = emotions.filter(e => e && e.emotion);
  
  if (validEmotions.length === 0) {
    return 'neutral';
  }

  // Count weighted emotions
  const emotionWeights = {};
  
  validEmotions.forEach(e => {
    const normalizedEmotion = normalizeEmotion(e.emotion);
    const confidence = e.confidence || e.emotion_confidence || 0.5;
    const weight = Math.max(0, Math.min(1, confidence)); // Clamp 0-1
    
    emotionWeights[normalizedEmotion] = (emotionWeights[normalizedEmotion] || 0) + weight;
  });

  // Find emotion with highest weight
  const entries = Object.entries(emotionWeights);
  if (entries.length === 0) {
    return 'neutral';
  }

  return entries.reduce((a, b) => emotionWeights[a[0]] > emotionWeights[b[0]] ? a : b)[0];
}

/**
 * Get user messages with emotions for a date range
 * This is the PRIMARY data source for all emotion-related features
 * 
 * @param {string} userId - User ID
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @returns {Promise<Array>} Messages with emotion data
 */
export async function getMessagesWithEmotions(userId, startDate, endDate) {
  try {
    // Convert dates to IST timezone boundaries
    const startUTC = getISTDateStart(startDate);
    const endUTC = getISTDateEnd(endDate);
    
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('user_id', userId)
      .eq('role', 'user')
      .gte('created_at', startUTC)
      .lte('created_at', endUTC)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    logger.error('Error fetching messages with emotions:', error);
    return [];
  }
}

/**
 * Get daily emotion summary from messages
 * This consolidates all emotions for a single day
 * 
 * @param {string} userId - User ID
 * @param {string} date - Date (YYYY-MM-DD)
 * @returns {Promise<Object>} Daily emotion summary
 */
export async function getDailyEmotionSummary(userId, date) {
  try {
    const messages = await getMessagesWithEmotions(userId, date, date);

    if (messages.length === 0) {
      return {
        date,
        moodScore: 50,
        dominantEmotion: 'neutral',
        emotionEmoji: '😐',
        emotionCounts: {},
        messageCount: 0,
        messages: [],
        timeSegments: [],
        contextSummary: ''
      };
    }

    // Calculate emotion counts
    const emotionCounts = {};
    messages.forEach(m => {
      if (m.emotion) {
        emotionCounts[m.emotion] = (emotionCounts[m.emotion] || 0) + 1;
      }
    });

    // Get dominant emotion
    const dominantEmotion = getDominantEmotion(messages.map(m => ({
      emotion: m.emotion,
      confidence: m.emotion_confidence
    })));

    // Calculate average mood score
    const moodScore = calculateAverageMoodScore(messages.map(m => ({
      emotion: m.emotion,
      confidence: m.emotion_confidence
    })));

    // Analyze time segments
    const timeSegments = analyzeTimeSegments(messages);

    // Generate context summary
    const contextSummary = generateContextSummary(messages, dominantEmotion);

    return {
      date,
      moodScore,
      dominantEmotion,
      emotionEmoji: EMOTION_EMOJI[dominantEmotion] || '😐',
      emotionCounts,
      messageCount: messages.length,
      messages: messages.map(m => ({
        id: m.id,
        content: m.content,
        emotion: m.emotion,
        confidence: m.emotion_confidence,
        created_at: m.created_at
      })),
      timeSegments,
      contextSummary
    };
  } catch (error) {
    logger.error('Error getting daily emotion summary:', error);
    throw error;
  }
}

/**
 * Get multiple daily summaries (for monthly/weekly views)
 * @param {string} userId - User ID
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @returns {Promise<Array>} Array of daily summaries
 */
export async function getMultipleDailySummaries(userId, startDate, endDate) {
  try {
    // Get all messages in range
    const messages = await getMessagesWithEmotions(userId, startDate, endDate);

    if (messages.length === 0) return [];

    // Group by date in IST timezone
    const messagesByDate = {};
    messages.forEach(m => {
      const msgDate = utcToISTDate(m.created_at);
      if (!messagesByDate[msgDate]) {
        messagesByDate[msgDate] = [];
      }
      messagesByDate[msgDate].push(m);
    });

    // Generate summary for each date
    const summaries = [];
    for (const [date, dayMessages] of Object.entries(messagesByDate)) {
      const emotionCounts = {};
      dayMessages.forEach(m => {
        if (m.emotion) {
          emotionCounts[m.emotion] = (emotionCounts[m.emotion] || 0) + 1;
        }
      });

      const dominantEmotion = getDominantEmotion(dayMessages.map(m => ({
        emotion: m.emotion,
        confidence: m.emotion_confidence
      })));

      const moodScore = calculateAverageMoodScore(dayMessages.map(m => ({
        emotion: m.emotion,
        confidence: m.emotion_confidence
      })));

      summaries.push({
        date,
        moodScore,
        dominantEmotion,
        emotionEmoji: EMOTION_EMOJI[dominantEmotion] || '😐',
        emotionCounts,
        messageCount: dayMessages.length
      });
    }

    return summaries.sort((a, b) => new Date(a.date) - new Date(b.date));
  } catch (error) {
    logger.error('Error getting multiple daily summaries:', error);
    return [];
  }
}

/**
 * Analyze time segments (morning, afternoon, evening)
 * @private
 */
function analyzeTimeSegments(messages) {
  const segments = {
    morning: { period: 'morning', emotions: [], count: 0 },
    afternoon: { period: 'afternoon', emotions: [], count: 0 },
    evening: { period: 'evening', emotions: [], count: 0 }
  };

  messages.forEach(m => {
    if (!m.emotion) return;

    const hour = new Date(m.created_at).getHours();
    let period;

    if (hour >= 5 && hour < 12) {
      period = 'morning';
    } else if (hour >= 12 && hour < 17) {
      period = 'afternoon';
    } else {
      period = 'evening';
    }

    segments[period].emotions.push({
      emotion: m.emotion,
      confidence: m.emotion_confidence || 0.5
    });
    segments[period].count++;
  });

  // Find dominant emotion per segment (NORMALIZE LABELS)
  const result = [];
  Object.keys(segments).forEach(period => {
    if (segments[period].count > 0) {
      const dominant = getDominantEmotion(segments[period].emotions);
      result.push({
        period,
        emotion: normalizeEmotion(dominant),
        count: segments[period].count
      });
    }
  });

  return result;
}

/**
 * Generate context summary from messages
 * @private
 */
function generateContextSummary(messages, dominantEmotion) {
  if (messages.length === 0) return '';

  // Get a brief context from first few messages
  const firstMessage = messages[0]?.content || '';
  const snippet = firstMessage.length > 80 
    ? firstMessage.substring(0, 80) + '...' 
    : firstMessage;

  return snippet || `Experienced ${dominantEmotion} emotions`;
}

/**
 * Fuse journal emotion with message emotions
 * @param {Object} journalEntry - Journal entry with emotion
 * @param {Object} messageSummary - Daily message summary
 * @returns {Object} Fused emotion data
 */
export function fuseJournalAndMessageEmotions(journalEntry, messageSummary) {
  // If no journal or messages, return what we have
  if (!journalEntry && !messageSummary) {
    return {
      dominantEmotion: 'neutral',
      moodScore: 50,
      emotionEmoji: '😐'
    };
  }

  if (!journalEntry) return messageSummary;
  if (!messageSummary || messageSummary.messageCount === 0) {
    return {
      dominantEmotion: journalEntry.emotion || 'neutral',
      moodScore: EMOTION_SCORES[journalEntry.emotion] || 50,
      emotionEmoji: journalEntry.emotion_emoji || EMOTION_EMOJI[journalEntry.emotion] || '😐'
    };
  }

  // Fuse with 50/50 weighting
  const journalScore = EMOTION_SCORES[journalEntry.emotion] || 50;
  const messageScore = messageSummary.moodScore;
  const fusedScore = Math.round((journalScore + messageScore) / 2);

  // Use message dominant emotion if journal has none
  const fusedEmotion = journalEntry.emotion || messageSummary.dominantEmotion;

  return {
    dominantEmotion: fusedEmotion,
    moodScore: fusedScore,
    emotionEmoji: EMOTION_EMOJI[fusedEmotion] || '😐',
    sources: {
      journal: journalEntry.emotion || null,
      messages: messageSummary.dominantEmotion
    }
  };
}
