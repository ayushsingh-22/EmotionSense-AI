2/**
 * Indian Languages Configuration
 * Supported major Indian languages for voice chat
 */

// Supported Indian languages
export const INDIAN_LANGUAGES = {
  'en': { name: 'Indian English', code: 'en-IN', ttsCode: 'en-IN', native: 'English' },
  'hi': { name: 'Hindi', code: 'hi-IN', ttsCode: 'hi-IN', native: 'हिंदी' },
  'bn': { name: 'Bengali', code: 'bn-IN', ttsCode: 'bn-IN', native: 'বাংলা' },
  'ta': { name: 'Tamil', code: 'ta-IN', ttsCode: 'ta-IN', native: 'தமிழ்' },
  'te': { name: 'Telugu', code: 'te-IN', ttsCode: 'te-IN', native: 'తెలుగు' },
  'mr': { name: 'Marathi', code: 'mr-IN', ttsCode: 'mr-IN', native: 'मराठी' },
  'gu': { name: 'Gujarati', code: 'gu-IN', ttsCode: 'gu-IN', native: 'ગુજરાતી' },
  'kn': { name: 'Kannada', code: 'kn-IN', ttsCode: 'kn-IN', native: 'ಕನ್ನಡ' },
  'ml': { name: 'Malayalam', code: 'ml-IN', ttsCode: 'ml-IN', native: 'മലയാളം' },
  'or': { name: 'Odia', code: 'or-IN', ttsCode: 'or-IN', native: 'ଓଡ଼ିଆ' },
  'pa': { name: 'Punjabi', code: 'pa-IN', ttsCode: 'pa-IN', native: 'ਪੰਜਾਬੀ' },
  'mai': { name: 'Maithili', code: 'mai-IN', ttsCode: 'hi-IN', native: 'मैथिली' } // Use Hindi TTS for Maithili
};

// Whisper API returns full language names, map them to codes
export const WHISPER_LANGUAGE_NAME_TO_CODE = {
  'english': 'en',
  'hindi': 'hi',
  'bengali': 'bn',
  'tamil': 'ta',
  'telugu': 'te',
  'marathi': 'mr',
  'gujarati': 'gu',
  'kannada': 'kn',
  'malayalam': 'ml',
  'odia': 'or',
  'oriya': 'or', // Alternative name for Odia
  'punjabi': 'pa',
  'maithili': 'mai'
};

// Get list of supported language codes
export const SUPPORTED_LANGUAGE_CODES = Object.keys(INDIAN_LANGUAGES);

// Check if a language is supported
export function isIndianLanguageSupported(languageCode) {
  if (!languageCode) return false;
  
  // Extract base language code (e.g., 'hi' from 'hi-IN')
  const baseCode = languageCode.split('-')[0].toLowerCase();
  
  return SUPPORTED_LANGUAGE_CODES.includes(baseCode);
}

// Get language details
export function getIndianLanguageDetails(languageCode) {
  if (!languageCode) return INDIAN_LANGUAGES['en'];
  
  const baseCode = languageCode.split('-')[0].toLowerCase();
  return INDIAN_LANGUAGES[baseCode] || INDIAN_LANGUAGES['en'];
}

// Get language name
export function getIndianLanguageName(languageCode) {
  const details = getIndianLanguageDetails(languageCode);
  return details.name;
}

// Get TTS code for a language
export function getIndianLanguageTTSCode(languageCode) {
  const details = getIndianLanguageDetails(languageCode);
  return details.ttsCode;
}

// Validate and normalize language code
export function normalizeIndianLanguageCode(languageCode) {
  if (!languageCode) return 'en';
  
  // First, check if it's a full language name from Whisper (e.g., "Hindi", "Tamil")
  const lowerLanguage = languageCode.toLowerCase();
  if (WHISPER_LANGUAGE_NAME_TO_CODE[lowerLanguage]) {
    const mappedCode = WHISPER_LANGUAGE_NAME_TO_CODE[lowerLanguage];
    console.log(`🔄 Mapped Whisper language name '${languageCode}' → '${mappedCode}'`);
    return mappedCode;
  }
  
  // Otherwise, treat it as a language code
  const baseCode = languageCode.split('-')[0].toLowerCase();
  
  // If not in supported list, default to English
  if (!SUPPORTED_LANGUAGE_CODES.includes(baseCode)) {
    console.warn(`⚠️  Language '${languageCode}' not in Indian languages list. Defaulting to English.`);
    return 'en';
  }
  
  return baseCode;
}

// Get all language options for UI
export function getAllIndianLanguages() {
  return Object.entries(INDIAN_LANGUAGES).map(([code, details]) => ({
    code,
    name: details.name,
    native: details.native,
    fullCode: details.code
  }));
}

export default {
  INDIAN_LANGUAGES,
  SUPPORTED_LANGUAGE_CODES,
  WHISPER_LANGUAGE_NAME_TO_CODE,
  isIndianLanguageSupported,
  getIndianLanguageDetails,
  getIndianLanguageName,
  getIndianLanguageTTSCode,
  normalizeIndianLanguageCode,
  getAllIndianLanguages
};
