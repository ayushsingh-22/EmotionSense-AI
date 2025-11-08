# Murf AI TTS Integration Guide

## Overview

This project now integrates **Murf AI** as a third fallback TTS (Text-to-Speech) service, providing high-quality AI voice synthesis when both Google TTS and Sarvam AI fail or are unavailable.

## TTS Fallback Chain

The system now uses a **three-tier fallback strategy**:

1. **Primary**: Google Cloud TTS (Neural2 voices, multilingual)
2. **Secondary**: Sarvam AI (Indian language focus)
3. **Tertiary**: Murf AI (High-quality FALCON model)

## Features

- **High-Quality Voice**: Uses Murf AI's FALCON model for natural-sounding speech
- **Multiple Languages**: Supports English, Hindi, and many other languages
- **Streaming API**: Uses Murf AI's streaming speech endpoint for efficient audio generation
- **Automatic Fallback**: Seamlessly switches to Murf AI when other services fail
- **Configurable**: Customize voice, model, and locale through environment variables

## Configuration

### Environment Variables

Add the following variables to your `.env` file:

```bash
# Murf AI TTS Configuration (Third Fallback)
MURF_API_KEY=your_murf_api_key_here
MURF_VOICE_ID=Matthew
MURF_MODEL=FALCON
MURF_LOCALE=en-US
```

### Configuration Options

| Variable | Description | Default | Options |
|----------|-------------|---------|---------|
| `MURF_API_KEY` | Murf AI API key (required) | - | Your API key from Murf AI dashboard |
| `MURF_VOICE_ID` | Voice to use for synthesis | `Matthew` | Matthew, Sarah, John, etc. |
| `MURF_MODEL` | TTS model to use | `FALCON` | FALCON (recommended) |
| `MURF_LOCALE` | Default locale for synthesis | `en-US` | en-US, hi-IN, es-ES, etc. |

### Getting a Murf AI API Key

