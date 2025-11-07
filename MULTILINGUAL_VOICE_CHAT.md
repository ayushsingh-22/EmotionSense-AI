# 🌐 Multilingual Voice Chat Feature

## Overview
The Voice Chat feature now supports **multilingual conversations** where users can speak in any language, and the system automatically:
1. Detects the spoken language using Groq Whisper
2. Translates to English for internal chat reasoning (if needed)
3. Generates AI response in English
4. Translates response back to user's original language
5. Outputs speech in the user's language via Google TTS

## Architecture

### Flow Diagram
```
User Voice (Any Language)
    ↓
[Groq Whisper STT] → Language Detection (hi, es, fr, etc.)
    ↓
[Translation to English] → For LLM Processing
    ↓
[Groq LLM] → Generate Response in English
    ↓
[Translation back to User Language] → Maintain conversation context
    ↓
[Google TTS] → Audio output in user's language
    ↓
User hears response in their own language
```

### Tech Stack
- **STT (Speech-to-Text)**: Groq Whisper API (automatic language detection)
- **Translation**: Google Translate API + Gemini 2.0 Flash (fallback)
- **LLM**: Groq (processes in English)
- **TTS (Text-to-Speech)**: Google Cloud TTS (multi-language neural voices)

## Supported Languages

### Primary Support (100+ languages via Google Translate)
- **English** (en)
- **Hindi** (hi)
- **Spanish** (es)
- **French** (fr)
- **German** (de)
- **Italian** (it)
- **Portuguese** (pt)
- **Russian** (ru)
- **Japanese** (ja)
- **Korean** (ko)
- **Chinese** (zh)
- **Arabic** (ar)
- **Tamil** (ta)
- **Telugu** (te)
- **Bengali** (bn)
- **Marathi** (mr)
- **Gujarati** (gu)
- **And 80+ more languages...**

### Voice Quality by Language
| Language | Voice Model | Quality |
|----------|-------------|---------|
| English | Neural2-C | Excellent |
| Hindi | Neural2-C | Excellent |
| Spanish | Neural2-B | Excellent |
| French | Neural2-C | Excellent |
| German | Neural2-B | Excellent |
| Tamil | Wavenet-A | Very Good |
| Telugu | Standard-A | Good |
| Other Indian | Wavenet-A | Very Good |

## Implementation Details

### Backend Changes

#### 1. `/api/chat/transcribe` Endpoint
- **Input**: Audio file (WebM, MP3, WAV, OGG)
- **Output**: 
  ```json
  {
    "success": true,
    "data": {
      "text": "transcribed text",
      "language": "hi",
      "confidence": 0.95,
      "provider": "groq",
      "duration": 3.5
    }
  }
  ```

#### 2. `/api/chat/voice` Endpoint (Upgraded)
- **New Flow**:
  1. Transcribe audio with Groq Whisper (auto-detect language)
  2. Translate to English if `language !== 'en'`
  3. Process with Groq LLM (English)
  4. Translate response back to user's language
  5. Generate TTS in user's language
  6. Return comprehensive multilingual response

- **Response Structure**:
  ```json
  {
    "success": true,
    "data": {
      "sessionId": "uuid",
      "userMessage": {
        "text": "मुझे उदास महसूस हो रहा है",
        "englishText": "I am feeling sad",
        "detectedLanguage": "hi",
        "languageName": "Hindi",
        "wasTranslated": true,
        "emotion": "sad",
        "confidence": 0.87
      },
      "aiResponse": {
        "text": "मुझे सुनकर दुख हुआ कि आप उदास महसूस कर रहे हैं...",
        "englishText": "I'm sorry to hear you're feeling sad...",
        "wasTranslated": true,
        "targetLanguage": "hi"
      },
      "language": {
        "detected": "hi",
        "name": "Hindi",
        "inputTranslated": true,
        "outputTranslated": true
      },
      "audio": {
        "url": "http://localhost:8080/audio/tts-xxx.mp3",
        "duration": 5.2,
        "provider": "google",
        "language": "hi"
      }
    }
  }
  ```

#### 3. Translation Helper (`translationHelper.js`)
- **Primary**: Google Translate API
- **Fallback**: Gemini 2.0 Flash
- **Functions**:
  - `translateToEnglishIfNeeded(text)` - Auto-detect & translate
  - `translateBackToUserLanguage(text, targetLang)` - Translate response
  - `getLanguageName(code)` - Human-readable language names
  - `isLanguageSupported(code)` - Check language support

