# Voice Chat Feature Implementation Guide

## Overview

This document outlines the complete implementation of the voice-mode chat feature for the EmotionSense-AI application. The feature enables users to communicate via voice, with real-time speech-to-text conversion, emotion detection, AI response generation, and text-to-speech output.

---

## Architecture

### System Flow

```
Frontend (User speaks)
    ↓
Web Speech API (STT - real-time transcription)
    ↓
User reviews transcript in input box
    ↓
User clicks "Send"
    ↓
Backend /api/chat/voice endpoint
    ├─ Language detection
    ├─ Translation (if needed)
    ├─ Emotion analysis
    ├─ LLM response generation (with context)
    ├─ Response translation (if needed)
    └─ TTS conversion
    ↓
Frontend receives response with audio URL
    ↓
Audio plays automatically + transcript displays
```

---

## Implementation Details

### 1. Frontend Components

#### `VoiceChatComponent.tsx` (NEW)
- **Location**: `frontend/components/chat/VoiceChatComponent.tsx`
- **Features**:
  - Real-time speech-to-text using Web Speech API
  - Microphone permission handling
  - Visual feedback during recording (duration, status)
  - Transcript display that updates live
  - Submit transcripts with context
  - Auto-play audio responses
  - Error handling and user-friendly messages

- **Key Methods**:
  ```typescript
  startListening()         // Begin speech capture
  stopListening()          // End speech capture
  submitVoiceMessage()     // Send to backend
  playAudioResponse()      // Auto-play response
  clearTranscript()        // Reset input
  requestMicrophoneAccess() // Ask for permissions
  ```

- **Props**:
  ```typescript
  userId: string              // Required: User ID
  sessionId?: string          // Optional: Chat session
  language?: string           // Optional: Language code (default: en-US)
  onMessageReceived?: fn      // Callback when response received
  onError?: fn                // Error callback
  className?: string          // CSS classes
  disabled?: boolean          // Disable component
  ```

#### Enhanced `api.ts`
- **New Functions**:
  ```typescript
  sendVoiceMessage()          // Send voice + transcript to backend
  requestMicrophonePermission() // Request mic access
  ```

#### Updated `SpeechRecognition.tsx`
- Already exists but can be used as a standalone component
- Now works alongside VoiceChatComponent

---

### 2. Backend Routes

#### New Endpoint: `POST /api/chat/voice`

**Request** (multipart/form-data):
```json
{
  "audio": File,              // Audio file (WAV, MP3, OGG, WEBM)
  "transcript": "Hello",      // STT result from frontend
  "userId": "user123",        // Required
  "sessionId": "uuid",        // Optional (creates new if not provided)
  "language": "en-US"         // Optional (default: en-US)
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "sessionId": "uuid",
    "userMessage": {
      "id": "msg-123",
      "transcript": "Hello",
      "emotion": "neutral",
      "confidence": 0.95,
      "timestamp": "2024-10-22T...",
      "detectedLanguage": "en",
      "wasTranslated": false
    },
    "aiResponse": {
      "id": "msg-124",
      "message": "Hi there!",
      "model": "gemini-2.5-flash",
      "timestamp": "2024-10-22T...",
      "wasTranslated": false
    },
    "emotion": {
      "detected": "neutral",
      "confidence": 0.95,
      "scores": { "joy": 0.1, "sadness": 0.05, ... }
    },
    "language": {
      "detected": "en",
      "name": "English"
    },
    "audio": {
      "url": "http://localhost:8080/audio/tts-123456.mp3",
      "duration": 2.5,
      "provider": "google"
    },
    "contextLength": 5
  }
}
```

---

### 3. Backend Services & Utilities

#### New: `voiceHelper.js`
- **Location**: `backend/src/utils/voiceHelper.js`
- **Functions**:

  1. **googleSTT(audioBuffer, languageCode)**
     - Converts audio to text using Google Cloud Speech-to-Text API
     - Returns: `{ text, confidence, language, provider }`
     - Requires: `GOOGLE_STT_API_KEY`

  2. **googleTTS(text, languageCode, voiceName)**
     - Converts text to speech using Google Cloud Text-to-Speech API
     - Returns: `{ audioUrl, audioData, duration, provider, fileName }`
     - Requires: `GOOGLE_TTS_API_KEY`

  3. **piperTTS(text)**
     - Offline TTS using Piper (fallback when Google unavailable)
     - Returns: `{ audioUrl, audioData, duration, provider, fileName }`
     - No API key required

  4. **textToSpeech(text, language)**
     - Primary: Google TTS
     - Fallback: Piper TTS
     - Smart routing based on available credentials

  5. **speechToText(audioBuffer, language)**
     - Wrapper for STT with fallback
     - Returns or throws with fallback flag

  6. **processVoiceMessage(audioBuffer, userId, language)**
     - Main entry point for voice processing
     - Orchestrates the entire pipeline

  7. **Utility Functions**:
     - `listTempAudioFiles()` - Get all temp audio files
     - `cleanupOldAudioFiles(maxAgeHours)` - Delete old files

