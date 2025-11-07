/**
 * Text-to-Speech (TTS) Service Module
 * Converts text responses to audio using OpenAI TTS (primary) or Piper (fallback)
 * 
 * This module:
 * 1. Receives text response from LLM
 * 2. Tries OpenAI TTS API first (cloud, high-quality, neural)
 * 3. Falls back to Piper TTS if OpenAI fails (offline, fast, neural)
 * 4. Returns audio data (base64 or Buffer)
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { fileURLToPath } from 'url';
import config from '../config/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Convert language code to Google TTS format (Indian languages focus)
 */
const convertToGoogleTTSLanguageCode = (languageCode) => {
  // If already in full format (en-IN), return as-is
  if (languageCode && languageCode.includes('-')) {
    return languageCode;
  }
  
  // Map short codes to Indian locale codes (prioritize Indian English)
  const indianLanguageMap = {
    'en': 'en-IN',      // Indian English
    'hi': 'hi-IN',      // Hindi
    'bn': 'bn-IN',      // Bengali
    'ta': 'ta-IN',      // Tamil
    'te': 'te-IN',      // Telugu
    'mr': 'mr-IN',      // Marathi
    'gu': 'gu-IN',      // Gujarati
    'kn': 'kn-IN',      // Kannada
    'ml': 'ml-IN',      // Malayalam
    'or': 'or-IN',      // Odia
    'pa': 'pa-IN',      // Punjabi
    'mai': 'hi-IN'      // Maithili (use Hindi voice)
  };
  
  return indianLanguageMap[languageCode] || 'en-IN';
};

/**
 * Get best Google TTS voice for Indian languages
 */
const getGoogleVoiceForLanguage = (languageCode) => {
  const indianVoiceMap = {
    // Indian English - Neural voice
    'en-IN': 'en-IN-Neural2-C',
    'en-US': 'en-IN-Neural2-C',  // Redirect to Indian English
    
    // Hindi - Neural voice (best quality)
    'hi-IN': 'hi-IN-Neural2-D',
    
    // Bengali - Wavenet voice
    'bn-IN': 'bn-IN-Wavenet-A',
    
    // Tamil - Wavenet voice
    'ta-IN': 'ta-IN-Wavenet-A',
    
    // Telugu - Standard voice
    'te-IN': 'te-IN-Standard-A',
    
    // Marathi - Wavenet voice
    'mr-IN': 'mr-IN-Wavenet-A',
    
    // Gujarati - Wavenet voice
    'gu-IN': 'gu-IN-Wavenet-A',
    
    // Kannada - Wavenet voice
    'kn-IN': 'kn-IN-Wavenet-A',
    
    // Malayalam - Wavenet voice
    'ml-IN': 'ml-IN-Wavenet-A',
    
    // Odia - Wavenet voice (if available, else fallback)
    'or-IN': 'en-IN-Neural2-C',  // Fallback to Indian English
    
    // Punjabi - Wavenet voice
    'pa-IN': 'pa-IN-Wavenet-A'
  };
  
  return indianVoiceMap[languageCode] || 'en-IN-Neural2-C';
};

/**
 * Generate speech using Google Cloud TTS API
 * Supports Neural2 voices and high-quality output
 * Docs: https://cloud.google.com/text-to-speech/docs/reference/rest
 */
