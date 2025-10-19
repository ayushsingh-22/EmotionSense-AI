/**
 * Configuration Module
 * Centralizes all environment variables and configuration settings
 */

import dotenv from 'dotenv';

dotenv.config();

const config = {
  // Server Configuration
  server: {
    port: process.env.PORT || 8080,
    nodeEnv: process.env.NODE_ENV || 'development',
    corsOrigin: process.env.CORS_ORIGIN || '*'
  },

  // Gemini API Configuration (Primary LLM)
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    models: [
      'gemini-2.0-flash-exp',
      'gemini-2.0-flash',
      'gemini-1.5-flash',
      'gemini-1.5-pro'
    ],
    maxTokens: parseInt(process.env.GEMINI_MAX_TOKENS) || 1024,
    temperature: parseFloat(process.env.GEMINI_TEMPERATURE) || 0.7,
    topK: parseInt(process.env.GEMINI_TOP_K) || 40,
    topP: parseFloat(process.env.GEMINI_TOP_P) || 0.95
  },

  // LLaMA Configuration (Fallback LLM via Groq)
  llama: {
    provider: process.env.LLAMA_PROVIDER || 'groq',
    model: process.env.LLAMA_MODEL || 'llama-3.3-70b-versatile',
    enabled: process.env.LLAMA_ENABLED === 'true',
    maxTokens: parseInt(process.env.LLAMA_MAX_TOKENS) || 1024,
    temperature: parseFloat(process.env.LLAMA_TEMPERATURE) || 0.7,
    apiKey: process.env.GROQ_API_KEY // Reuse Groq API key
  },

  // Speech-to-Text Configuration (Groq - Cloud API)
  stt: {
    provider: process.env.STT_PROVIDER || 'groq',
    groq: {
      apiKey: process.env.GROQ_API_KEY,
      model: process.env.GROQ_MODEL || 'whisper-large-v3-turbo' || 'whisper-large-v3',
      language: process.env.STT_LANGUAGE || 'en', // Supports 'en', 'hi', etc.
      temperature: parseFloat(process.env.GROQ_TEMPERATURE) || 0.0,
      responseFormat: process.env.GROQ_RESPONSE_FORMAT || 'verbose_json'
    }
  },

  // Text-to-Speech Configuration (Piper - Offline)
  tts: {
    enabled: process.env.TTS_ENABLED === 'true',
    provider: process.env.TTS_PROVIDER || 'piper',
    piperModelPath: process.env.PIPER_MODEL_PATH || './models/piper/en_US-lessac-medium.onnx',
    piperConfigPath: process.env.PIPER_CONFIG_PATH || './models/piper/en_US-lessac-medium.onnx.json',
    piperSpeakerId: parseInt(process.env.PIPER_SPEAKER_ID) || 0
  },

  // HuggingFace API Configuration
  huggingface: {
    apiKey: process.env.HUGGINGFACE_API_KEY,
    textEmotionModel: process.env.TEXT_EMOTION_MODEL || 'j-hartmann/emotion-english-distilroberta-base',
    voiceEmotionModel: process.env.VOICE_EMOTION_MODEL || 'superb/wav2vec2-base-superb-er',
    apiUrl: 'https://api-inference.huggingface.co/models'
  },

  // Custom Voice Emotion Model Configuration
  // ⚠️ WARNING: The BiLSTM model (emotion_bilstm_final.h5) is a TEXT model, not an audio model
  // It uses an Embedding layer for tokenized text input, NOT audio features
  // See CUSTOM_MODEL_ISSUE.md for details
  customVoiceModel: {
    enabled: process.env.CUSTOM_MODEL_ENABLED === 'true', // Disabled by default (model is for text, not audio)
    modelPath: process.env.CUSTOM_MODEL_PATH || './src/models/emotion_bilstm_final.h5',
    scriptPath: './src/voice-service/emotion_inference.py',
    emotionLabels: (process.env.CUSTOM_MODEL_LABELS || 'angry,disgust,fear,happy,neutral,sad,surprise').split(','),
    confidenceThreshold: parseFloat(process.env.CUSTOM_MODEL_THRESHOLD) || 0.5
  },

  // BiLSTM ONNX Text Emotion Model Configuration
  // This is the CORRECT usage: BiLSTM model for TEXT emotion detection
  bilstmTextModel: {
    enabled: process.env.BILSTM_TEXT_ENABLED !== 'false', // Enabled by default
    modelPath: process.env.BILSTM_MODEL_PATH || './src/models/emotion_bilstm_final.onnx',
    scriptPath: './src/text-service/bilstm_onnx_inference.py',
    emotionLabels: (process.env.BILSTM_LABELS || 'angry,disgust,fear,happy,neutral,sad').split(','), // 6 emotions (no surprise)
    confidenceThreshold: parseFloat(process.env.BILSTM_THRESHOLD) || 0.5,
    maxLength: parseInt(process.env.BILSTM_MAX_LENGTH) || 80
  },

  // Database Configuration
  database: {
    type: process.env.DATABASE_TYPE || 'supabase',
    supabase: {
      url: process.env.SUPABASE_URL,
      anonKey: process.env.SUPABASE_ANON_KEY,
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY
    },
    sqlite: {
      dbPath: process.env.SQLITE_DB_PATH || './data/emotions.db'
    }
  },

  // Storage Configuration
  storage: {
    tempAudioPath: process.env.TEMP_AUDIO_PATH || './temp/audio',
    maxAudioFileSize: parseInt(process.env.MAX_AUDIO_FILE_SIZE) || 10485760, // 10MB
    allowedAudioFormats: (process.env.ALLOWED_AUDIO_FORMATS || 'wav,mp3,ogg,webm').split(',')
  },

  // Multi-Modal Configuration
  multiModal: {
    fusionStrategy: process.env.EMOTION_FUSION_STRATEGY || 'weighted',
    textEmotionWeight: parseFloat(process.env.TEXT_EMOTION_WEIGHT) || 0.5,
    voiceEmotionWeight: parseFloat(process.env.VOICE_EMOTION_WEIGHT) || 0.5,
    confidenceThreshold: parseFloat(process.env.CONFIDENCE_THRESHOLD) || 0.6
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    enableConsole: true,
    enableFile: process.env.NODE_ENV === 'production'
  }
};

/**
 * Validate required configuration
 */
export const validateConfig = () => {
  const requiredFields = [
    { key: 'gemini.apiKey', value: config.gemini.apiKey, name: 'GEMINI_API_KEY' }
  ];

  const missing = requiredFields.filter(field => !field.value);

  if (missing.length > 0) {
    console.warn('⚠️  Warning: Missing configuration values:');
    missing.forEach(field => {
      console.warn(`   - ${field.name}`);
    });
    console.warn('   Some features may not work correctly.');
  }
};

// Validate on import
validateConfig();

export default config;