---

### 4. Updated Files

#### `chatRoutes.js` (UPDATED)
- **Added**: `POST /api/chat/voice` endpoint
- **Features**:
  - Multipart form-data handling with multer
  - Comprehensive voice message processing
  - Context-aware LLM responses
  - Multi-language support
  - TTS audio generation
  - Session management
  - Error recovery

#### `server.js` (UPDATED)
- **Added**: Static audio file serving at `/audio` route
- **Caching**: 1 hour max age for audio files

#### `.env.example` (UPDATED)
- **New Config Variables**:
  ```bash
  GOOGLE_STT_API_KEY=your_key
  GOOGLE_TTS_API_KEY=your_key
  API_BASE_URL=http://localhost:8080
  GOOGLE_APPLICATION_CREDENTIALS=/path/to/creds.json
  ```

---

## Installation & Setup

### 1. Install Backend Dependencies

```bash
cd backend
npm install
# Already included: @google/generative-ai, @vitalets/google-translate-api, multer
```

### 2. Configure Google Cloud APIs (Optional but Recommended)

#### For STT & TTS:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable:
   - Cloud Speech-to-Text API
   - Cloud Text-to-Speech API
4. Create API keys:
   - Go to Credentials → Create Credential → API Key
   - Copy the key to `.env` as `GOOGLE_STT_API_KEY` and `GOOGLE_TTS_API_KEY`

#### Alternative: Service Account
1. Create Service Account at Credentials page
2. Download JSON key file
3. Set `GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json`

### 3. Setup Environment Variables

Backend `.env`:
```bash
# Voice APIs
GOOGLE_STT_API_KEY=your_api_key
GOOGLE_TTS_API_KEY=your_api_key
API_BASE_URL=http://localhost:8080

# Or use service account
GOOGLE_APPLICATION_CREDENTIALS=/path/to/google-cloud-key.json

# Chat
CHAT_MEMORY_LENGTH=10

# Existing configs...
```

Frontend `.env.local`:
```bash
NEXT_PUBLIC_API_URL=http://localhost:8080
```

### 4. Install Piper (Offline TTS - Optional)

If you want offline TTS fallback:

```bash
# Download Piper from releases
# https://github.com/rhasspy/piper/releases

# Windows:
# Download piper_amd64.zip and extract to project root

# macOS/Linux:
# Download piper_amd64.tar.gz or piper_aarch64.tar.gz
tar -xzf piper_amd64.tar.gz
```

### 5. Create Supabase Tables (if not exists)

The voice messages will use existing `chat_sessions` and `chat_messages` tables with new fields:
- `message_type` (varchar): 'voice', 'text', 'voice_response', etc.
- `audio_filename` (varchar, nullable): Original audio file name
- `was_translated` (boolean): Whether message was translated

---

## Frontend Integration

### Using VoiceChatComponent

```tsx
import { VoiceChatComponent } from '@/components/chat/VoiceChatComponent';

export function ChatPage() {
  const [sessionId, setSessionId] = useState<string>();
  
  return (
    <div>
      <VoiceChatComponent
        userId={userId}
        sessionId={sessionId}
        language="en-US"
        onMessageReceived={(response) => {
          console.log('AI Response:', response);
          // Update UI with response
        }}
        onError={(error) => {
          console.error('Voice error:', error);
          // Show error toast
        }}
      />
    </div>
  );
}
```

### Permission Handling

The component handles permissions automatically:
1. Checks on mount if permission is granted
2. Shows warning if denied
3. Requests permission on first mic click
4. Shows "Allow/Block" browser dialog

---

## Error Handling

### Frontend Error Scenarios

| Error | Cause | Solution |
|-------|-------|----------|
| "Speech Recognition not supported" | Old browser | Show fallback or typed chat |
| "Microphone access denied" | User blocked permission | Request permission in settings |
| "No speech detected" | Silent audio | Prompt user to speak louder |
| "Network error" | Internet issue | Retry or show offline mode |

### Backend Error Scenarios

| Error | Cause | Solution |
|-------|-------|----------|
| Google STT fails | API key invalid/quota | Fall back to frontend transcript |
| Google TTS fails | API key invalid | Use Piper TTS offline |
| Both TTS fail | No APIs configured | Send text-only response |
| Translation fails | API error | Proceed with original language |
| LLM fails | Gemini API error | Return error response |

---

## Performance Optimization

### Caching
- Audio files cached for 1 hour in `/audio` route
- Emotion analysis results cached in frontend
- Translation results could be cached (future improvement)

