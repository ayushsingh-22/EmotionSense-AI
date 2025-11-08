/**
 * Test Sarvam AI and Indic Parler TTS Integration
 * This script tests the TTS fallback chain: Google → Sarvam → Indic Parler
 */

import { generateSpeech } from './src/tts-service/index.js';
import fs from 'fs';
import path from 'path';

const testCases = [
  {
    text: 'Hello, this is a test of the Sarvam AI text-to-speech system.',
    language: 'en-IN',
    description: 'English (Indian)'
  },
  {
    text: 'नमस्ते, यह सर्वम एआई टेक्स्ट-टू-स्पीच प्रणाली का परीक्षण है।',
    language: 'hi-IN',
    description: 'Hindi'
  },
  {
    text: 'வணக்கம், இது சர்வம் AI உரை-க்கு-பேச்சு அமைப்பின் சோதனை.',
    language: 'ta-IN',
    description: 'Tamil'
  },
  {
    text: 'Bonjour, ceci est un test du système de synthèse vocale.',
    language: 'fr-FR',
    description: 'French (should fallback to English)'
  }
];

async function testSarvamTTS() {
  console.log('🧪 Testing Multi-Layer TTS Integration (Google → Sarvam → Indic Parler)\n');
  console.log('=' .repeat(60));

  for (const testCase of testCases) {
    console.log(`\n📝 Test: ${testCase.description}`);
    console.log(`   Text: ${testCase.text.substring(0, 50)}...`);
    console.log(`   Language: ${testCase.language}`);

    try {
      const result = await generateSpeech(testCase.text, null, testCase.language);

      if (!result) {
        console.error('❌ No result returned from TTS');
        continue;
      }

      console.log(`✅ TTS Success!`);
      console.log(`   Provider: ${result.provider}`);
      console.log(`   Format: ${result.format}`);
      console.log(`   Duration: ${result.duration}s`);
      console.log(`   Audio size: ${result.audioData.length} bytes`);

      // Save audio to file for manual verification
      const fileName = `test-${testCase.language}-${Date.now()}.${result.format}`;
      const outputPath = path.join('./temp/audio', fileName);
      
      // Ensure directory exists
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Write audio file
      const audioBuffer = Buffer.from(result.audioData, 'base64');
      fs.writeFileSync(outputPath, audioBuffer);
      console.log(`   Saved to: ${outputPath}`);

    } catch (error) {
      console.error(`❌ TTS Failed: ${error.message}`);
    }

    console.log('-'.repeat(60));
  }

  console.log('\n🎉 All tests completed!\n');
}

// Run tests
testSarvamTTS().catch(console.error);