export const generateSpeechGoogle = async (text, languageCode = 'en-US', voice = null) => {
  // Convert short language codes to full locale codes for Google TTS
  const fullLanguageCode = convertToGoogleTTSLanguageCode(languageCode);
  const selectedVoice = voice || getGoogleVoiceForLanguage(fullLanguageCode);
  console.log(`🔊 Generating speech using Google TTS (language: ${fullLanguageCode}, voice: ${selectedVoice})...`);

  if (!config.tts.google.apiKey) {
    throw new Error('Google TTS API key not configured');
  }

  try {
    const response = await axios.post(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${config.tts.google.apiKey}`,
      {
        input: { text: text },
        voice: {
          languageCode: fullLanguageCode,
          name: selectedVoice,
          ssmlGender: 'NEUTRAL'
        },
        audioConfig: {
          audioEncoding: config.tts.google.audioEncoding, // MP3, LINEAR16, OGG_OPUS
          speakingRate: config.tts.google.speakingRate || 1.0,
          pitch: config.tts.google.pitch || 0.0
        }
      },
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000 // 30 seconds timeout
      }
    );

    // Google TTS returns base64 encoded audio in the response
    const audioContent = response.data.audioContent;
    const audioBuffer = Buffer.from(audioContent, 'base64');
    
    console.log(`✅ Google TTS synthesis complete (${audioBuffer.length} bytes)`);

    return {
      audio: audioContent, // Already base64 encoded
      format: config.tts.google.audioEncoding.toLowerCase(),
      duration: estimateDuration(text),
      provider: 'google',
      voice: selectedVoice,
      language: fullLanguageCode,
      sampleRate: 24000 // Google TTS typically uses 24kHz
    };
  } catch (error) {
    console.error('❌ Google TTS Error Details:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data
    });
    
    if (error.response) {
      throw new Error(`Google TTS API error: ${error.response.status} - ${error.response.statusText}`);
    } else if (error.request) {
      throw new Error('Google TTS API request failed - no response received');
    } else {
      throw new Error(`OpenAI TTS error: ${error.message}`);
    }
  }
};

/**
 * Check if Piper model and executable exists
 */
const checkPiperModel = () => {
  const modelPath = config.tts.piper.modelPath;
  const configPath = config.tts.piper.configPath;
  
  if (!fs.existsSync(modelPath)) {
    console.warn(`⚠️  Piper model not found at: ${modelPath}`);
    console.warn(`   Download models from: https://github.com/rhasspy/piper/releases`);
  }
  
  if (!fs.existsSync(configPath)) {
    console.warn(`⚠️  Piper config not found at: ${configPath}`);
  }
};

/**
 * Generate speech using Piper CLI
 * This uses the Piper command-line executable directly
 * Download from: https://github.com/rhasspy/piper/releases
 */
export const generateSpeechPiper = async (text) => {
  return new Promise((resolve, reject) => {
    console.log(`🔊 Generating speech using Piper TTS (offline)...`);

    // Check if model exists
    checkPiperModel();

    // Create temporary output file
    const outputPath = path.join(__dirname, '../../temp/audio', `tts-${Date.now()}.wav`);
    
    // Ensure temp directory exists
    const tempDir = path.dirname(outputPath);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Try to find piper executable
    // Look in: PATH, ./piper/, ./piper.exe (Windows)
    let piperCmd = 'piper';
    const localPiperWindows = path.join(process.cwd(), 'piper.exe');
    const localPiperUnix = path.join(process.cwd(), 'piper', 'piper');
    
    if (fs.existsSync(localPiperWindows)) {
      piperCmd = localPiperWindows;
    } else if (fs.existsSync(localPiperUnix)) {
      piperCmd = localPiperUnix;
    }

    // Spawn Piper process
    const speakerId = config.tts.piper.speakerId || 0;
    console.log('🔍 DEBUG - config.tts.piper:', JSON.stringify(config.tts.piper, null, 2));
    console.log('🔍 DEBUG - speakerId value:', speakerId, 'type:', typeof speakerId);
    const piper = spawn(piperCmd, [
      '--model', config.tts.piper.modelPath,
      '--config', config.tts.piper.configPath,
      '--output_file', outputPath,
      '--speaker', String(speakerId)
    ]);

    // Send text to stdin
    piper.stdin.write(text);
    piper.stdin.end();

    let stderr = '';

    piper.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    piper.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Piper CLI exited with code ${code}: ${stderr}\n\nMake sure Piper is installed. Download from: https://github.com/rhasspy/piper/releases`));
        return;
      }

      try {
        // Read generated audio file
        const audioBuffer = fs.readFileSync(outputPath);
        
        // Clean up temp file
        try {
          fs.unlinkSync(outputPath);
        } catch (e) {
          // Ignore cleanup errors
        }

        console.log(`✅ Piper TTS synthesis complete (${audioBuffer.length} bytes)`);

        resolve({
          audio: audioBuffer.toString('base64'),
          format: 'wav',
          duration: estimateDuration(text),
          provider: 'piper',
          sampleRate: 22050
        });
      } catch (err) {
        reject(err);
      }
    });

    piper.on('error', (err) => {
      reject(new Error(`Failed to spawn Piper: ${err.message}\n\nMake sure Piper is installed. Download from: https://github.com/rhasspy/piper/releases\nOr place piper.exe in the project root directory.`));
    });
  });
};

