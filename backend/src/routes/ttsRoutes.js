/**
 * TTS (Text-to-Speech) Routes
 * Handles text-to-speech conversion requests
 */

import { validate } from '../middleware/security.js';
import { ttsBody } from '../middleware/schemas.js';
import express from 'express';
import { generateSpeech, generateSpeechSarvam } from '../tts-service/index.js';
import config from '../config/index.js';

const router = express.Router();

/**
 * POST /api/tts
 * Convert text to speech
 */
router.post('/', validate({ body: ttsBody }), async (req, res) => {
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
        requestId: req.id
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
 * POST /api/tts/generate
 * Generate speech from text (alternative endpoint)
 */
router.post('/generate', validate({ body: ttsBody }), async (req, res) => {
  try {
    const { text, language, voice } = req.body;

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

    console.log(`🔊 TTS generate request: language=${language || 'default'}, voice=${voice || 'default'}`);

    try {
      // Generate speech
      const speechResult = await generateSpeech(text, language);

      if (!speechResult || !speechResult.audioData) {
        throw new Error('TTS service returned no audio data');
      }

      // Convert base64 to buffer
      const audioBuffer = Buffer.from(speechResult.audioData, 'base64');

      // Return as base64 data URL for web playback
      const audioUrl = `data:audio/wav;base64,${speechResult.audioData}`;

      res.json({
        success: true,
        audioUrl: audioUrl,
        audioData: speechResult.audioData,
        format: 'wav',
        size: audioBuffer.length
      });

      console.log(`✅ TTS audio generated successfully (${audioBuffer.length} bytes)`);

    } catch (ttsError) {
      console.warn(`⚠️ TTS generation failed: ${ttsError.message}`);
      
      // Return a helpful error response
      return res.status(503).json({
        success: false,
        error: 'TTS service temporarily unavailable',
        requestId: req.id
      });
    }

  } catch (error) {
    console.error('❌ TTS Generate Route Error:', error.message);
    
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

/**
 * POST /api/tts/sarvam
 * Generate speech using Sarvam AI directly (bypass Google TTS)
 * Useful for testing or when you specifically want Sarvam's voice
 */
router.post('/sarvam', validate({ body: ttsBody }), async (req, res) => {
  try {
    const { text, language_code } = req.body;

    // Validate request
    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Text parameter is required and must be a string'
      });
    }

    const langCode = language_code || 'en-IN';
    console.log(`🔊 Sarvam AI TTS request: language=${langCode}`);

    try {
      // Generate speech using Sarvam AI
      const speechResult = await generateSpeechSarvam(text, langCode);

      if (!speechResult || !speechResult.audio) {
        throw new Error('Sarvam AI TTS returned no audio data');
      }

      // Convert base64 to buffer
      const audioBuffer = Buffer.from(speechResult.audio, 'base64');

      // Return JSON with audio URL
      res.json({
        success: true,
        audioUrl: `data:audio/${speechResult.format};base64,${speechResult.audio}`,
        audioData: speechResult.audio,
        format: speechResult.format,
        size: audioBuffer.length,
        duration: speechResult.duration,
        provider: 'sarvam',
        language: speechResult.language
      });

      console.log(`✅ Sarvam AI TTS completed (${audioBuffer.length} bytes)`);

    } catch (sarvamError) {
      console.error(`❌ Sarvam AI TTS failed: ${sarvamError.message}`);
      
      return res.status(503).json({
        success: false,
        error: 'Text-to-speech service is temporarily unavailable',
        requestId: req.id
      });
    }

  } catch (error) {
    console.error('❌ Sarvam TTS Route Error:', error.message);
    
    res.status(500).json({
      success: false,
      error: 'Sarvam AI TTS failed',
      details: config.development ? error.message : 'Internal server error'
    });
  }
});

export default router;