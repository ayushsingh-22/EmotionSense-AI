/**
 * Emotion Utility Functions
 * Provides consistent emotion-to-mood-score mapping across the entire application
 * @param {boolean} useConfidenceModulation - Whether to adjust score based on confidence
 * @returns {number} Mood score (0-100)
 */
export function getEmotionMoodScore(emotion, confidence = 1.0, useConfidenceModulation = false) {
  if (!emotion || typeof emotion !== 'string') {
    return 50; // Default neutral
  }
  
  const baseScore = EMOTION_MOOD_SCORES[emotion.toLowerCase()] || 50;
  
  if (!useConfidenceModulation || confidence === undefined || confidence === null) {
    return baseScore;
  }
  
  // Modulate score based on confidence
  // High confidence: use full score
  // Low confidence: blend towards neutral (50)
  const confidenceWeight = Math.max(0, Math.min(1, confidence));
  const neutralBlend = 50;
  const modulated = Math.round(baseScore * confidenceWeight + neutralBlend * (1 - confidenceWeight));
  
  return Math.max(0, Math.min(100, modulated));
}

/**
 * Calculate mood score from emotion confidence (0-1 scale to 0-100 scale)
 * This is for when you want to use raw confidence as mood score
 * @param {number} confidence - Confidence value (0-1)
 * @returns {number} Mood score (0-100)
 */
export function confidenceToMoodScore(confidence) {
  if (confidence === undefined || confidence === null || isNaN(confidence)) {
    return 50;
  }
  
  return Math.max(0, Math.min(100, Math.round(confidence * 100)));
}

/**
 * Create emotion data object with consistent mood score
 * @param {string} emotion - Detected emotion
 * @param {number} confidence - Confidence (0-1)
 * @param {Object} scores - Detailed emotion scores
 * @param {Object} options - Additional options
 * @returns {Object} Standardized emotion data object
 */
export function createEmotionData(emotion, confidence, scores = {}, options = {}) {
  const {
    useConfidenceForMood = false, // Whether to use confidence directly or emotion mapping
    includeEmoji = true,
    additionalData = {}
  } = options;
  
  const moodScore = useConfidenceForMood 
    ? confidenceToMoodScore(confidence)
    : getEmotionMoodScore(emotion, confidence, false); // Use base emotion score without confidence modulation
    
  const emotionData = {
    emotion: emotion || 'neutral',
    confidence: confidence || 0.5,
    mood_score: moodScore,
    scores: scores || {},
    ...additionalData
  };
  
  if (includeEmoji) {
    emotionData.emoji = getEmotionEmoji(emotion);
  }
  
  return emotionData;
}