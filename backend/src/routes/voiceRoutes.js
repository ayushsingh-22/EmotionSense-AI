/**
 * Voice Analysis Routes
 * Handles voice-based emotion detection requests
 */

import express from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { upload, cleanupFile } from '../middleware/uploadMiddleware.js';
import { analyzeVoiceEmotion } from '../voice-service/index.js';
import { saveAnalysisResult } from '../storage-service/index.js';

const router = express.Router();

/**
 * POST /api/analyze/voice
 * Analyze emotion from audio file
 * 
 * Request: multipart/form-data
 * - audio: audio file (wav, mp3, ogg, webm)
 * - userId: user identifier (optional)
 */
router.post('/', upload.single('audio'), asyncHandler(async (req, res) => {
  const { userId } = req.body;
  const audioFile = req.file;

  // Validate input
  if (!audioFile) {
    return res.status(400).json({
      success: false,
      error: 'Audio file is required'
    });
  }

  console.log(`🎤 Processing voice emotion analysis for user: ${userId || 'anonymous'}`);
  console.log(`📁 Audio file: ${audioFile.filename} (${audioFile.size} bytes)`);

  try {
    // Analyze voice emotion
    const emotionResult = await analyzeVoiceEmotion(audioFile.path);

    // Save to database (if userId provided)
    let recordId = null;
    if (userId) {
      recordId = await saveAnalysisResult({
        userId,
        type: 'voice',
        input: audioFile.filename,
        transcript: emotionResult.transcript,
        emotion: emotionResult.emotion,
        confidence: emotionResult.confidence,
        scores: emotionResult.scores,
        audioFeatures: emotionResult.audioFeatures,
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      data: {
        transcript: emotionResult.transcript,
        emotion: emotionResult.emotion,
        confidence: emotionResult.confidence,
        scores: emotionResult.scores,
        audioFeatures: emotionResult.audioFeatures,
        recordId: recordId
      }
    });
  } finally {
    // Clean up temporary audio file
    cleanupFile(audioFile.path);
  }
}));

export default router;
