# Voice Chat Quick Start Guide

## 🎙️ Voice Chat Feature - 5 Minute Setup

### ✅ What You Get
- **Real-time speech-to-text** (Web Speech API)
- **Emotion detection** from voice input
- **AI responses** with context awareness
- **Text-to-speech output** (Google or Piper)
- **Multi-language support** with auto-translation
- **Chat history** in Supabase

---

## 🚀 Quick Setup

### 1. Backend Setup (2 minutes)

```bash
cd backend

# Install dependencies (already done if you have node_modules)
npm install

# Add to .env (copy from .env.example and add):
API_BASE_URL=http://localhost:8080
CHAT_MEMORY_LENGTH=10

# Optional: Google Cloud voice APIs
GOOGLE_STT_API_KEY=your_api_key_here
GOOGLE_TTS_API_KEY=your_api_key_here

# Start backend
npm run dev
# Should see: ✅ Server running on port 8080
```

### 2. Frontend Setup (2 minutes)

```bash
cd frontend

# No new dependencies needed - already included

# Ensure .env.local has:
NEXT_PUBLIC_API_URL=http://localhost:8080

# Start frontend
npm run dev
# Should see: ▲ Ready in 123ms
```

### 3. Test Voice Feature (1 minute)

1. Open http://localhost:3000 in your browser
2. Navigate to chat page
3. Look for **"Voice Chat"** component
4. Click **"Start Speaking"** button
5. Speak something like: _"I'm feeling happy today!"_
6. Click **"Send"** after transcript appears
7. Listen to AI response + watch text appear

---

## 🎯 Component Usage

### Add to Your Chat Page

```tsx
// app/chat/page.tsx
import { VoiceChatComponent } from '@/components/chat/VoiceChatComponent';
import { useAuth } from '@supabase/auth-helpers-react';
import { useState } from 'react';

export default function ChatPage() {
  const { user } = useAuth();
  const [sessionId, setSessionId] = useState<string>();

  if (!user) {
    return <div>Please log in</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      <h1>Chat with MantrAI</h1>

      {/* Voice Chat Component */}
      <VoiceChatComponent
        userId={user.id}
        sessionId={sessionId}
        language="en-US"
        onMessageReceived={(response) => {
          console.log('AI said:', response.aiResponse.message);
          console.log('Audio URL:', response.audio?.url);
          // Update your chat UI here
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

---

## 🔧 Configuration

### Required Environment Variables

**Backend** (`.env`):
```bash
# Server
PORT=8080
API_BASE_URL=http://localhost:8080

# Chat
CHAT_MEMORY_LENGTH=10

# Optional: Google APIs (for high-quality STT/TTS)
GOOGLE_STT_API_KEY=your_key
GOOGLE_TTS_API_KEY=your_key

# Everything else from .env.example
```

**Frontend** (`.env.local`):
```bash
NEXT_PUBLIC_API_URL=http://localhost:8080
```

---

## 📝 API Reference

### Send Voice Message

**Endpoint**: `POST /api/chat/voice`

**Request** (multipart/form-data):
```javascript
const formData = new FormData();
formData.append('audio', audioFile); // File object
formData.append('transcript', 'Hello there'); // From Web Speech API
formData.append('userId', user.id); // Required
formData.append('sessionId', sessionId); // Optional
formData.append('language', 'en-US'); // Optional

const response = await fetch('/api/chat/voice', {
  method: 'POST',
  body: formData
});
```

**Response**:
```javascript
{
  success: true,
  data: {
    sessionId: "123",
    userMessage: {
      transcript: "Hello there",
      emotion: "neutral",
      confidence: 0.95
    },
    aiResponse: {
      message: "Hi! How can I help?",
      model: "gemini-2.5-flash"
    },
    audio: {
      url: "http://localhost:8080/audio/tts-123.mp3",
      duration: 2.5
    }
  }
}
```

---

## 🎤 Browser Support

| Browser | Support | Notes |
|---------|---------|-------|
| Chrome | ✅ Full | Best support |
| Firefox | ✅ Full | Works great |
| Safari | ✅ Full | iOS Safari 14.5+ |
| Edge | ✅ Full | Based on Chromium |
| IE 11 | ❌ No | Not supported |

---

## 🐛 Common Issues & Fixes

### Issue: "Microphone not working"

**Solutions**:
1. Check browser permissions (Click 🔒 in address bar)
2. Ensure HTTPS in production (HTTP works on localhost)
3. Grant microphone permission when prompted
4. Restart browser if permission stuck

### Issue: "No audio response"

**Reasons**:
1. Google TTS API key not configured → Will fallback to Piper (if installed)
2. Piper TTS not installed → Text-only response sent
3. Audio route not serving files → Check `/audio` folder exists

**Solution**: Check backend logs for errors

### Issue: "Component not appearing"

**Check**:
1. Component imported correctly: `import { VoiceChatComponent } from '@/components/chat/VoiceChatComponent'`
2. User ID is provided
3. No TypeScript errors in browser console

### Issue: "Translation not working"

**Check**:
1. Gemini API key set in backend `.env`
2. Internet connection working
3. Language code is valid (e.g., 'en', 'es', 'fr')

---

## 🚀 Advanced Usage

### Auto-play Response Audio

```tsx
<VoiceChatComponent
  userId={user.id}
  onMessageReceived={(response) => {
    // Audio auto-plays, but you can control it:
    if (response.audio?.url) {
      const audio = new Audio(response.audio.url);
      audio.play();
    }
  }}
