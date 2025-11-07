#!/usr/bin/env node

/**
 * Quick Fix Verification Script
 * Run this after applying the fixes to verify everything is working
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '.env') });

console.log('🔍 Voice Chat Configuration Verification\n');
console.log('=' .repeat(60));

// Check 1: Voice Emotion Model
console.log('\n✓ Checking Voice Emotion Model Configuration:');
const voiceModel = process.env.VOICE_EMOTION_MODEL;
const textModel = process.env.TEXT_EMOTION_MODEL;

console.log(`   TEXT_EMOTION_MODEL: ${textModel || '❌ NOT SET'}`);
console.log(`   VOICE_EMOTION_MODEL: ${voiceModel || '❌ NOT SET'}`);

if (!voiceModel) {
  console.log('   ❌ ERROR: VOICE_EMOTION_MODEL not set in .env!');
  console.log('   💡 Add this to .env: VOICE_EMOTION_MODEL=superb/wav2vec2-base-superb-er');
} else if (voiceModel === textModel) {
  console.log('   ❌ ERROR: Voice and text models are the same!');
  console.log('   💡 Voice model should be an audio model like: superb/wav2vec2-base-superb-er');
  console.log('   💡 Current voice model:', voiceModel);
} else if (voiceModel.includes('roberta') || voiceModel.includes('bert') || voiceModel.includes('text')) {
  console.log('   ⚠️  WARNING: Voice model appears to be a text model!');
  console.log('   💡 Use an audio model instead: superb/wav2vec2-base-superb-er');
} else if (voiceModel.includes('wav2vec2') || voiceModel.includes('wavlm') || voiceModel.includes('hubert')) {
  console.log('   ✅ GOOD: Voice model appears to be an audio model');
} else {
  console.log('   ⚠️  WARNING: Cannot verify if voice model is an audio model');
}

// Check 2: Database Configuration
console.log('\n✓ Checking Database Configuration:');
const dbType = process.env.DATABASE_TYPE;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

console.log(`   DATABASE_TYPE: ${dbType || '❌ NOT SET'}`);

if (dbType === 'supabase') {
  console.log(`   SUPABASE_URL: ${supabaseUrl ? '✅ Set' : '❌ NOT SET'}`);
  console.log(`   SUPABASE_KEY: ${supabaseKey ? '✅ Set' : '❌ NOT SET'}`);
  
  if (!supabaseUrl || !supabaseKey) {
    console.log('   ❌ ERROR: Supabase credentials missing!');
  } else {
    console.log('   ✅ GOOD: Supabase configured');
  }
}

// Check 3: TTS Configuration
console.log('\n✓ Checking TTS Configuration:');
const ttsProvider = process.env.TTS_PROVIDER || 'google';
const googleApiKey = process.env.GOOGLE_TTS_API_KEY || process.env.GEMINI_API_KEY;

console.log(`   TTS_PROVIDER: ${ttsProvider}`);

if (ttsProvider === 'google') {
  console.log(`   GOOGLE_TTS_API_KEY: ${googleApiKey ? '✅ Set' : '❌ NOT SET'}`);
  if (!googleApiKey) {
    console.log('   ⚠️  WARNING: No Google TTS API key. TTS might not work for Indian languages.');
  } else {
    console.log('   ✅ GOOD: Google TTS API key configured');
  }
}

// Check 4: Groq API (for Whisper STT)
console.log('\n✓ Checking Speech-to-Text Configuration:');
const groqApiKey = process.env.GROQ_API_KEY;
console.log(`   GROQ_API_KEY: ${groqApiKey ? '✅ Set' : '❌ NOT SET'}`);

if (!groqApiKey) {
  console.log('   ❌ ERROR: Groq API key missing! Voice transcription will fail.');
} else {
  console.log('   ✅ GOOD: Groq Whisper configured for speech-to-text');
}

// Summary
console.log('\n' + '='.repeat(60));
console.log('\n📋 Summary:');

const issues = [];

if (!voiceModel || voiceModel === textModel) {
  issues.push('Fix VOICE_EMOTION_MODEL in .env');
}
if (dbType === 'supabase' && (!supabaseUrl || !supabaseKey)) {
  issues.push('Configure Supabase credentials');
}
if (!groqApiKey) {
  issues.push('Add GROQ_API_KEY to .env');
}

if (issues.length === 0) {
  console.log('✅ All configurations look good!');
  console.log('\n📝 Next Steps:');
  console.log('   1. Run the database migration SQL in Supabase');
  console.log('   2. Install Python dependencies: pip install transformers torch librosa soundfile');
  console.log('   3. Restart the backend server');
  console.log('   4. Test voice chat in the frontend');
} else {
  console.log('⚠️  Issues found:');
  issues.forEach((issue, index) => {
    console.log(`   ${index + 1}. ${issue}`);
  });
  console.log('\n💡 Fix these issues and run this script again.');
}

console.log('\n' + '='.repeat(60));
console.log('\n📖 For detailed instructions, see: VOICE_CHAT_COMPLETE_FIX.md\n');
