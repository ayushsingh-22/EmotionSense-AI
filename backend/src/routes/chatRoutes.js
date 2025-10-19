/**
 * Chat Routes
 * Handles chat-specific requests combining emotion analysis and response generation
 */

import express from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { analyzeTextEmotion } from '../text-service/index.js';
import { generateResponse } from '../llm-service/index.js';
import { generateSpeech } from '../tts-service/index.js';
import { saveAnalysisResult } from '../storage-service/index.js';

const router = express.Router();

/**
 * POST /api/chat/message
 * Process chat message: analyze emotion + generate AI response
 * 
 * Request body:
 * {
 *   "message": "Today I feel sad 😔",
 *   "userId": "user123" (optional),
 *   "includeAudio": true (optional, default: false)
 * }
 */
router.post('/message', asyncHandler(async (req, res) => {
  const { message, userId, includeAudio = false } = req.body;

  // Validate input
  if (!message || typeof message !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Message is required and must be a string'
    });
  }

  if (message.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Message cannot be empty'
    });
  }

  console.log(`💬 Processing chat message for user: ${userId || 'anonymous'}`);
  console.log(`📝 Message: "${message}"`);

  try {
    // Step 1: Analyze emotion from the message
    console.log(`🔤 Step 1: Analyzing emotion...`);
    const emotionResult = await analyzeTextEmotion(message);
    
    console.log(`✅ Emotion detected: ${emotionResult.emotion} (confidence: ${emotionResult.confidence})`);

    // Step 2: Generate empathetic AI response based on emotion
    console.log(`🤖 Step 2: Generating AI response...`);
    const llmResponse = await generateResponse({
      emotion: emotionResult.emotion,
      confidence: emotionResult.confidence,
      context: {
        userMessage: message,
        processedText: emotionResult.processedText
      },
      transcript: message
    });

    console.log(`✅ AI response generated: "${llmResponse.text ? llmResponse.text.substring(0, 100) : 'No response'}..."`);

    // Step 3: Generate audio response if requested
    let audioResponse = null;
    if (includeAudio && llmResponse.text) {
      console.log(`🔊 Step 3: Generating audio response...`);
      try {
        audioResponse = await generateSpeech(llmResponse.text);
        console.log(`✅ Audio response generated`);
      } catch (audioError) {
        console.warn(`⚠️ Audio generation failed:`, audioError.message);
        // Continue without audio - don't fail the entire request
      }
    }

    // Step 4: Save to database (if userId provided)
    let recordId = null;
    if (userId) {
      console.log(`💾 Step 4: Saving to database...`);
      try {
        recordId = await saveAnalysisResult({
          userId,
          type: 'text',
          input: message,
          emotion: emotionResult.emotion,
          confidence: emotionResult.confidence,
          scores: emotionResult.scores,
          aiResponse: llmResponse.text,
          timestamp: new Date().toISOString()
        });
        console.log(`✅ Saved to database with ID: ${recordId}`);
      } catch (dbError) {
        console.warn(`⚠️ Database save failed:`, dbError.message);
        // Continue without saving - don't fail the entire request
      }
    }

    // Step 5: Return complete response
    const response = {
      success: true,
      data: {
        // User message analysis
        userMessage: {
          text: message,
          processedText: emotionResult.processedText,
          emotion: emotionResult.emotion,
          confidence: emotionResult.confidence,
          scores: emotionResult.scores
        },
        // AI response
        aiResponse: {
          text: llmResponse.text,
          audioUrl: audioResponse?.audioUrl || null,
          generationTime: llmResponse.generationTime,
          model: llmResponse.model
        },
        // Metadata
        recordId: recordId,
        timestamp: new Date().toISOString()
      }
    };

    console.log(`✅ Chat message processed successfully`);
    res.json(response);

  } catch (error) {
    console.error(`❌ Error processing chat message:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to process chat message',
      details: error.message
    });
  }
}));

export default router;