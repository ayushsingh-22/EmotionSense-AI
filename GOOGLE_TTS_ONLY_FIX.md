# 🎯 Google TTS Only Configuration - Complete Guide

## 📋 What Was Changed

I've updated your voice chat system to **ONLY use Google TTS** and removed all Piper TTS fallback logic.

### ✅ Files Modified

1. **`backend/src/tts-service/index.js`**
   - Removed all Piper TTS fallback logic
   - Updated `generateSpeech()` function to only use Google TTS
   - Added better error handling for Google API key issues
   - Now throws descriptive errors instead of falling back to Piper

### 🗑️ What Was Removed

- ❌ Piper TTS fallback in `generateSpeech()` function
- ❌ Automatic fallback when Google TTS fails
- ❌ Unicode workaround logic for Piper

### ⚠️ What Still Exists (Can be removed if you want)

The following Piper-related code still exists in the file but is **NOT USED** anymore:
- `generateSpeechPiper()` function (lines 187-268)
- `checkPiperModel()` function (lines 162-176)
- `estimateDuration()` helper function (used by both Google and Piper)

You can safely remove these later, but they won't affect functionality.

---

## 🚨 CRITICAL ISSUE: Google TTS API Key Expired

### Current Error
```
Google TTS Error: 400 - Bad Request
Error: API key expired. Please renew the API key.
```

### Your Current API Key
```
GOOGLE_TTS_API_KEY=AIzaSyBYOE_x_h8Dmj2dHllHxLjPf1OCBcJjmoE
```
**Status**: ❌ EXPIRED

---

## 🔧 How to Get a New Google TTS API Key

### Option 1: Renew Existing API Key (Recommended)

1. **Go to Google Cloud Console**
   - Visit: https://console.cloud.google.com/

2. **Select Your Project**
   - Click on project dropdown at top
   - Select the project that has this API key

3. **Navigate to API Credentials**
   - Go to: **APIs & Services** → **Credentials**
   - Or direct link: https://console.cloud.google.com/apis/credentials

4. **Find Your API Key**
   - Look for API key ending in `...jmoE`
   - Click on the key name to edit

5. **Check Restrictions**
   - Make sure **Cloud Text-to-Speech API** is enabled
   - Check if there are any quota/billing issues

6. **Regenerate if Needed**
   - If key is truly expired, click **Regenerate Key**
   - Copy the new key immediately

### Option 2: Create New API Key

1. **Go to Google Cloud Console**
   - Visit: https://console.cloud.google.com/

2. **Create/Select Project**
   - Create new project or select existing one

3. **Enable Cloud Text-to-Speech API**
   - Go to: **APIs & Services** → **Library**
   - Search for "Cloud Text-to-Speech API"
   - Click **Enable**

4. **Create Credentials**
   - Go to: **APIs & Services** → **Credentials**
   - Click **+ CREATE CREDENTIALS** → **API Key**
   - Copy the generated API key

5. **Configure API Key (Important!)**
   - Click on the key you just created
   - Under **API restrictions**, select **Restrict key**
   - Check: **Cloud Text-to-Speech API**
   - Click **Save**

6. **Enable Billing (Required)**
   - Google TTS requires billing enabled
   - Go to: **Billing** → **Link a billing account**
   - Add payment method

### Option 3: Use Free Tier

- Google Cloud offers **$300 free credits** for new users
- Cloud Text-to-Speech has a **free tier**:
  - First 1 million characters/month are FREE
  - Standard voices: $4 per 1 million characters after that
  - WaveNet voices: $16 per 1 million characters

---

## 🔑 Update Your API Key

### Step 1: Edit .env File

```bash
# Open backend/.env
cd backend
notepad .env
```

### Step 2: Replace the API Key

```env
# OLD (expired):
GOOGLE_TTS_API_KEY=AIzaSyBYOE_x_h8Dmj2dHllHxLjPf1OCBcJjmoE

# NEW (replace with your new key):
GOOGLE_TTS_API_KEY=AIzaSy_YOUR_NEW_API_KEY_HERE
```

### Step 3: Make Sure Provider is Set to Google

```env
TTS_PROVIDER=google
```

### Step 4: Save and Restart Backend

```bash
# Stop backend (Ctrl+C in terminal)
# Start again
npm start
```

---

## ✅ What Happens Now

### ✅ With Valid Google API Key

```
User speaks in Hindi → Groq Whisper STT → Text Emotion Analysis → 
Google Gemini LLM → Google TTS (Hindi voice) → Audio Response
```

**Supported Languages** (all via Google TTS):
- 🇮🇳 Hindi (hi-IN)
- 🇮🇳 Tamil (ta-IN)
- 🇮🇳 Telugu (te-IN)
- 🇮🇳 Bengali (bn-IN)
- 🇮🇳 Marathi (mr-IN)
- 🇮🇳 Gujarati (gu-IN)
- 🇮🇳 Kannada (kn-IN)
- 🇮🇳 Malayalam (ml-IN)
- 🇮🇳 Punjabi (pa-IN)
- 🇬🇧 English (en-IN, en-US, en-GB)