/**
 * Estimate audio duration based on text length
 * Rough estimation: ~150 words per minute average speaking rate
 */
const estimateDuration = (text) => {
  const words = text.split(/\s+/).length;
  const wordsPerMinute = 150;
  const durationMinutes = words / wordsPerMinute;
  const durationSeconds = durationMinutes * 60;
  return Math.round(durationSeconds * 10) / 10; // Round to 1 decimal place
};

/**
 * Main function: Generate speech from text
 * This is the primary export used by routes
 * Strategy: Try Google TTS first, fallback to Piper if it fails
 */
export const generateSpeech = async (text, voice = null, languageCode = null) => {
  console.log(`🎙️ Converting text to speech...`);

  if (!config.tts.enabled) {
    console.log('ℹ️  TTS is disabled in configuration');
    return null;
  }

  if (!text || text.trim().length === 0) {
    console.warn('⚠️  No text provided for TTS');
    return null;
  }

  try {
    // Check provider and use appropriate TTS
    if (config.tts.provider === 'google') {
      // Strategy 1: Try Google TTS first
      const hasValidGoogleKey = config.tts.google.apiKey && 
                                 config.tts.google.apiKey !== 'your_google_tts_api_key_here' &&
                                 config.tts.google.apiKey.length > 0;
      
      if (hasValidGoogleKey) {
        try {
          console.log(`🌐 Attempting Google TTS with multilingual support...`);
          const selectedVoice = voice || null; // Let auto-selection pick best voice
          const selectedLanguage = languageCode || config.tts.google.languageCode || 'en-US';
          console.log(`   Language: ${selectedLanguage}`);
          console.log(`   API Key present: ${config.tts.google.apiKey ? 'Yes (length: ' + config.tts.google.apiKey.length + ')' : 'No'}`);
          
          const speechResult = await generateSpeechGoogle(
            text, 
            selectedLanguage,
            selectedVoice
          );
          
          console.log(`✅ Speech generated successfully (${speechResult.duration}s, ${speechResult.provider})`);
          
          return {
            audioData: speechResult.audio,
            format: speechResult.format,
            duration: speechResult.duration,
            provider: speechResult.provider,
            voice: speechResult.voice,
            text: text
          };
        } catch (googleError) {
          console.error(`❌ Google TTS failed with error:`, googleError);
          console.error(`   Error message: ${googleError.message}`);
          console.error(`   Error stack:`, googleError.stack);
          console.log(`🔄 Falling back to Piper TTS...`);
          // Continue to fallback below
        }
      } else {
        console.log(`ℹ️  Google API key not configured, using Piper...`);
        console.log(`   API Key: ${config.tts.google.apiKey || 'undefined'}`);
      }
    }

    // Strategy 2: Use Piper TTS (offline, fast, reliable)
    // Note: Piper only supports English - non-English will be spoken with English voice
    if (languageCode && !languageCode.startsWith('en')) {
      console.log(`⚠️  Piper TTS only supports English. Non-English text (${languageCode}) will use English voice.`);
      console.log(`💡 Tip: Enable Google TTS for multi-language support.`);
    }
    console.log(`🔊 Generating speech using Piper TTS (offline)...`);
    const speechResult = await generateSpeechPiper(text);
    
    console.log(`✅ Speech generated successfully (${speechResult.duration}s, ${speechResult.provider})`);

    return {
      audioData: speechResult.audio,
      format: speechResult.format,
      duration: speechResult.duration,
      provider: speechResult.provider,
      language: languageCode || 'en-US',
      text: text
    };
  } catch (error) {
    console.error('❌ All TTS methods failed:', error.message);
    // Return null instead of throwing - TTS is optional
    return null;
  }
};

/**
 * Convert audio format if needed
 * TODO: Implement audio format conversion
 */
export const convertAudioFormat = async (audioData, fromFormat, toFormat) => {
  // TODO: Implement audio format conversion using ffmpeg or similar
  console.log(`🔄 Converting audio from ${fromFormat} to ${toFormat}...`);
  
  // Placeholder - return original data
  return audioData;
};
