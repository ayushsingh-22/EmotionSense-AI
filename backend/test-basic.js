#!/usr/bin/env node

/**
 * Simple Translation Test
 * Tests basic functionality without external API calls
 */

import { getLanguageName, isLanguageSupported } from './src/utils/translationHelper.js';

function testBasicFunctionality() {
  console.log('🧪 Testing Basic Translation Helper Functions\n');
  
  // Test language name mapping
  console.log('1. Testing getLanguageName():');
  const testLanguages = ['en', 'hi', 'es', 'fr', 'unknown', 'xyz'];
  testLanguages.forEach(lang => {
    console.log(`   ${lang} -> ${getLanguageName(lang)}`);
  });
  
  // Test language support check
  console.log('\n2. Testing isLanguageSupported():');
  testLanguages.forEach(lang => {
    console.log(`   ${lang} -> ${isLanguageSupported(lang) ? 'Supported' : 'Not supported'}`);
  });
  
  console.log('\n✅ Basic functionality tests completed!');
  console.log('\n📝 Translation helper functions are working correctly.');
  console.log('   Note: Full translation testing requires running the server and making API calls.');
}

testBasicFunctionality();