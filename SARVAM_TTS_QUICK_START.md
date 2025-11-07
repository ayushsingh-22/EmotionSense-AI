# 🚀 Quick Start: Sarvam AI TTS Integration

## ⚡ 3-Minute Setup

### Step 1: Install Dependencies ✅
Already done! The `sarvamai` package is installed.

### Step 2: Get API Key (2 minutes)

1. Go to: **https://www.sarvam.ai/**
2. Click **"Sign Up"** or **"Get Started"**
3. Verify your email
4. Navigate to **Dashboard → API Keys**
5. Click **"Generate New Key"**
6. **Copy the key** 📋

### Step 3: Add to Environment (30 seconds)

Edit `backend/.env`:

```env
SARVAM_API_KEY=paste_your_key_here
```

Save the file.

### Step 4: Restart Backend (10 seconds)

```bash
cd backend
npm start
```

### Step 5: Test It! (30 seconds)

```bash
cd backend
node test-sarvam-tts.js
```

---

## ✅ Done!

You now have **dual-layer TTS**:
- ✅ Google TTS (primary)
- ✅ Sarvam AI (fallback)
- ✅ Automatic language detection
- ✅ Seamless failover

---

## 🎯 How to Test

### Test Voice Chat

1. Open your app
2. Start a voice conversation
3. Speak in Hindi: **"नमस्ते, आप कैसे हैं?"**
4. The response will be in Hindi (Google or Sarvam)

### Force Sarvam Fallback

Temporarily disable Google TTS to test Sarvam:

```env
# In backend/.env
GOOGLE_TTS_API_KEY=disabled_for_testing
```

Restart backend → All TTS will use Sarvam AI.

---

## 📊 Check Logs

Backend will show which provider is used:

```
✅ Speech generated successfully (3.2s, google)
```

Or if fallback:

```
⚠️ Google TTS failed, switching to Sarvam AI fallback...
✅ Speech generated successfully (3.5s, sarvam)
```

---

## 🎉 That's It!

Your multilingual TTS with Sarvam AI fallback is **ready to use**!

Need help? See:
- **`SARVAM_TTS_INTEGRATION_GUIDE.md`** - Full technical guide
- **`SARVAM_API_KEY_SETUP.md`** - Detailed API key setup
- **`SARVAM_TTS_IMPLEMENTATION_SUMMARY.md`** - Complete summary

---

**Next**: Test with real users in multiple languages! 🌍