#### 4. TTS Service (`tts-service/index.js`)
- **Upgraded Features**:
  - Language code conversion (Whisper format → Google TTS format)
  - Auto-select best neural voice for each language
  - Support for 40+ language-specific voices
  - Fallback to Piper TTS for offline mode

### Frontend Changes

#### VoiceChatComponent.tsx
- **New Features**:
  1. Display detected language after transcription
  2. Show multilingual conversation indicator
  3. Display both user language and English translation info
  4. Audio playback in user's original language
  5. Translation status notifications

- **UI Enhancements**:
  ```tsx
  // Multilingual Mode Indicator
  {translationInfo && (
    <div className="multilingual-indicator">
      🌐 Multilingual Mode Active
      • Detected: {languageName}
      • Input: Translated to English for processing
      • Output: Translated back to {languageName}
      • Voice: Audio response in {languageName}
    </div>
  )}
  ```

## Configuration

### Environment Variables Required

```bash
# Groq API for Whisper STT and LLM
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxx

# Google Cloud TTS for multilingual voice output
GOOGLE_TTS_API_KEY=AIzaSyxxxxxxxxxxxxxxxxxxxxx

# Gemini API for translation fallback
GEMINI_API_KEY=AIzaSyxxxxxxxxxxxxxxxxxxxxx
```

### Config File (`backend/src/config/index.js`)
```javascript
tts: {
  enabled: true,
  provider: 'google', // 'google' or 'piper'
  google: {
    apiKey: process.env.GOOGLE_TTS_API_KEY,
    audioEncoding: 'MP3',
    languageCode: 'en-US', // default
    voice: 'en-US-Neural2-C', // default
    speakingRate: 1.0,
    pitch: 0.0
  }
}
```

## Usage Examples

### Example 1: Hindi Conversation
**User speaks**: "मुझे आज बहुत खुशी हो रही है" (I am very happy today)

**System Flow**:
1. Whisper detects: `language: "hi"`
2. Translates to English: "I am very happy today"
3. LLM generates: "That's wonderful! I'm so glad to hear..."
4. Translates back to Hindi: "यह बहुत अच्छा है! मुझे यह सुनकर खुशी हुई..."
5. TTS outputs Hindi audio with hi-IN-Neural2-C voice

### Example 2: Spanish Conversation
**User speaks**: "Me siento triste hoy" (I feel sad today)

**System Flow**:
1. Whisper detects: `language: "es"`
2. Translates to English: "I feel sad today"
3. LLM generates: "I'm sorry you're feeling sad..."
4. Translates back to Spanish: "Lamento que te sientas triste..."
5. TTS outputs Spanish audio with es-ES-Neural2-B voice

### Example 3: Tamil Conversation
**User speaks**: "எனக்கு கவலையாக இருக்கிறது" (I am worried)

**System Flow**:
1. Whisper detects: `language: "ta"`
2. Translates to English: "I am worried"
3. LLM generates empathetic response
4. Translates back to Tamil: "உங்கள் கவலை புரிகிறது..."
5. TTS outputs Tamil audio with ta-IN-Wavenet-A voice

## Testing

### Manual Testing Steps
1. **Open Voice Chat** in the frontend
2. **Click "Start Recording"**
3. **Speak in any language** (e.g., Hindi, Spanish, French)
4. **Click "Stop Recording"**
5. **Verify transcription** shows in that language
6. **Wait for response** (should be in same language)
7. **Listen to audio** (should speak in your language)

### Test Languages
- ✅ Hindi (hi)
- ✅ Spanish (es)
- ✅ French (fr)
- ✅ German (de)
- ✅ Tamil (ta)
- ✅ Telugu (te)
- ✅ Arabic (ar)
- ✅ Japanese (ja)

### Expected Behavior
- ✅ Language auto-detected from speech
- ✅ Transcription in original language
- ✅ AI response in same language
- ✅ Audio output in same language
- ✅ Both versions stored in transcript
- ✅ Emotion detection works on English translation

## Transcript Storage

