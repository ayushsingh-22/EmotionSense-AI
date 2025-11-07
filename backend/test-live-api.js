#!/usr/bin/env node

/**
 * Live API Test Script for Translation Feature
 * Tests the translation functionality via HTTP requests to the running server
 */

import axios from 'axios';

const API_BASE_URL = 'http://localhost:8080/api';

async function testChatTranslation() {
  console.log('🧪 Testing Live Translation Feature via API\n');
  
  const testMessages = [
    {
      message: "Hello, how are you today?",
      userId: "test-user-1",
      description: "English message (should not be translated)"
    },
    {
      message: "मैं आज बहुत खुश हूं",
      userId: "test-user-2", 
      description: "Hindi message (should be translated)"
    },
    {
      message: "Me siento muy triste",
      userId: "test-user-3",
      description: "Spanish message (should be translated)"
    },
    {
      message: "Je suis très heureux aujourd'hui",
      userId: "test-user-4",
      description: "French message (should be translated)"
    }
  ];

  for (let i = 0; i < testMessages.length; i++) {
    const test = testMessages[i];
    console.log(`\n${i + 1}. ${test.description}`);
    console.log(`   Input: "${test.message}"`);
    
    try {
      const response = await axios.post(`${API_BASE_URL}/chat/message`, {
        message: test.message,
        userId: test.userId,
        includeAudio: false
      });

      if (response.data.success) {
        const data = response.data.data;
        
        // User message info
        console.log(`   Detected Language: ${data.userMessage.languageName} (${data.userMessage.detectedLanguage})`);
        console.log(`   Was Translated: ${data.userMessage.wasTranslated}`);
        if (data.userMessage.wasTranslated) {
          console.log(`   Translated Input: "${data.userMessage.translatedText}"`);
          console.log(`   Translation Method: ${data.userMessage.translationMethod}`);
        }
        
        // AI response info
        console.log(`   AI Response: "${data.aiResponse.message}"`);
        console.log(`   Response Translated: ${data.aiResponse.wasTranslated}`);
        if (data.aiResponse.originalEnglishText) {
          console.log(`   Original English: "${data.aiResponse.originalEnglishText}"`);
        }
        
        // Emotion detection
        console.log(`   Detected Emotion: ${data.emotion.detected} (${Math.round(data.emotion.confidence * 100)}%)`);
        
        console.log(`   ✅ Test completed successfully`);
        
      } else {
        console.log(`   ❌ API Error: ${response.data.error}`);
      }
      
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        console.log(`   ❌ Server not running. Please start the server with: npm run dev`);
        break;
      } else {
        console.log(`   ❌ Request failed: ${error.message}`);
      }
    }
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\n🎉 Translation API testing completed!');
  console.log('\n📝 If all tests passed, your translation feature is working correctly!');
}

async function testTextAnalysis() {
  console.log('\n\n🔤 Testing Text Analysis with Translation\n');
  
  const textTest = {
    text: "আমি আজ খুব দুঃখিত",
    userId: "test-user-bengali",
    description: "Bengali text analysis"
  };
  
  console.log(`Testing: ${textTest.description}`);
  console.log(`Input: "${textTest.text}"`);
  
  try {
    const response = await axios.post(`${API_BASE_URL}/analyze/text`, {
      text: textTest.text,
      userId: textTest.userId
    });

    if (response.data.success) {
      const data = response.data.data;
      
      console.log(`Detected Language: ${data.language.name} (${data.language.detected})`);
      console.log(`Was Translated: ${data.language.wasTranslated}`);
      if (data.language.wasTranslated) {
        console.log(`Translated Text: "${data.language.translatedText}"`);
      }
      console.log(`Detected Emotion: ${data.emotion} (${Math.round(data.confidence * 100)}%)`);
      console.log(`✅ Text analysis test completed successfully`);
      
    } else {
      console.log(`❌ API Error: ${response.data.error}`);
    }
    
  } catch (error) {
    console.log(`❌ Request failed: ${error.message}`);
  }
}

// Run tests if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('🚀 Starting live translation tests...');
  console.log('📡 Make sure the server is running on http://localhost:8080\n');
  
  testChatTranslation()
    .then(() => testTextAnalysis())
    .catch(console.error);
}

export { testChatTranslation, testTextAnalysis };