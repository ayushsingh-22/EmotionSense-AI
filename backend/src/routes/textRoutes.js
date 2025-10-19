/**
 * Text Analysis Routes
 * Handles text-based emotion detection requests
 */

import express from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { analyzeTextEmotion } from '../text-service/index.js';
import { saveAnalysisResult } from '../storage-service/index.js';

const router = express.Router();

/**
 * POST /api/analyze/text
 * Analyze emotion from text input
 * 
 * Request body:
 * {
 *   "text": "I'm feeling really happy today!",
 *   "userId": "user123" (optional)
 * }
 */
router.post('/', asyncHandler(async (req, res) => {
  const { text, userId } = req.body;

  // Validate input
  if (!text || typeof text !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Text is required and must be a string'
    });
  }

  if (text.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Text cannot be empty'
    });
  }

  console.log(`🔤 Processing text emotion analysis for user: ${userId || 'anonymous'}`);

  // Analyze text emotion
  const emotionResult = await analyzeTextEmotion(text);

  // Save to database (if userId provided)
  let recordId = null;
  if (userId) {
    recordId = await saveAnalysisResult({
      userId,
      type: 'text',
      input: text,
      emotion: emotionResult.emotion,
      confidence: emotionResult.confidence,
      scores: emotionResult.scores,
      timestamp: new Date().toISOString()
    });
  }

  res.json({
    success: true,
    data: {
      emotion: emotionResult.emotion,
      confidence: emotionResult.confidence,
      scores: emotionResult.scores,
      recordId: recordId
    }
  });
}));

export default router;