### ❌ If Google TTS Fails

**Before (old code)**:
```
Google TTS fails → Falls back to Piper → Hindi causes Unicode error
```

**Now (new code)**:
```
Google TTS fails → Throws descriptive error → No audio returned
```

**Error Message**:
```json
{
  "error": "Google TTS failed: API key expired. Please check your API key in .env file."
}
```

---

## 🧹 Optional Cleanup (Remove Piper Completely)

If you want to remove all Piper-related code:

### 1. Remove Piper Functions from TTS Service

Edit `backend/src/tts-service/index.js` and remove:
- `checkPiperModel()` function (lines ~162-176)
- `generateSpeechPiper()` function (lines ~187-268)

### 2. Remove Piper Config from .env

```env
# Remove these lines:
# PIPER_MODEL_PATH=./models/piper/en_US-lessac-medium.onnx
# PIPER_CONFIG_PATH=./models/piper/en_US-lessac-medium.onnx.json
# PIPER_SPEAKER_ID=0
```

### 3. Remove Piper Config from config/index.js

Edit `backend/src/config/index.js` and remove Piper configuration section.

### 4. Delete Piper Models

```bash
# Delete piper models folder
rm -rf backend/models/piper/
```

---

## 🧪 Testing the Fix

### 1. Make Sure Database is Fixed First

Run the database migration if you haven't already:

```sql
-- In Supabase SQL Editor:
-- Run the content of SIMPLE_DATABASE_FIX.sql
```

### 2. Update Google API Key

Update `backend/.env` with new API key.

### 3. Restart Backend

```bash
cd backend
npm start
```

### 4. Test Voice Chat

1. Open your app in browser
2. Go to chat section
3. Click microphone icon
4. Speak in **Hindi** or any supported language
5. Check terminal logs:

**Expected (Success)**:
```
🎙️ Converting text to speech...
🌐 Using Google TTS with multilingual support...
   Language: hi-IN
   API Key: AIzaSy_NEW...KEY
✅ Speech generated successfully (3.2s, google)
```

**Expected (Expired Key)**:
```
❌ Google TTS failed:
   Error: API key expired. Please renew the API key.
```

---

## 📊 Current System Configuration

### Voice Chat Flow
```
1. User speaks (any supported language)
   ↓
2. Groq Whisper STT (auto-detects language)
   ↓
3. Text Emotion Analysis (BiLSTM + HuggingFace)
   ↓
4. Google Gemini LLM (generates response)
   ↓
5. Google TTS (speaks in user's language)
   ↓
6. Audio plays in browser
```

### NO Voice Emotion Analysis in Chat
- Voice emotion model is **NOT** used in chat flow
- Only text emotion analysis is used
- Voice emotion is only in `/api/analyze/voice` endpoint

### ONLY Google TTS
- No Piper fallback
- No offline TTS
- If Google fails, chat returns error

---

## 🎯 Summary of All Fixes

### ✅ Completed

1. **Database Schema** - Added `created_at` and `input_text` columns
2. **Voice Emotion Model** - Fixed .env to use correct audio model
3. **Frontend Button** - Removed nested button structure
4. **Frontend Endpoint** - Changed to `/api/chat/voice`
5. **TTS Service** - Removed Piper fallback, Google TTS only

### ⏳ Pending (Your Action Required)

1. **Run Database Migration** - Execute `SIMPLE_DATABASE_FIX.sql` in Supabase
2. **Get New Google API Key** - Follow guide above
3. **Update .env** - Add new API key to `backend/.env`
4. **Test Complete Flow** - Test voice chat with new API key

---

## 🆘 Troubleshooting

### Issue: "Google TTS API key is not configured"

**Fix**: Make sure `GOOGLE_TTS_API_KEY` in `.env` is:
- Not empty
- Not the placeholder `your_google_tts_api_key_here`
- A valid API key (starts with `AIzaSy`)

### Issue: "API key expired"

**Fix**: Get new API key from Google Cloud Console (see guide above)

### Issue: "Cloud Text-to-Speech API has not been used"

**Fix**: 
1. Go to https://console.cloud.google.com/apis/library
2. Search "Cloud Text-to-Speech API"
3. Click **Enable**

### Issue: "Billing must be enabled"

**Fix**: 
1. Go to https://console.cloud.google.com/billing
2. Link a billing account
3. Add payment method
4. Use free tier ($300 credits for new users)

---

## 📞 Next Steps

1. **Get new Google TTS API key** (follow guide above)
2. **Update backend/.env** with new key
3. **Run database migration** (SIMPLE_DATABASE_FIX.sql)
4. **Restart backend**
5. **Test voice chat** with Hindi/Tamil/other languages
6. **Confirm everything works**

Once you get the new API key, your voice chat will work perfectly! 🎉
