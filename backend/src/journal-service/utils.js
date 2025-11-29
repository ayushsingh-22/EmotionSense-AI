/**
 * Journal Utility Functions
 * Analyzes emotion patterns and prepares data for journal generation
 */

import logger from '../utils/logger.js';

/**
 * Analyze emotion patterns from raw emotion data
 * @param {Array} emotions - Raw emotion records
 * @param {Array} messages - Chat message records
 * @returns {Object} Analyzed patterns
 */
export function analyzeEmotionPatterns(emotions, messages) {
  // Initialize result object
  const analysis = {
    dominantEmotion: null,
    emotionCounts: {},
    averageMoodScore: 50,
    timeSegments: [],
    trends: {
      morningToEvening: null,
      emotionalSpikes: [],
      improvements: []
    }
  };

  if (!emotions || emotions.length === 0) {
    return analysis;
  }

  // Count emotions
  emotions.forEach(e => {
    const emotion = e.emotion || 'neutral';
    analysis.emotionCounts[emotion] = (analysis.emotionCounts[emotion] || 0) + 1;
  });

  // Find dominant emotion
  analysis.dominantEmotion = Object.keys(analysis.emotionCounts).reduce((a, b) =>
    analysis.emotionCounts[a] > analysis.emotionCounts[b] ? a : b
  );

  // Calculate mood score (0-100 scale based on emotion positivity)
  const emotionScores = {
    anger: 10,
    disgust: 15,
    fear: 25,
    sadness: 30,
    neutral: 50,
    surprise: 70,
    joy: 100,
    happy: 100,
    excited: 85,
    love: 95,
    calm: 75,
    anxious: 30,
    frustrated: 20
  };

  const totalScore = emotions.reduce((sum, e) => {
    const score = emotionScores[e.emotion] || 50;
    const weight = e.confidence || 0.5;
    return sum + (score * weight);
  }, 0);

  const totalWeight = emotions.reduce((sum, e) => sum + (e.confidence || 0.5), 0);
  analysis.averageMoodScore = Math.round(totalScore / totalWeight); // Integer 0-100

  // Analyze time segments (morning, afternoon, evening)
  analysis.timeSegments = analyzeTimeSegments(emotions);

  // Detect trends
  analysis.trends = detectEmotionalTrends(emotions, analysis.timeSegments);

  return analysis;
}

/**
 * Analyze emotions by time of day
 * @private
 */
function analyzeTimeSegments(emotions) {
  const segments = {
    morning: { period: 'morning', emotions: [], count: 0 },
    afternoon: { period: 'afternoon', emotions: [], count: 0 },
    evening: { period: 'evening', emotions: [], count: 0 }
  };

  emotions.forEach(e => {
    const hour = new Date(e.created_at).getHours();
    let period;

    if (hour >= 5 && hour < 12) {
      period = 'morning';
    } else if (hour >= 12 && hour < 17) {
      period = 'afternoon';
    } else {
      period = 'evening';
    }

    segments[period].emotions.push(e.emotion);
    segments[period].count++;
  });

  // Find dominant emotion per segment
  Object.keys(segments).forEach(period => {
    if (segments[period].count > 0) {
      const emotionCounts = segments[period].emotions.reduce((acc, e) => {
        acc[e] = (acc[e] || 0) + 1;
        return acc;
      }, {});

      segments[period].emotion = Object.keys(emotionCounts).reduce((a, b) =>
        emotionCounts[a] > emotionCounts[b] ? a : b
      );
    }
  });

  return Object.values(segments).filter(s => s.count > 0);
}

/**
 * Detect emotional trends throughout the day
 * @private
 */
