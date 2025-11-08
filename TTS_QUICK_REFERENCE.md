# TTS Quick Reference Guide

## Current TTS Architecture

Your project now uses a **clean, two-provider TTS system**:
- **Primary**: Google Cloud Text-to-Speech
- **Fallback**: Sarvam AI TTS

## API Endpoints

### 1. Main TTS Endpoint (Recommended)
```bash
POST /api/tts
```

**Request:**
```json
{
  "text": "Hello, how are you?"
}
```

**Features:**
- Automatically tries Google TTS first
- Falls back to Sarvam AI if Google fails
- Returns audio as WAV/MP3

---

### 2. TTS Generate Endpoint
```bash
POST /api/tts/generate
```

**Request:**
```json
{
  "text": "नमस्ते, आप कैसे हैं?",
  "language": "hi-IN",
  "voice": "hi-IN-Neural2-D"
}
```

**Response:**
```json
{
  "success": true,
  "audioUrl": "data:audio/wav;base64,...",
  "audioData": "base64_encoded_audio",
  "format": "wav",
  "size": 12345
}
```

---

### 3. Direct Sarvam AI Endpoint
```bash
POST /api/tts/sarvam
```

**Request:**
```json
{
  "text": "வணக்கம், எப்படி இருக்கிறீர்கள்?",
  "language_code": "ta-IN"
}
```

**Use Case:** When you specifically want Sarvam AI's voice (optimized for Indian languages)

---

### 4. Health Check
```bash
GET /api/tts/health
```

**Response:**
```json
{
  "success": true,
  "data": {
    "enabled": true,
    "service": "google",
    "status": "OK"
  }
}
```

---

## Supported Languages

Both providers support these Indian languages:

| Language | Code | Google Voice | Sarvam Support |
|----------|------|--------------|----------------|
| English (Indian) | `en-IN` | Neural2-C | ✅ |
| Hindi | `hi-IN` | Neural2-D | ✅ |
| Bengali | `bn-IN` | Wavenet-A | ✅ |
| Tamil | `ta-IN` | Wavenet-A | ✅ |
| Telugu | `te-IN` | Standard-A | ✅ |
| Marathi | `mr-IN` | Wavenet-A | ✅ |
| Gujarati | `gu-IN` | Wavenet-A | ✅ |
| Kannada | `kn-IN` | Wavenet-A | ✅ |
| Malayalam | `ml-IN` | Wavenet-A | ✅ |
| Punjabi | `pa-IN` | Wavenet-A | ✅ |
| Odia | `or-IN` / `od-IN` | Fallback | ✅ |
| Maithili | `mai` | Uses Hindi | Uses Hindi |

---

## Environment Variables

### Required for Google TTS
```bash
GOOGLE_TTS_API_KEY=AIzaSy...your_key_here
GOOGLE_TTS_VOICE=en-IN-Neural2-C
GOOGLE_TTS_LANGUAGE=en-IN
GOOGLE_TTS_AUDIO_ENCODING=MP3
GOOGLE_TTS_SPEED=1.0
GOOGLE_TTS_PITCH=0.0
```

### Required for Sarvam AI (Fallback)
```bash
SARVAM_API_KEY=sk_...your_key_here
```

### Optional
```bash
TTS_ENABLED=true
TTS_PROVIDER=google
```

---

## Getting API Keys

### Google Cloud TTS
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable "Cloud Text-to-Speech API"
4. Go to "Credentials" → "Create Credentials" → "API Key"
5. Copy the API key to `.env` file

**Pricing:** 
- First 1 million characters/month: Free
- After that: $4 per 1 million characters (Neural voices)

---

### Sarvam AI
1. Go to [Sarvam AI](https://www.sarvam.ai/)
2. Sign up for an account
3. Navigate to API Keys section
4. Generate a new API key
5. Copy the API key to `.env` file

**Pricing:** Check their pricing page for current rates

---

## Code Examples

### Using from Frontend (React/Next.js)
```typescript
// Generate speech from text
const generateSpeech = async (text: string, language = 'en-IN') => {
  try {
    const response = await fetch('/api/tts/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, language })
    });
    
    const data = await response.json();
    
    if (data.success) {
      // Play audio
      const audio = new Audio(data.audioUrl);
      audio.play();
    }
  } catch (error) {
    console.error('TTS Error:', error);
  }
};

// Usage
generateSpeech("Hello, how are you?", "en-IN");
generateSpeech("नमस्ते", "hi-IN");
```

### Using from Backend (Node.js)
```javascript
import { generateSpeech } from './src/tts-service/index.js';

// Generate speech
const result = await generateSpeech(
  "Hello, how are you?",
  null,  // voice (auto-select)
  'en-IN' // language
);

console.log('Audio data:', result.audioData);
console.log('Format:', result.format);
console.log('Provider:', result.provider);
```

---

## Error Handling

The TTS system follows this fallback chain:

```
Google TTS (Primary)
    ↓ (if fails)
Sarvam AI (Fallback)
    ↓ (if fails)
Error Response
```

### Common Errors

1. **"Google TTS API key not configured"**
   - Solution: Add `GOOGLE_TTS_API_KEY` to `.env` file

2. **"Sarvam AI API key not configured"**
   - Solution: Add `SARVAM_API_KEY` to `.env` file

3. **"All TTS systems failed"**
   - Check your API keys are valid
   - Check your internet connection
   - Check API quota/billing

---

## Testing

### Test Google TTS
```bash
curl -X POST http://localhost:8080/api/tts \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello world"}'
```

### Test Sarvam AI
```bash
curl -X POST http://localhost:8080/api/tts/sarvam \
  -H "Content-Type: application/json" \
  -d '{"text": "नमस्ते", "language_code": "hi-IN"}'
```

### Test Health
```bash
curl http://localhost:8080/api/tts/health
```

---

## Performance Considerations

### Google TTS
- **Latency**: 200-500ms (cloud API)
- **Quality**: Excellent (Neural2 voices)
- **Reliability**: Very high (Google infrastructure)

### Sarvam AI
- **Latency**: 300-600ms (cloud API)
- **Quality**: Good (optimized for Indian languages)
- **Reliability**: High

### Tips
- Cache audio files for frequently used phrases
- Use appropriate voice for language
- Consider audio compression for bandwidth

---

## Troubleshooting

### No audio generated
1. Check logs: `console.log` statements will show which provider failed
2. Verify API keys in `.env` file
3. Test endpoints individually using curl
4. Check API quotas in respective dashboards

### Poor audio quality
1. Try different voice for the language
2. Adjust `GOOGLE_TTS_SPEED` and `GOOGLE_TTS_PITCH`
3. Check audio encoding format

### Latency issues
1. Use audio caching
2. Preload common phrases
3. Consider CDN for static audio files

---

**Last Updated**: November 8, 2025