### Database Schema
```javascript
{
  user_message: {
    text: "Original user text in their language",
    englishText: "English translation for internal use",
    detectedLanguage: "hi",
    languageName: "Hindi",
    wasTranslated: true,
    emotion: "happy",
    confidence: 0.89
  },
  assistant_message: {
    text: "Response in user's language",
    englishText: "Original English response",
    wasTranslated: true,
    targetLanguage: "hi"
  }
}
```

## Performance Optimizations

### Latency Breakdown
| Step | Typical Time | Optimization |
|------|--------------|--------------|
| Whisper STT | 1-3s | Fast Groq API |
| Translation (Google) | 0.5-1s | Cached results |
| LLM Response | 2-4s | Streaming possible |
| Back-translation | 0.5-1s | Parallel with TTS |
| TTS Generation | 1-2s | Google Neural voices |
| **Total** | **5-11s** | Can be reduced to 4-7s |

### Optimization Tips
1. **Cache Translations**: Common phrases cached
2. **Parallel Processing**: Translation + TTS simultaneously
3. **Streaming**: Stream LLM response while translating
4. **Voice Selection**: Pre-compute best voice per language

## Error Handling

### Fallback Strategy
1. **Translation Fails**: Use Gemini fallback
2. **Both Translation Fail**: Proceed with original text
3. **TTS Fails**: Return text-only response
4. **Whisper Fails**: Return error, ask to retry

### User-Friendly Messages
- "Translation unavailable, using English"
- "Voice output unavailable, showing text only"
- "Language detection failed, defaulting to English"

## Security & Privacy

### Data Protection
- ✅ Audio files deleted after processing
- ✅ Transcripts encrypted in database
- ✅ API keys stored in environment variables
- ✅ No audio recording stored on server
- ✅ Translation done server-side (no exposure)

### Compliance
- GDPR compliant (user data not shared)
- Audio processed in memory
- Temporary files auto-cleaned every 24 hours

## Future Enhancements

### Planned Features
1. **Real-time Translation**: Live translation during speaking
2. **Language Switching**: Switch language mid-conversation
3. **Accent Detection**: Adapt voice to regional accents
4. **Offline Mode**: Download language packs for offline use
5. **Voice Cloning**: Personalized voice for each user
6. **Dialect Support**: Regional variations (e.g., Mexican Spanish vs. Spain Spanish)

### Advanced Capabilities
- **Code-Switching**: Handle mixed-language input
- **Context Awareness**: Remember user's preferred language
- **Emotion in Voice**: Match TTS emotion to detected sentiment
- **Language Learning**: Provide pronunciation feedback

## Troubleshooting

### Common Issues

#### Issue 1: Language Not Detected
**Symptom**: Always defaults to English
**Solution**: 
- Check Groq API key is valid
- Ensure audio quality is good (clear speech)
- Verify language is supported by Whisper

#### Issue 2: Translation Fails
**Symptom**: Response stays in English
**Solution**:
- Check Google Translate API quota
- Verify Gemini API key for fallback
- Check network connectivity

#### Issue 3: TTS Not Working
**Symptom**: No audio output
**Solution**:
- Check Google TTS API key
- Verify language code is valid
- Check audio file permissions

#### Issue 4: Wrong Voice Language
**Symptom**: English voice for non-English text
**Solution**:
- Check language code mapping in `tts-service/index.js`
- Verify `convertToGoogleTTSLanguageCode()` function
- Check voice availability for language

## API References

### Groq Whisper
- **Docs**: https://console.groq.com/docs/speech-text
- **Model**: `whisper-large-v3`
- **Languages**: 99 languages auto-detected

### Google Translate
- **Docs**: https://cloud.google.com/translate/docs
- **Languages**: 100+ languages supported
- **Rate Limit**: 1M chars/month (free tier)

### Google Cloud TTS
- **Docs**: https://cloud.google.com/text-to-speech/docs
- **Voices**: Neural2, Wavenet, Standard
- **Languages**: 40+ with neural voices

### Gemini AI
- **Docs**: https://ai.google.dev/docs
- **Model**: `gemini-2.0-flash-exp`
- **Use Case**: Translation fallback

## Support

For issues or questions:
- Check logs: `backend/logs/`
- Review error messages in console
- Test individual components (STT → Translation → TTS)
- Verify all API keys are configured

---

**Last Updated**: October 31, 2025
**Version**: 2.0.0
**Status**: ✅ Production Ready
