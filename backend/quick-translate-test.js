import { translate } from '@vitalets/google-translate-api';

async function testQuickTranslation() {
  try {
    console.log('Testing translate function...');
    const result = await translate('Hola mundo', { to: 'en' });
    console.log('✅ Translation successful:');
    console.log('Full result object:', JSON.stringify(result, null, 2));
    console.log('Translated:', result.text);
  } catch (error) {
    console.error('❌ Translation failed:', error.message);
  }
}

testQuickTranslation();