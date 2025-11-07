# 🚀 Quick Start: Multilingual Voice Chat

## Prerequisites

### 1. API Keys Required
```bash
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxx
GOOGLE_TTS_API_KEY=AIzaSyxxxxxxxxxxxxxxxxxxxxx
GEMINI_API_KEY=AIzaSyxxxxxxxxxxxxxxxxxxxxx
```

### 2. Get Your API Keys

#### Groq API (Whisper + LLM)
1. Go to https://console.groq.com/
2. Sign up / Log in
3. Navigate to API Keys
4. Create new API key
5. Copy and save securely

#### Google TTS API
1. Go to https://console.cloud.google.com/
2. Create new project (or select existing)
3. Enable "Cloud Text-to-Speech API"
4. Create credentials → API Key
5. Copy and save securely

#### Gemini API (Translation Fallback)
1. Go to https://aistudio.google.com/
2. Sign in with Google account
3. Click "Get API Key"
4. Create new API key
5. Copy and save securely

## Setup Steps

### Step 1: Configure Backend
```bash
cd backend

# Edit .env file
nano .env  # or use your preferred editor

# Add these lines:
GROQ_API_KEY=your_groq_key_here
GOOGLE_TTS_API_KEY=your_google_tts_key_here
GEMINI_API_KEY=your_gemini_key_here

# Save and exit
```

### Step 2: Install Dependencies (if not already done)
```bash
npm install
```

### Step 3: Start Backend
```bash
npm run dev
# Should see: Server running on http://localhost:8080
```

### Step 4: Start Frontend
```bash
cd ../frontend
npm run dev
# Should see: Ready on http://localhost:3000
```

## Testing Multilingual Voice Chat

### Test 1: Hindi Conversation 🇮🇳

1. Open http://localhost:3000/chat
2. Navigate to "Voice Chat" tab
3. Click "Start Recording"
4. Speak in Hindi: **"मुझे आज बहुत खुशी हो रही है"**
5. Click "Stop Recording"
6. Wait for transcription (~2-3s)
7. **Expected**: 
   - Transcription shows Hindi text
   - Toast says "Language: Hindi"
   - AI response comes in Hindi
   - Audio plays in Hindi voice

### Test 2: Spanish Conversation 🇪🇸

1. Click "Start Recording"
2. Speak in Spanish: **"Me siento muy feliz hoy"**
3. Click "Stop Recording"
4. **Expected**:
   - Transcription shows Spanish text
   - AI response in Spanish
   - Spanish voice playback

### Test 3: French Conversation 🇫🇷

1. Click "Start Recording"
2. Speak in French: **"Je me sens un peu triste"**
3. Click "Stop Recording"
4. **Expected**:
   - French transcription
   - French AI response
   - French voice output

## What Should Happen

### 1. During Recording
- Microphone icon turns red
- Timer shows recording duration
- Status: "Recording... speak now"

### 2. After Stopping
- "Processing..." message appears
- Transcription request sent to backend
- ~2-3 seconds wait

### 3. Transcription Complete
- Toast notification: "🎤 Voice Recorded"
- Shows: "Language: [Hindi/Spanish/etc]"
- Text appears in transcript box
- Language detection displayed

### 4. Processing Voice Message
- Click "Send" button
- "Processing..." status
- Backend flow:
  1. Whisper detects language (1-3s)
  2. Translates to English (0.5-1s)
  3. LLM generates response (2-4s)
  4. Translates back to user language (0.5-1s)
  5. TTS generates audio (1-2s)

### 5. Response Received
- Multilingual mode indicator appears
- Shows:
  - "🌐 Multilingual Mode Active"
  - "Detected: [Language]"
  - "Input: Translated to English for processing"
  - "Output: Translated back to [Language]"
  - "Voice: Audio response in [Language]"
- Audio automatically plays
- Text response shows in chat

## Verify It's Working

### ✅ Check Console Logs (Backend)
```bash
# You should see:
🎙️ Processing multilingual voice message for user: user123
🎤 Transcribing audio with Groq Whisper (auto-detect language)...
✅ Whisper transcription: "मुझे आज बहुत खुशी हो रही है"
🌐 Detected language from Whisper: hi (Hindi)
🔄 Translating to English if needed...
✅ Final language detection: hi (Hindi)
📝 English translation for processing: "I am very happy today"
🤖 Generating AI response with conversation context...
✅ AI response generated
🔄 Translating AI response back to Hindi...
✅ Response translated back to user's language
🔊 Generating audio response with TTS...
🔊 Generating speech using Google TTS (language: hi-IN, voice: hi-IN-Neural2-C)...
✅ TTS conversion complete
📤 Preparing multilingual response to frontend:
```

