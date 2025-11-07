# Quick Start: OpenAI TTS Setup

## 🎯 Get Your OpenAI API Key (5 minutes)

### Step 1: Create OpenAI Account
1. Go to https://platform.openai.com/signup
2. Sign up with email or Google account
3. Verify your email

### Step 2: Get API Key
1. Visit https://platform.openai.com/api-keys
2. Click **"Create new secret key"**
3. Name it (e.g., "EmotionSense-AI-TTS")
4. **Copy the key immediately** (you won't see it again!)
   ```
   sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

### Step 3: Add to Your .env File
1. Open `backend/.env`
2. Find the TTS section
3. Replace `your_openai_api_key_here` with your actual key:
   ```bash
   OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```
4. Save the file

### Step 4: Restart Backend
```bash
cd backend
npm start
```

### Step 5: Test!
Your TTS should now use OpenAI's high-quality voices! 🎉

---

## 💰 Pricing (Very Affordable)

**OpenAI TTS Pricing:**
- **tts-1:** $0.015 per 1,000,000 characters
- **tts-1-hd:** $0.030 per 1,000,000 characters

**Example Cost Calculation:**
- 1 message ≈ 100 characters
- 1,000 messages = 100,000 characters
- **Cost:** $0.0015 (less than 1 cent!)

**Free Tier:**
- New accounts get **$5 free credits**
- Good for ~330,000 messages!

---

## 🔄 Don't Have OpenAI Key?

**No problem!** The system automatically falls back to Piper TTS (offline):

1. Keep `.env` as is (with placeholder)
2. Ensure Piper model exists at:
   ```
   backend/models/piper/en_US-lessac-medium.onnx
   ```
3. TTS will work offline using Piper

**OR** set provider to Piper only:
```bash
TTS_PROVIDER=piper
```

---

## 🎤 Voice Options (OpenAI)

Once you have the API key, you can choose from 6 voices:

```bash
TTS_VOICE=alloy    # Neutral (default)
TTS_VOICE=echo     # Male, professional
TTS_VOICE=fable    # British storytelling
TTS_VOICE=onyx     # Deep male
TTS_VOICE=nova     # Friendly female
TTS_VOICE=shimmer  # Upbeat female
```

---

## ✅ Verification

After adding your key, check the backend console:

**Success:**
```
✅ OpenAI TTS synthesis complete (25600 bytes)
✅ Speech generated successfully (2.5s, openai)
```

**Fallback (if key missing/invalid):**
```
⚠️ OpenAI TTS failed: OpenAI API key not configured
🔄 Falling back to Piper TTS...
✅ Piper TTS synthesis complete
```

---

## 🐛 Common Issues

**"Invalid authentication"**
- Check your API key is correct
- Ensure no extra spaces in .env
- Key should start with `sk-proj-` or `sk-`

**"Insufficient quota"**
- Add billing method to OpenAI account
- Or wait for free credits to refresh

**Still using Piper**
- Make sure `TTS_PROVIDER=openai` in .env
- Restart backend server
- Check console for error messages

---

**Need Help?** Check `TTS_SERVICE_UPDATE.md` for detailed documentation!