function detectEmotionalTrends(emotions, timeSegments) {
  const trends = {
    morningToEvening: null,
    emotionalSpikes: [],
    improvements: []
  };

  // Analyze mood progression
  if (timeSegments.length >= 2) {
    const morning = timeSegments.find(s => s.period === 'morning');
    const evening = timeSegments.find(s => s.period === 'evening');

    if (morning && evening) {
      const positiveEmotions = ['happy', 'joy', 'excited', 'love', 'calm'];
      const morningPositive = positiveEmotions.includes(morning.emotion);
      const eveningPositive = positiveEmotions.includes(evening.emotion);

      if (!morningPositive && eveningPositive) {
        trends.morningToEvening = 'improved';
        trends.improvements.push('Your mood improved as the day progressed');
      } else if (morningPositive && !eveningPositive) {
        trends.morningToEvening = 'declined';
      } else if (morningPositive && eveningPositive) {
        trends.morningToEvening = 'stable-positive';
        trends.improvements.push('You maintained a positive mood throughout the day');
      }
    }
  }

  // Detect emotional spikes (high confidence emotions)
  const highConfidenceEmotions = emotions.filter(e => e.confidence > 0.8);
  if (highConfidenceEmotions.length > 0) {
    trends.emotionalSpikes = highConfidenceEmotions.map(e => ({
      emotion: e.emotion,
      time: new Date(e.created_at).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      })
    }));
  }

  return trends;
}

/**
 * Prepare structured data for LLM journal generation
 * @param {Object} analysis - Emotion pattern analysis
 * @param {Array} messages - User messages for context
 * @param {string} date - Date for the journal (YYYY-MM-DD)
 * @returns {Object} Structured data for LLM
 */
export function prepareJournalData(analysis, messages, date = null) {
  // Extract key topics from messages (simple keyword extraction)
  const topics = extractTopics(messages);

  // Get sample messages for context
  const sampleMessages = messages
    .slice(0, 5)
    .map(m => m.content || m.message)
    .filter(Boolean);

  // Format date for journal
  const journalDate = date ? new Date(date) : new Date();
  const formattedDate = journalDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  return {
    date: formattedDate,
    emotionSummary: {
      dominant: analysis.dominantEmotion,
      counts: analysis.emotionCounts,
      moodScore: analysis.averageMoodScore
    },
    timeProgression: {
      segments: analysis.timeSegments,
      trend: analysis.trends.morningToEvening
    },
    keyMoments: {
      spikes: analysis.trends.emotionalSpikes,
      improvements: analysis.trends.improvements
    },
    topics: topics,
    conversationSamples: sampleMessages,
    messageCount: messages.length
  };
}

/**
 * Extract key topics from messages (simple heuristics)
 * @private
 */
function extractTopics(messages) {
  const topics = [];
  const topicKeywords = {
    work: ['work', 'job', 'office', 'boss', 'meeting', 'project', 'deadline'],
    relationships: ['family', 'friend', 'relationship', 'partner', 'love', 'marriage'],
    health: ['health', 'sick', 'doctor', 'pain', 'sleep', 'tired', 'energy'],
    finance: ['money', 'financial', 'salary', 'expense', 'budget', 'debt'],
    education: ['study', 'exam', 'school', 'college', 'learn', 'course'],
    personal: ['myself', 'feel', 'think', 'want', 'need', 'hope']
  };

  const allText = messages
    .map(m => (m.content || m.message || '').toLowerCase())
    .join(' ');

  Object.keys(topicKeywords).forEach(topic => {
    const matches = topicKeywords[topic].filter(keyword =>
      allText.includes(keyword)
    );

    if (matches.length > 0) {
      topics.push({
        name: topic,
        relevance: matches.length
      });
    }
  });

  // Sort by relevance
  return topics.sort((a, b) => b.relevance - a.relevance);
}

/**
 * Calculate emotion diversity (variety of emotions experienced)
 * @param {Object} emotionCounts - Emotion frequency map
 * @returns {number} Diversity score (0-1)
 */
export function calculateEmotionDiversity(emotionCounts) {
  const uniqueEmotions = Object.keys(emotionCounts).length;
  const totalEmotions = Object.values(emotionCounts).reduce((a, b) => a + b, 0);

  if (totalEmotions === 0) return 0;

  // Shannon diversity index (simplified)
  const diversity = uniqueEmotions / Math.max(1, totalEmotions);
  return Math.min(1, diversity * 5); // Normalize to 0-1 scale
}
