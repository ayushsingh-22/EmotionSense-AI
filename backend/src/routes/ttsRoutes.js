/**
 * TTS (Text-to-Speech) Routes
 * Handles text-to-speech conversion requests
 */

import express from 'express';
import { generateSpeech } from '../tts-service/index.js';
import config from '../config/index.js';

const router = express.Router();

/**
 * POST /api/tts
 * Convert text to speech
 */
router.post('/', async (req, res) => {
  try {
    const { text } = req.body;

    // Validate request
    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Text parameter is required and must be a string'
      });
    }

    // Check if TTS is enabled
    if (!config.tts.enabled) {
      return res.status(503).json({
        success: false,
        error: 'TTS service is disabled'
      });
    }

    console.log(`🔊 TTS request received for text: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);

    try {
      // Generate speech
      const speechResult = await generateSpeech(text);

      if (!speechResult || !speechResult.audioData) {
        throw new Error('TTS service returned no audio data');
      }

      // Convert base64 to buffer for binary response
      const audioBuffer = Buffer.from(speechResult.audioData, 'base64');

      // Set proper headers for audio response
      res.set({
        'Content-Type': 'audio/wav',
        'Content-Length': audioBuffer.length,
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*'
      });

      // Send audio buffer
      res.send(audioBuffer);
      console.log(`✅ TTS audio generated successfully (${audioBuffer.length} bytes)`);

    } catch (ttsError) {
      console.warn(`⚠️ TTS generation failed: ${ttsError.message}`);
      
      // Return a helpful error response instead of crashing
      return res.status(503).json({
        success: false,
        error: 'TTS service temporarily unavailable',
        details: 'Piper TTS engine not installed or configured. Audio generation is currently disabled.',
        suggestion: 'Download Piper from https://github.com/rhasspy/piper/releases'
      });
    }

  } catch (error) {
    console.error('❌ TTS Route Error:', error.message);
    
    // Return JSON error response
    res.status(500).json({
      success: false,
      error: 'TTS generation failed',
      details: config.development ? error.message : 'Internal server error'
    });
  }
});

/**
 * GET /api/tts/health
 * Check TTS service health
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      enabled: config.tts.enabled,
      service: config.tts.service,
      model: config.tts.piperModelPath ? 'Available' : 'Not found',
      status: 'OK'
    }
  });
});

export default router;