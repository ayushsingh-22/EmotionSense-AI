/**
 * HuggingFace API Test Script
 * Tests the emotion detection API with the michellejieli/emotion_text_classifier model
 */

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const API_KEY = process.env.HUGGINGFACE_API_KEY;
const MODEL = process.env.TEXT_EMOTION_MODEL || 'michellejieli/emotion_text_classifier';
const API_URL = `https://router.huggingface.co/hf-inference/models/${MODEL}`;

async function testHuggingFaceAPI() {
  console.log('🧪 Testing HuggingFace API...\n');
  console.log(`📦 Model: ${MODEL}`);
  console.log(`🔑 API Key: ${API_KEY ? API_KEY.substring(0, 10) + '...' : 'NOT SET'}\n`);

  const testTexts = [
    "i feel sad",
    "i am so happy today!",
    "this makes me angry",
    "i love this!",
    "i am scared and worried"
  ];

  for (const text of testTexts) {
    console.log(`\n📝 Testing: "${text}"`);
    
    try {
      const response = await axios.post(
        API_URL,
        { inputs: text },
        {
          headers: { 
            'Authorization': `Bearer ${API_KEY}`,
            'Content-Type': 'application/json',
            'x-wait-for-model': 'true'
          },
          timeout: 30000
        }
      );

      console.log(`✅ Response Status: ${response.status}`);
      console.log(`📊 Raw Response:`, JSON.stringify(response.data, null, 2));

      // Parse results
      let predictions;
      if (Array.isArray(response.data)) {
        predictions = Array.isArray(response.data[0]) ? response.data[0] : response.data;
      } else {
        predictions = response.data;
      }

      if (Array.isArray(predictions)) {
        predictions.sort((a, b) => b.score - a.score);
        console.log(`🎯 Top Emotion: ${predictions[0].label} (${(predictions[0].score * 100).toFixed(1)}%)`);
        console.log(`📈 All Scores:`);
        predictions.forEach(p => {
          console.log(`   ${p.label}: ${(p.score * 100).toFixed(1)}%`);
        });
      }

    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
      
      if (error.response) {
        console.error(`   Status: ${error.response.status}`);
        console.error(`   Data:`, error.response.data);
        
        if (error.response.status === 503) {
          console.log('\n⏳ Model is loading... This is normal for the first request.');
          console.log('   Please wait 20-30 seconds and try again.');
        } else if (error.response.status === 401) {
          console.log('\n🔑 Authentication failed. Please check your HuggingFace API token.');
          console.log('   Get a new token from: https://huggingface.co/settings/tokens');
        } else if (error.response.status === 410) {
          console.log('\n⚠️  Model endpoint deprecated or moved.');
          console.log('   Please verify the model exists: https://huggingface.co/' + MODEL);
        }
      }
    }
  }

  console.log('\n✅ Test completed!\n');
}

// Run the test
testHuggingFaceAPI().catch(err => {
  console.error('❌ Test failed:', err.message);
  process.exit(1);
});
