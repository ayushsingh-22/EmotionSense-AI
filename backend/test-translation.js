#!/usr/bin/env node

/**
 * Translation Feature Test Script
 * Tests the new language detection and translation functionality
 */

import { translateToEnglishIfNeeded, translateBackToUserLanguage, getLanguageName } from './src/utils/translationHelper.js';

async function testTranslation() {
  console.log('🧪 Testing Translation Functionality\n');

  const testCases = [
    {
      text: "Hello, how are you today?",
      description: "English text (should not be translated)"
    },
    {
      text: "मैं आज बहुत खुश हूं",
      description: "Hindi text (should be translated to English)"
    },
    {
      text: "Hola, ¿cómo estás hoy?",
      description: "Spanish text (should be translated to English)"
    },
    {
      text: "Bonjour, comment allez-vous aujourd'hui?",
      description: "French text (should be translated to English)"
    }
  ];

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`\n${i + 1}. ${testCase.description}`);
    console.log(`   Original: "${testCase.text}"`);
    
    try {
      // Test translation to English
      const result = await translateToEnglishIfNeeded(testCase.text);
      console.log(`   Language: ${result.sourceLang} (${getLanguageName(result.sourceLang)})`);
      console.log(`   English: "${result.translatedText}"`);
      console.log(`   Needs Translation: ${result.needsTranslation}`);
      
      if (result.usedFallback) {
        console.log(`   ⚠️ Used Gemini fallback`);
      }
      
      if (result.translationFailed) {
        console.log(`   ❌ Translation failed`);
      }

      // Test translation back to original language (if it was translated)
      if (result.needsTranslation && result.sourceLang !== 'unknown') {
        console.log(`   Testing back-translation to ${result.sourceLang}...`);
        const backTranslated = await translateBackToUserLanguage(result.translatedText, result.sourceLang);
        console.log(`   Back to ${getLanguageName(result.sourceLang)}: "${backTranslated}"`);
      }
      
      console.log(`   ✅ Test completed successfully`);
      
    } catch (error) {
      console.log(`   ❌ Test failed: ${error.message}`);
    }
  }

  console.log('\n🎉 Translation testing completed!');
  console.log('\n📝 Next steps:');
  console.log('   1. Start the backend server: npm run dev');
  console.log('   2. Test with real chat messages in different languages');
  console.log('   3. Verify responses are translated back to user language');
}

// Run the test if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testTranslation().catch(console.error);
}

export { testTranslation };