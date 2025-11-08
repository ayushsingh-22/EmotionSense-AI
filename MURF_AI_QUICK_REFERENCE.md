# Murf AI TTS - Quick Reference

## Setup (3 Steps)

### 1. Add to `.env` file
```bash
MURF_API_KEY=your_actual_api_key_here
MURF_VOICE_ID=Matthew
MURF_MODEL=FALCON
MURF_LOCALE=en-US
```

### 2. Get API Key
- Visit: https://murf.ai/
- Sign up / Login
- Go to API settings
- Generate API key
- Copy to `.env`

### 3. Test Integration
```bash
cd backend
node test-murf-tts.js
```

## How It Works

**TTS Fallback Chain:**
```
User Request → Google TTS (1st) → Sarvam AI (2nd) → Murf AI (3rd)
                    ↓ fail            ↓ fail            ↓ fail
                 Continue           Continue          Error
```

## Code Usage

### Basic Example
```javascript
import { generateSpeech } from './src/tts-service/index.js';

const result = await generateSpeech(
  "Hello, how are you?",
  null,      // voice (optional)
  "en-US"    // language
);

console.log(`Provider: ${result.provider}`); // google/sarvam/murf
```

### Direct Murf AI Call
```javascript
import { generateSpeechMurf } from './src/tts-service/index.js';

const result = await generateSpeechMurf(
  "Hi, How are you doing today?",
  "en-US"
);
```

## Common Languages

| Code | Language |
|------|----------|
| `en-US` | English (US) |
| `hi-IN` | Hindi |
| `es-ES` | Spanish |
| `fr-FR` | French |
| `de-DE` | German |

## Troubleshooting

| Error | Solution |
|-------|----------|
| "API key not configured" | Add `MURF_API_KEY` to `.env` |
| "401 - Unauthorized" | Check API key validity |
| "All TTS systems failed" | Check all API keys and network |

## Response Structure

```javascript
{
  audioData: "base64_string",  // Audio in base64
  format: "mp3",               // Audio format
  duration: 2.5,               // Duration in seconds
  provider: "murf",            // Which service was used
  voice: "Matthew",            // Voice used
  text: "original text"        // Input text
}
```

## Files Changed

- ✅ `backend/.env.example` - Added Murf config
- ✅ `backend/src/config/index.js` - Added Murf settings
- ✅ `backend/src/tts-service/index.js` - Added Murf integration
- ✅ `backend/test-murf-tts.js` - Test script (new)

## Testing Checklist

- [ ] Add `MURF_API_KEY` to `.env`
- [ ] Run `node test-murf-tts.js`
- [ ] Check `./temp/audio/` for generated files
- [ ] Test via chat endpoint
- [ ] Verify fallback works (disable Google/Sarvam)

## Quick Test Command

```bash
# Test Murf AI directly
cd backend
node test-murf-tts.js

# Test via API
curl -X POST http://localhost:8080/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Test", "voiceEnabled": true}'
```

## Production Checklist

- [ ] Valid Murf AI API key configured
- [ ] Test all three fallback levels
- [ ] Monitor API usage/costs
- [ ] Check error logs regularly
- [ ] Test multiple languages
- [ ] Verify audio quality
- [ ] Test network failure scenarios

## Support

- Murf AI Docs: https://global.api.murf.ai/docs
- Project Docs: `MURF_AI_INTEGRATION_GUIDE.md`