1. Sign up at [Murf AI](https://murf.ai/)
2. Navigate to your dashboard
3. Go to API settings
4. Generate a new API key
5. Copy the key and add it to your `.env` file

## Supported Languages

Murf AI supports multiple languages with locale codes:

| Language | Locale Code | Example Voice |
|----------|-------------|---------------|
| English (US) | `en-US` | Matthew, Sarah |
| Hindi | `hi-IN` | Aditi, Arjun |
| Bengali | `bn-IN` | - |
| Tamil | `ta-IN` | - |
| Telugu | `te-IN` | - |
| Marathi | `mr-IN` | - |
| Gujarati | `gu-IN` | - |
| Kannada | `kn-IN` | - |
| Malayalam | `ml-IN` | - |
| Spanish | `es-ES` | - |
| French | `fr-FR` | - |
| German | `de-DE` | - |
| Portuguese | `pt-BR` | - |
| Japanese | `ja-JP` | - |
| Korean | `ko-KR` | - |
| Chinese | `zh-CN` | - |

## API Usage

### Direct Function Call

```javascript
import { generateSpeechMurf } from './src/tts-service/index.js';

const result = await generateSpeechMurf(
  "Hi, How are you doing today?",
  "en-US"
);

console.log(`Audio generated: ${result.audio.length} bytes`);
console.log(`Format: ${result.format}`);
console.log(`Provider: ${result.provider}`);
```

### Through Main TTS Service

The Murf AI integration is automatically used as a fallback:

```javascript
import { generateSpeech } from './src/tts-service/index.js';

// Will try Google TTS -> Sarvam AI -> Murf AI
const result = await generateSpeech(
  "Hello, this is a test message",
  null, // voice (optional)
  "en-US" // language code
);
```

### API Response Structure

```javascript
{
  audio: "base64_encoded_audio_data",
  format: "mp3",
  duration: 2.5,
  provider: "murf",
  voice: "Matthew",
  language: "en-US",
  sampleRate: 44100
}
```

## Testing

### Run the Test Script

```bash
# Navigate to backend directory
cd backend

# Run Murf AI test
node test-murf-tts.js
```

### Test Output

The test script will:
1. Test multiple language scenarios
2. Generate audio files
3. Save them to `./temp/audio/` directory
4. Display detailed logs

### Manual Testing via API

```bash
# Test via chat endpoint (will use fallback chain)
curl -X POST http://localhost:8080/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Test message",
    "voiceEnabled": true,
    "language": "en-US"
  }'
```

## Error Handling

The system gracefully handles errors:

### Missing API Key
```
Error: Murf AI API key not configured. Set MURF_API_KEY in .env file.
```

**Solution**: Add `MURF_API_KEY` to your `.env` file

### API Request Failed
```
Error: Murf AI TTS API error: 401 - Unauthorized
```

**Solution**: Check if your API key is valid and active

### Network Issues
```
Error: Murf AI TTS API request failed - no response received
```

**Solution**: Check your internet connection and firewall settings

## Fallback Behavior

The TTS service automatically handles failures:

1. **Google TTS fails** → Try Sarvam AI
2. **Sarvam AI fails** → Try Murf AI
3. **Murf AI fails** → Return error

Console logs show the fallback progression:

```
🌐 Using Google TTS with multilingual support...
❌ Google TTS failed: API key not configured
⚠️ Google TTS failed, switching to Sarvam AI fallback...
❌ Sarvam AI TTS failed: Connection timeout
⚠️ Sarvam AI TTS failed, switching to Murf AI fallback...
🌐 Using Murf AI TTS as third fallback...
✅ Speech generated successfully (2.5s, murf)
```

## Code Structure

### Files Modified

1. **`backend/.env.example`**
   - Added Murf AI configuration variables

2. **`backend/src/config/index.js`**
   - Added `murf` configuration section under `tts`

3. **`backend/src/tts-service/index.js`**
   - Added `convertToMurfLanguageCode()` function
   - Added `generateSpeechMurf()` function
   - Updated `generateSpeech()` to include Murf AI fallback

4. **`backend/test-murf-tts.js`** (new)
   - Test script for Murf AI integration

### Key Functions

#### `convertToMurfLanguageCode(languageCode)`
Converts short language codes to Murf AI locale format:
- Input: `"en"` → Output: `"en-US"`
- Input: `"hi"` → Output: `"hi-IN"`

#### `generateSpeechMurf(text, languageCode)`
Generates speech using Murf AI Stream Speech API:
- Calls Murf AI API endpoint
- Returns base64 encoded audio
- Handles errors gracefully

#### `generateSpeech(text, voice, languageCode)`
Main TTS function with three-tier fallback:
1. Try Google TTS
2. Try Sarvam AI
3. Try Murf AI

## Performance Considerations

- **Sample Rate**: 44.1 kHz (high quality)
- **Format**: MP3 (efficient compression)
- **Timeout**: 30 seconds per request
- **Audio Encoding**: Base64 for easy transmission

## Best Practices

1. **API Key Security**: Never commit your API key to version control
2. **Error Logging**: Monitor logs for fallback patterns
3. **Cost Optimization**: Use Google TTS as primary (usually cheaper)
4. **Language Selection**: Use appropriate locale codes for best results
5. **Testing**: Test all three fallback levels regularly

## Troubleshooting

### Audio Not Generated

**Check:**
- Is `TTS_ENABLED=true` in `.env`?
- Is `MURF_API_KEY` set correctly?
- Are all three services failing?

### Poor Audio Quality

**Solutions:**
- Ensure using `FALCON` model
- Check sample rate (should be 44100)
- Verify locale code matches text language

### Slow Response Time

**Possible Causes:**
- Network latency
- Large text input
- All services tried before success

**Solutions:**
- Use shorter text chunks
- Check API status pages
- Optimize network connection

## API Documentation References

- **Murf AI API**: https://global.api.murf.ai/docs
- **Stream Speech Endpoint**: `POST /v1/speech/stream`
- **Authentication**: Bearer token in Authorization header

## Examples

### Example 1: English Speech
```javascript
const result = await generateSpeechMurf(
  "Welcome to our application!",
  "en-US"
);
// Returns MP3 audio with Matthew's voice
```

### Example 2: Hindi Speech
```javascript
const result = await generateSpeechMurf(
  "नमस्ते, आपका स्वागत है",
  "hi-IN"
);
// Returns MP3 audio with Hindi voice
```

### Example 3: Automatic Fallback
```javascript
// This will automatically use Murf AI if others fail
const result = await generateSpeech(
  "This is a test message",
  null,
  "en-US"
);
console.log(`Provider used: ${result.provider}`);
// Might be: google, sarvam, or murf
```

## Cost Considerations

- Murf AI pricing varies by plan and usage
- Monitor your usage in the Murf AI dashboard
- Consider caching frequently used audio
- Use primary services (Google/Sarvam) when available to reduce costs

## Future Enhancements

Potential improvements for the Murf AI integration:

1. **Voice Selection**: Add UI for voice selection
2. **Caching**: Cache generated audio to reduce API calls
3. **Voice Cloning**: Integrate custom voice cloning features
4. **Analytics**: Track which TTS service is used most
5. **Quality Metrics**: Compare audio quality across providers

## Support

For issues related to:
- **Murf AI API**: Contact Murf AI support
- **Integration Code**: Check application logs and error messages
- **Configuration**: Review this documentation and `.env.example`

## Summary

The Murf AI integration provides:
✅ High-quality voice synthesis
✅ Multiple language support
✅ Automatic fallback mechanism
✅ Easy configuration
✅ Comprehensive error handling
✅ Production-ready implementation

Your TTS system is now more robust with three levels of redundancy!
