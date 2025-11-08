/**
 * Test script for Murf AI TTS integration
 * Tests the Murf AI TTS fallback functionality
 */

import dotenv from 'dotenv';
import { generateSpeechMurf } from './src/tts-service/index.js';
import fs from 'fs';
import path from 'path';

// Load environment variables
dotenv.config();

const testMurfTTS = async () => {
  console.log('🧪 Testing Murf AI TTS Integration...\n');

  // Test cases
  const testCases = [
    {
      text: "Hi, How are you doing today?",
      language: "en-US",
      description: "English (US) - Default test"
    },
    {
      text: "Hello! This is a test of the Murf AI text-to-speech system.",
      language: "en-US",
      description: "English (US) - Longer text"
    },
    {
      text: "नमस्ते, आज आप कैसे हैं?",
      language: "hi-IN",
      description: "Hindi - Greeting"
    }
  ];

  for (const testCase of testCases) {
    console.log(`\n📝 Test: ${testCase.description}`);
    console.log(`   Text: "${testCase.text}"`);
    console.log(`   Language: ${testCase.language}`);
    
    try {
      const result = await generateSpeechMurf(testCase.text, testCase.language);
      
      console.log('✅ Success!');
      console.log(`   Provider: ${result.provider}`);
      console.log(`   Voice: ${result.voice}`);
      console.log(`   Format: ${result.format}`);
      console.log(`   Duration: ${result.duration}s`);
      console.log(`   Sample Rate: ${result.sampleRate}Hz`);
      console.log(`   Audio size: ${result.audio.length} bytes (base64)`);
      
      // Save audio file for manual verification
      const outputDir = './temp/audio';
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      const filename = `murf-test-${testCase.language}-${Date.now()}.${result.format}`;
      const filepath = path.join(outputDir, filename);
      
      // Convert base64 to buffer and save
      const audioBuffer = Buffer.from(result.audio, 'base64');
      fs.writeFileSync(filepath, audioBuffer);
      
      console.log(`   Saved to: ${filepath}`);
      
    } catch (error) {
      console.error('❌ Failed!');
      console.error(`   Error: ${error.message}`);
      if (error.response) {
        console.error(`   Status: ${error.response.status}`);
        console.error(`   Response:`, error.response.data);
      }
    }
  }
  
  console.log('\n✅ Test completed!');
};

// Run test
testMurfTTS().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