/>
```

### Custom Language Support

```tsx
<VoiceChatComponent
  userId={user.id}
  language="es-ES"  // Spanish
  // or: fr-FR, de-DE, ja-JP, zh-CN, etc.
/>
```

### Handle Voice Errors Gracefully

```tsx
<VoiceChatComponent
  userId={user.id}
  onError={(error) => {
    if (error === 'no-speech') {
      toast.error('Please speak louder');
    } else if (error === 'microphone_denied') {
      toast.error('Please allow microphone access');
    } else {
      toast.error(`Voice error: ${error}`);
    }
  }}
/>
```

### Get Session Context

```tsx
const [sessionId, setSessionId] = useState<string>();

<VoiceChatComponent
  userId={user.id}
  sessionId={sessionId}
  onMessageReceived={(response) => {
    // First message creates session
    if (!sessionId && response.sessionId) {
      setSessionId(response.sessionId);
    }
  }}
/>
```

---

## 📊 Logging & Debugging

### Enable Detailed Logging

**Backend**: Check logs for each processing step
```
🎙️ Processing voice message for user: user123
📝 Transcript: "Hello"
🌐 Language detection: en (English)
🔤 Analyzing emotion from transcript...
✅ Emotion detected: neutral (confidence: 0.95)
🤖 Generating AI response...
🔊 Generating audio response with TTS...
✅ Audio response generated
🎉 Voice message processing completed successfully
```

**Frontend**: Check browser console
```javascript
// VoiceChatComponent logs:
console.log('🎤 Processing voice message to backend...');
console.log('✅ Voice message processed successfully');
console.log('🔊 Playing response...');
```

### Enable Backend Debug Mode

```bash
# In backend .env
LOG_LEVEL=debug
NODE_ENV=development

# Restart backend
npm run dev
```

---

## 📈 Performance Tips

1. **Enable Piper for offline TTS**: Download from GitHub releases
2. **Cache audio files**: Already set to 1 hour
3. **Use compression**: Audio files are already compressed
4. **Lazy load component**: Only show voice chat when needed
5. **Batch messages**: Don't send every interim result

---

## 🔐 Security Notes

- Microphone permission is **browser-level** (user controls)
- Audio files expire after 1 hour (automatic cleanup)
- User can only access their own messages (Supabase RLS)
- API keys stored server-side only (not sent to frontend)

---

## 📚 Full Documentation

For complete implementation details, see:
[VOICE_CHAT_IMPLEMENTATION.md](./VOICE_CHAT_IMPLEMENTATION.md)

---

## ✨ What's Included

| Component | Location | Status |
|-----------|----------|--------|
| Voice Component | `frontend/components/chat/VoiceChatComponent.tsx` | ✅ Ready |
| Voice Helper | `backend/src/utils/voiceHelper.js` | ✅ Ready |
| Chat Route | `backend/src/routes/chatRoutes.js` | ✅ Updated |
| Server Config | `backend/src/server.js` | ✅ Updated |
| API Helper | `frontend/lib/api.ts` | ✅ Updated |
| Documentation | `VOICE_CHAT_IMPLEMENTATION.md` | ✅ Ready |

---

## 🎓 Example Conversations

### Example 1: English
```
User: "I'm feeling sad today"
AI: "I understand. Sadness can be tough. Would you like to talk about what's on your mind?"
Audio: [Plays AI response in English]
Saved: Chat session with emotion detection
```

### Example 2: Spanish
```
User: "Me siento feliz hoy" (I feel happy today)
Backend: Detects Spanish → Translates to English → Processes → Translates back to Spanish
AI: "¡Qué bueno! La felicidad es contagiosa. ¿Qué te hizo tan feliz?"
Audio: [Plays in Spanish]
```

### Example 3: Multi-turn Conversation
```
User: "I had a tough day at work"
AI: "I'm sorry to hear that. What happened?"
[Context: LLM remembers first message]

User: "My boss was harsh"
AI: "That must have been frustrating. How are you feeling now?"
[Context: LLM uses both previous messages]
```

---

## 🎉 You're Ready!

Start the backend and frontend, then try the voice feature. Report any issues or suggestions!

**Questions?** Check the full documentation or review component source code.

---

**Last Updated**: October 22, 2024
**Version**: 1.0.0
