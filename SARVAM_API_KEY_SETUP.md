# 🔑 How to Get Your Sarvam AI API Key

## Quick Steps

### 1. Visit Sarvam AI Platform
Go to: https://www.sarvam.ai/

### 2. Sign Up / Login
- Click "Get Started" or "Sign In"
- Create an account with your email
- Verify your email address

### 3. Access Developer Console
- Navigate to your dashboard
- Look for "API Keys" or "Developer" section
- Click "Generate New API Key"

### 4. Copy Your API Key
- Copy the generated API key
- Store it securely (you may not be able to see it again)

### 5. Add to Your Project
Edit `backend/.env` file:

```env
SARVAM_API_KEY=your_actual_api_key_here
```

Replace `your_actual_api_key_here` with the key you copied.

### 6. Restart Backend
```bash
cd backend
npm start
```

---

## ⚠️ Important Notes

1. **Keep it Secret**: Never commit API keys to Git
2. **Free Tier**: Sarvam AI may offer a free tier for testing
3. **Rate Limits**: Check your plan's rate limits
4. **Billing**: Configure billing if needed for production use

---

## 🧪 Test After Setup

Run the test script:
```bash
cd backend
node test-sarvam-tts.js
```

If successful, you'll see:
```
✅ TTS Success!
   Provider: sarvam
   Format: wav
   Audio size: XXXXX bytes
```

---

## 📞 Need Help?

- **Documentation**: https://docs.sarvam.ai/
- **Support**: Contact Sarvam AI support team
- **Community**: Check their Discord/Slack if available

---

**Next Steps**: Once you have the API key, your dual-layer TTS system will be fully operational! 🎉
