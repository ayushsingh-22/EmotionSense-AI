/**
 * Test the actual text emotion detection endpoint
 */

import axios from 'axios';

const API_URL = 'http://localhost:8080/api/analyze/text';

async function testEmotionEndpoint() {
  console.log('🧪 Testing Emotion Detection Endpoint...\n');

  const testCases = [
    { text: "i feel sad", expected: "sad/sadness" },
    { text: "i am so happy today!", expected: "happy/joy" },
    { text: "this makes me angry", expected: "angry/anger" },
    { text: "i love this!", expected: "happy/joy" },
    { text: "i am scared and worried", expected: "fear" }
  ];

  for (const { text, expected } of testCases) {
    console.log(`\n📝 Testing: "${text}"`);
    console.log(`   Expected: ${expected}`);
    
    try {
      const response = await axios.post(API_URL, { text });
      
      console.log(`✅ Status: ${response.status}`);
      console.log(`🎯 Result:`, {
        emotion: response.data.emotion,
        confidence: `${(response.data.confidence * 100).toFixed(1)}%`,
        models_used: response.data.models_used,
        individual_results: response.data.individual_results
      });

      // Check if HuggingFace model was used
      if (response.data.models_used?.includes('huggingface')) {
        console.log(`✅ HuggingFace model working!`);
      } else {
        console.log(`⚠️  Only BiLSTM used (HuggingFace may have failed)`);
      }

    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
      if (error.response) {
        console.error(`   Status: ${error.response.status}`);
        console.error(`   Data:`, error.response.data);
      }
    }
  }

  console.log('\n✅ Test completed!\n');
}

// Wait a moment for server to be ready, then run test
setTimeout(() => {
  testEmotionEndpoint().catch(err => {
    console.error('❌ Test failed:', err.message);
    process.exit(1);
  });
}, 2000);
