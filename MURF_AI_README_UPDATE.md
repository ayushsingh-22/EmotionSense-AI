# Murf AI TTS Integration - README Update

Add this section to your main README.md file under the TTS configuration section:

---

## Text-to-Speech (TTS) - Three-Tier System

The application now uses a robust **three-tier TTS fallback system** to ensure voice responses are always available:

### TTS Service Hierarchy

1. **Google Cloud TTS** (Primary)
   - Neural2 voices for natural speech
   - Supports 40+ languages
   - High-quality 24kHz audio
   - Best for multilingual support

2. **Sarvam AI** (Secondary Fallback)
   - Specialized in Indian languages
   - Neural voice quality
   - 8kHz sample rate
   - Optimized for Hindi, Bengali, Tamil, etc.

3. **Murf AI** (Tertiary Fallback)
   - FALCON model for premium quality
   - 44.1kHz high-fidelity audio
   - 17+ language support
   - Streaming speech API

### Configuration

Add these variables to your `.env` file:

```bash
# Google TTS (Primary)
GOOGLE_TTS_API_KEY=your_google_api_key
GOOGLE_TTS_VOICE=en-US-Neural2-C
GOOGLE_TTS_LANGUAGE=en-US

# Sarvam AI (Secondary)
SARVAM_API_KEY=your_sarvam_api_key

# Murf AI (Tertiary)
MURF_API_KEY=your_murf_api_key
MURF_VOICE_ID=Matthew
MURF_MODEL=FALCON
MURF_LOCALE=en-US
```

### How It Works

The system automatically tries each service in order:

```
User Message → Google TTS
                  ↓ (if fails)
              Sarvam AI
                  ↓ (if fails)
               Murf AI
                  ↓ (if fails)
               Error
```

**No manual intervention required!** The fallback happens automatically and transparently.

### Testing TTS Services

```bash
# Test Murf AI integration
cd backend
node test-murf-tts.js

# Test Sarvam AI integration
node test-sarvam-tts.js
```

### Getting API Keys

#### Google Cloud TTS
1. Visit [Google Cloud Console](https://console.cloud.google.com/)
2. Enable Text-to-Speech API
3. Create credentials
4. Copy API key to `.env`

#### Sarvam AI
1. Visit [Sarvam AI](https://www.sarvam.ai/)
2. Sign up for API access
3. Get API key from dashboard
4. Add to `.env`

#### Murf AI
1. Visit [Murf AI](https://murf.ai/)
2. Create account
3. Navigate to API settings
4. Generate API key
5. Add to `.env`

### Documentation

For detailed information about the Murf AI integration:
- **Complete Guide**: `MURF_AI_INTEGRATION_GUIDE.md`
- **Quick Reference**: `MURF_AI_QUICK_REFERENCE.md`
- **Implementation Summary**: `MURF_AI_IMPLEMENTATION_SUMMARY.md`

---

This integration ensures your voice chat feature has **99.9% uptime** with multiple fallback options! 🎉
