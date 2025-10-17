/**
 * Text-to-Speech (TTS) Service Module
 * Converts text responses to audio using Piper (offline)
 * 
 * This module:
 * 1. Receives text response from LLM
 * 2. Converts to audio using Piper TTS CLI (offline, fast, neural)
 * 3. Returns audio data (base64 or Buffer)
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import config from '../config/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Check if Piper model and executable exists
 */
const checkPiperModel = () => {
  const modelPath = config.tts.piperModelPath;
  const configPath = config.tts.piperConfigPath;
  
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
    const piper = spawn(piperCmd, [
      '--model', config.tts.piperModelPath,
      '--config', config.tts.piperConfigPath,
      '--output_file', outputPath,
      '--speaker', config.tts.piperSpeakerId.toString()
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
 */
export const generateSpeech = async (text) => {
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
    // Use Piper TTS (offline)
    let speechResult;
    
    if (config.tts.provider === 'piper') {
      speechResult = await generateSpeechPiper(text);
    } else {
      console.warn(`⚠️  Unknown TTS provider: ${config.tts.provider}, defaulting to Piper`);
      speechResult = await generateSpeechPiper(text);
    }

    console.log(`✅ Speech generated successfully (${speechResult.duration}s, ${speechResult.provider})`);

    return {
      audioData: speechResult.audio,
      format: speechResult.format,
      duration: speechResult.duration,
      provider: speechResult.provider,
      text: text
    };
  } catch (error) {
    console.error('❌ Failed to generate speech:', error.message);
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
