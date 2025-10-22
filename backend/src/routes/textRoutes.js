/**
 * Text Analysis Routes
 * Handles text-based emotion detection requests with multi-language support
 */

import express from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { analyzeTextEmotion } from '../text-service/index.js';
import { saveAnalysisResult } from '../storage-service/index.js';
import { 
  translateToEnglishIfNeeded, 
  getLanguageName 
} from '../utils/translationHelper.js';

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

  // Language detection and translation
  console.log(`🌐 Detecting language and translating if needed...`);
  const translationResult = await translateToEnglishIfNeeded(text);
  
  const {
    translatedText: englishText,
    sourceLang: detectedLanguage,
    needsTranslation,
    usedFallback: usedTranslationFallback,
    translationFailed
  } = translationResult;

  console.log(`✅ Language detection: ${detectedLanguage} (${getLanguageName(detectedLanguage)})`);
  
  if (needsTranslation) {
    console.log(`🔄 Text translated for processing: "${englishText}"`);
  }

  if (usedTranslationFallback) {
    console.log(`⚠️ Used Gemini fallback for translation`);
  }

  if (translationFailed) {
    console.log(`⚠️ Translation failed, proceeding with original text`);
  }

  // Analyze text emotion using English text
  const emotionResult = await analyzeTextEmotion(englishText);

  // Save to database (if userId provided)
  let recordId = null;
  if (userId) {
    recordId = await saveAnalysisResult({
      userId,
      type: 'text',
      input: text, // Save original text
      translatedInput: needsTranslation ? englishText : null,
      emotion: emotionResult.emotion,
      confidence: emotionResult.confidence,
      scores: emotionResult.scores,
      language: {
        detected: detectedLanguage,
        name: getLanguageName(detectedLanguage),
        wasTranslated: needsTranslation,
        translationMethod: usedTranslationFallback ? 'gemini_fallback' : 'google_translate',
        translationFailed: translationFailed
      },
      timestamp: new Date().toISOString()
    });
  }

  res.json({
    success: true,
    data: {
      emotion: emotionResult.emotion,
      confidence: emotionResult.confidence,
      scores: emotionResult.scores,
      language: {
        detected: detectedLanguage,
        name: getLanguageName(detectedLanguage),
        wasTranslated: needsTranslation,
        originalText: text,
        translatedText: needsTranslation ? englishText : null,
        translationMethod: usedTranslationFallback ? 'gemini_fallback' : 'google_translate',
        translationFailed: translationFailed
      },
      recordId: recordId
    }
  });
}));

export default router;