### Cleanup
- Old audio files deleted automatically (>24 hours old)
- Add periodic cleanup job:
  ```javascript
  setInterval(async () => {
    await cleanupOldAudioFiles(24);
  }, 6 * 60 * 60 * 1000); // Every 6 hours
  ```

### Optimization Tips
1. Use compression for audio files
2. Implement message pagination for chat history
3. Add request timeout handling
4. Batch translate if processing multiple messages

---

## Testing

### Manual Testing

```bash
# 1. Start backend
cd backend
npm run dev

# 2. Start frontend
cd frontend
npm run dev

# 3. Test in browser
# - Navigate to chat page
# - Click "Start Speaking"
# - Speak into microphone
# - See transcript update live
# - Click "Send"
# - Wait for AI response + audio
```

### API Testing with curl

```bash
# Test voice endpoint (requires audio file)
curl -X POST \
  -F "audio=@voice-sample.wav" \
  -F "transcript=Hello how are you?" \
  -F "userId=test-user" \
  -F "language=en-US" \
  http://localhost:8080/api/chat/voice

# Get chat sessions
curl http://localhost:8080/api/chat/sessions?userId=test-user

# Get session messages
curl http://localhost:8080/api/chat/sessions/session-uuid/messages?userId=test-user
```

### Example Test Cases

```javascript
describe('Voice Chat Feature', () => {
  it('should process voice message with STT and TTS', async () => {
    // Test transcript → emotion → LLM → audio
  });

  it('should handle multi-language voice input', async () => {
    // Test Spanish → English processing → Spanish output
  });

  it('should maintain context across voice messages', async () => {
    // Test that LLM uses recent messages for context
  });

  it('should fallback to text-only if TTS fails', async () => {
    // Test TTS error handling
  });

  it('should handle microphone permission denial', async () => {
    // Test permission flow
  });
});
```

---

## Deployment Considerations

### Production Setup

1. **API Keys Management**:
   - Store in environment variables or secrets manager
   - Never commit to git
   - Use separate keys for dev/prod

2. **Audio Storage**:
   - Consider using cloud storage (S3, GCS, Azure Blob)
   - Implement signed URLs for secure access
   - Set expiration for temporary URLs

3. **Scaling**:
   - Add Redis for audio file caching
   - Queue voice processing jobs with Bull/RabbitMQ
   - Use CDN for audio delivery

4. **Monitoring**:
   - Log voice processing errors
   - Track API usage and costs
   - Monitor STT/TTS latency
   - Set up alerts for API failures

5. **CORS & Security**:
   - Whitelist frontend domain in CORS
   - Validate user ID and session ownership
   - Implement rate limiting for voice uploads

---

## Future Enhancements

### Phase 2
- [ ] Custom voice synthesis voices
- [ ] Real audio file recording (not just Web Speech API)
- [ ] Voice emotion detection integration
- [ ] Multi-speaker support
- [ ] Voice command shortcuts

### Phase 3
- [ ] Voice cloning for personalized TTS
- [ ] Real-time streaming audio
- [ ] Voice activity detection (VAD)
- [ ] Noise cancellation
- [ ] Multilingual real-time translation

### Phase 4
- [ ] Mobile app native voice features
- [ ] Voice biometrics
- [ ] Speaker identification
- [ ] Accent adaptation
- [ ] Background audio filtering

---

## Troubleshooting

### Common Issues

**Q: "The audio endpoint returns 404"**
A: Ensure the audio serving middleware is added to `server.js`. Check that `/audio` route is configured before error handlers.

**Q: "Google TTS API returns 403"**
A: Check API key is valid and API is enabled in Google Cloud Console. Verify quota hasn't been exceeded.

**Q: "Web Speech API not working in my browser"**
A: Web Speech API requires HTTPS in production (except localhost). Enable in browser if disabled.

**Q: "Microphone permission prompt not showing"**
A: Check browser settings. User may have permanently denied permission. Clear site data and try again.

**Q: "Transcript not updating in real-time"**
A: Verify `interimResults: true` is set on recognition object. Check browser console for errors.

---

## References

- [Web Speech API MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)
- [Google Cloud Speech-to-Text](https://cloud.google.com/speech-to-text/docs)
- [Google Cloud Text-to-Speech](https://cloud.google.com/text-to-speech/docs)
- [Piper TTS GitHub](https://github.com/rhasspy/piper)
- [Express Static Files](https://expressjs.com/en/api/express.static.html)

---

## Support

For issues or questions:
1. Check this guide first
2. Review error logs in browser console (frontend) and terminal (backend)
3. Test individual components (STT, TTS, emotion, LLM)
4. Check API credentials and network connectivity

---

**Last Updated**: October 22, 2024
**Version**: 1.0.0