### ✅ Check Console Logs (Frontend)
```javascript
// You should see:
📝 Transcription received: मुझे आज बहुत खुशी हो रही है
🌐 Language detected: hi
✅ Voice message processed successfully
🌐 Multilingual conversation:
  - User language: Hindi
  - User text: मुझे आज बहुत खुशी हो रही है
  - English translation: I am very happy today
  - AI English response: That's wonderful! I'm so glad...
  - AI translated response: यह बहुत अच्छा है! मुझे यह सुनकर...
🔊 Playing audio response in Hindi
```

### ✅ Check Network Tab
1. Open DevTools (F12)
2. Go to Network tab
3. Should see:
   - POST `/api/chat/transcribe` → Status 200
   - POST `/api/chat/voice` → Status 200
   - GET `/audio/tts-xxx.mp3` → Status 200

## Troubleshooting

### Problem: "Microphone access denied"
**Solution**:
- Check browser permissions
- Click microphone icon in address bar
- Allow microphone access
- Refresh page

### Problem: "Transcription failed"
**Solution**:
- Check Groq API key in backend/.env
- Verify API key is active on Groq console
- Check backend logs for error details

### Problem: "No audio output"
**Solution**:
- Check Google TTS API key
- Verify API is enabled in Google Cloud Console
- Check browser audio is not muted
- Look for audio file in Network tab

### Problem: "Translation not working"
**Solution**:
- Check Gemini API key (used as fallback)
- Verify Google Translate is accessible
- Check backend logs for translation errors

### Problem: "Wrong language detected"
**Solution**:
- Speak clearly and slowly
- Ensure good microphone quality
- Try recording again
- Check if language is supported by Whisper

## Example Test Script

```javascript
// Test in browser console (Frontend)
async function testVoiceChat() {
  // This would be triggered by UI buttons
  console.log('Starting voice chat test...');
  
  // 1. Record audio (simulated)
  console.log('🎤 Recording audio...');
  
  // 2. Transcribe
  console.log('📝 Transcribing...');
  
  // 3. Send to backend
  const response = await fetch('/api/chat/voice', {
    method: 'POST',
    body: formData
  });
  
  const data = await response.json();
  console.log('✅ Response:', data);
  
  // Check multilingual fields
  if (data.data.language.inputTranslated) {
    console.log('🌐 MULTILINGUAL MODE ACTIVE');
    console.log('User language:', data.data.language.name);
    console.log('Translations working: ✅');
  }
  
  // Check audio
  if (data.data.audio?.url) {
    console.log('🔊 Audio URL:', data.data.audio.url);
    console.log('Audio language:', data.data.audio.language);
  }
}
```

## Success Indicators

### ✅ Everything Working If You See:
1. ✅ Transcription appears in correct language
2. ✅ "Language: [Hindi/Spanish/etc]" toast
3. ✅ "🌐 Multilingual Mode Active" indicator
4. ✅ AI response in same language as input
5. ✅ Audio plays in correct language voice
6. ✅ No error messages in console
7. ✅ Both versions logged (original + English)

## Next Steps

### Test More Languages
- Try Tamil: "எனக்கு மகிழ்ச்சியாக இருக்கிறது"
- Try German: "Ich bin heute sehr glücklich"
- Try Arabic: "أنا سعيد جداً اليوم"
- Try Japanese: "今日はとても嬉しいです"

### Advanced Testing
- Test language switching mid-conversation
- Test code-switching (mixing languages)
- Test with background noise
- Test with accents
- Test very long sentences

### Production Deployment
- Set up environment variables in production
- Configure CORS for API access
- Set up rate limiting
- Monitor API usage and costs
- Set up error tracking (Sentry)

## Cost Estimation

### API Costs (Free Tiers)
- **Groq**: Free tier (30 requests/min)
- **Google TTS**: $4 per 1M characters
- **Gemini**: Free tier (60 requests/min)

### Example Usage Cost
- 100 voice messages/day
- Average 50 chars response
- = 5,000 chars/day
- = 150,000 chars/month
- = **$0.60/month** (Google TTS only)

## Support

Having issues? Check:
1. ✅ All API keys configured correctly
2. ✅ Backend running on port 8080
3. ✅ Frontend running on port 3000
4. ✅ Microphone permissions granted
5. ✅ Console logs for error details

For detailed documentation, see:
- `MULTILINGUAL_VOICE_CHAT.md` - Full technical documentation
- `MULTILINGUAL_VOICE_CHAT_SUMMARY.md` - Implementation summary

---

**Ready to test?** Start recording and speak in any language! 🎤🌐
