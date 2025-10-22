/**
 * Multi-Modal Analysis Routes
 * Handles combined text and voice emotion detection with multi-language support
 */

import express from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { upload, cleanupFile } from '../middleware/uploadMiddleware.js';
import { analyzeTextEmotion } from '../text-service/index.js';
import { analyzeVoiceEmotion } from '../voice-service/index.js';
import { fuseEmotions } from '../multi-modal-layer/index.js';
import { saveAnalysisResult } from '../storage-service/index.js';
import { 
  translateToEnglishIfNeeded, 
  getLanguageName 
} from '../utils/translationHelper.js';

const router = express.Router();

/**
 * POST /api/analyze/multimodal
 * Analyze emotion from both text and voice
 * 
 * Request: multipart/form-data
 * - audio: audio file (wav, mp3, ogg, webm)
 * - text: text input (optional, will use transcript if not provided)
 * - userId: user identifier (optional)
 */
router.post('/', upload.single('audio'), asyncHandler(async (req, res) => {
  const { text, userId } = req.body;
  const audioFile = req.file;

  // Validate input
  if (!audioFile) {
    return res.status(400).json({
      success: false,
      error: 'Audio file is required for multi-modal analysis'
    });
  }

  console.log(`🎭 Processing multi-modal emotion analysis for user: ${userId || 'anonymous'}`);

  try {
    // Analyze voice emotion (includes transcription)
    const voiceResult = await analyzeVoiceEmotion(audioFile.path);

    // Use provided text or transcript from voice
    const textToAnalyze = text || voiceResult.transcript;

    // Language detection and translation for text analysis
    let translationResult = null;
    let englishText = textToAnalyze;
    
    if (textToAnalyze && textToAnalyze.trim().length > 0) {
      console.log(`🌐 Detecting language and translating if needed...`);
      translationResult = await translateToEnglishIfNeeded(textToAnalyze);
      englishText = translationResult.translatedText;
      
      console.log(`✅ Language detection: ${translationResult.sourceLang} (${getLanguageName(translationResult.sourceLang)})`);
      if (translationResult.needsTranslation) {
        console.log(`🔄 Text translated for processing: "${englishText}"`);
      }
    }

    // Analyze text emotion using English text
    let textResult = null;
    if (englishText && englishText.trim().length > 0) {
      textResult = await analyzeTextEmotion(englishText);
    }

    // Fuse emotions from both modalities
    const fusedResult = fuseEmotions(textResult, voiceResult);

    // Save to database (if userId provided)
    let recordId = null;
    if (userId) {
      recordId = await saveAnalysisResult({
        userId,
        type: 'multimodal',
        input: {
          audioFile: audioFile.filename,
          text: textToAnalyze,
          originalText: textToAnalyze,
          translatedText: translationResult?.needsTranslation ? englishText : null
        },
        transcript: voiceResult.transcript,
        textEmotion: textResult,
        voiceEmotion: voiceResult,
        fusedEmotion: fusedResult,
        language: translationResult ? {
          detected: translationResult.sourceLang,
          name: getLanguageName(translationResult.sourceLang),
          wasTranslated: translationResult.needsTranslation
        } : null,
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      data: {
        transcript: voiceResult.transcript,
        textEmotion: textResult,
        voiceEmotion: {
          emotion: voiceResult.emotion,
          confidence: voiceResult.confidence,
          scores: voiceResult.scores,
          audioFeatures: voiceResult.audioFeatures
        },
        fusedEmotion: fusedResult,
        language: translationResult ? {
          detected: translationResult.sourceLang,
          name: getLanguageName(translationResult.sourceLang),
          wasTranslated: translationResult.needsTranslation,
          originalText: textToAnalyze,
          translatedText: translationResult.needsTranslation ? englishText : null
        } : null,
        recordId: recordId
      }
    });
  } finally {
    // Clean up temporary audio file
    cleanupFile(audioFile.path);
  }
}));

export default router;
