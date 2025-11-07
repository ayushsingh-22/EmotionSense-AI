# Gemini API Key Fix Guide

## Problem Summary
Your Gemini API integration was failing due to two issues:

1. **Expired API Key**: `GEMINI_API_KEY1` has expired and needs renewal
2. **Wrong Model Name**: Code was hardcoded to use deprecated `gemini-pro` model instead of the configured models

## Issues Fixed ✅

### 1. Updated LLM Service (`backend/src/llm-service/index.js`)
**Before:**
```javascript
const model = genAI.getGenerativeModel({ model: "gemini-pro" }); // ❌ Deprecated model
```

**After:**
```javascript
// ✅ Uses models from config with fallback
const models = config.gemini.models || ['gemini-2.0-flash-exp', 'gemini-1.5-flash'];
for (const modelName of models) {
  const model = genAI.getGenerativeModel({ model: modelName, generationConfig });
  // Try each model until one works
}
```

### 2. Updated Translation Helper (`backend/src/utils/translationHelper.js`)
**Before:**
```javascript
const genAI = new GoogleGenerativeAI(config.gemini.apiKey); // ❌ Single key, no fallback
```

**After:**
```javascript
// ✅ Helper function with API key fallback
const getGeminiModel = (modelName = 'gemini-2.0-flash-exp') => {
  const apiKey = config.gemini.apiKey1 || config.gemini.apiKey2 || config.gemini.apiKey;
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model: modelName });
};
```

### 3. Updated Config (`backend/src/config/index.js`)
Added backward compatibility:
```javascript
gemini: {
  apiKey: process.env.GEMINI_API_KEY1 || process.env.GEMINI_API_KEY2, // Fallback chain
  apiKey1: process.env.GEMINI_API_KEY1,
  apiKey2: process.env.GEMINI_API_KEY2,
  models: [
    'gemini-2.0-flash-exp',  // ✅ Latest experimental model
    'gemini-2.0-flash',      // ✅ Stable 2.0 model
    'gemini-1.5-flash',      // ✅ Fast 1.5 model
    'gemini-1.5-pro'         // ✅ Most capable 1.5 model
  ]
}
```

## How to Get New Gemini API Keys 🔑

### Step 1: Visit Google AI Studio
Go to: **https://aistudio.google.com/app/apikey**

### Step 2: Sign In
- Use your Google account
- Accept the terms of service if prompted

### Step 3: Create API Key
1. Click **"Create API Key"** or **"Get API Key"**
2. Select an existing Google Cloud project or create a new one
3. Click **"Create API key in new project"** (recommended)
4. Copy the generated API key (starts with `AIza...`)

### Step 4: Update Your .env File
Replace the old keys in `backend/.env`:

```properties
# Gemini API Configuration (Primary LLM)
GEMINI_API_KEY1=YOUR_NEW_API_KEY_HERE
GEMINI_API_KEY2=YOUR_SECOND_API_KEY_HERE  # Optional: Get a second key for redundancy

GEMINI_MODEL=gemini-2.5-flash
GEMINI_API_URL=https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent
```

### Step 5: Verify Models Available
Current supported models (in fallback order):
- ✅ `gemini-2.0-flash-exp` - Experimental, latest features
- ✅ `gemini-2.0-flash` - Stable, fast responses
- ✅ `gemini-1.5-flash` - Lightweight, quick
- ✅ `gemini-1.5-pro` - Most capable, slower

## Testing Your Fix

### 1. Restart Backend Server
```bash
cd backend
npm start
```

### 2. Test Chat Endpoint
Try sending a message through your frontend or use curl:
```bash
curl -X POST http://localhost:8080/api/chat/message \
  -H "Content-Type: application/json" \
  -d '{"text": "I feel happy today!", "userId": "test-user"}'
```

### 3. Expected Output
You should see in the logs:
```
🤖 Attempting Gemini API Key 1 with model: gemini-2.0-flash-exp
✅ Gemini response generated with gemini-2.0-flash-exp (API Key 1)
```

Instead of:
```
❌ First API key failed: API key expired
❌ Second API key failed: models/gemini-pro is not found
```

## How the Fallback System Works

### Multi-Layer Fallback Strategy:
1. **Try API Key 1** with all models in order
   - gemini-2.0-flash-exp
   - gemini-2.0-flash
   - gemini-1.5-flash
   - gemini-1.5-pro

2. **If Key 1 fails**, try **API Key 2** with all models

3. **If all Gemini attempts fail**, fall back to **LLaMA via Groq**

This ensures maximum reliability and uptime for your chat feature!

## Benefits of This Fix

✅ **Uses Latest Models**: No more deprecated `gemini-pro`  
✅ **Automatic Fallback**: Tries multiple models and keys automatically  
✅ **Better Error Messages**: Clear logs show which key/model failed  
✅ **No Code Changes Needed**: Just update API keys in `.env`  
✅ **Backward Compatible**: Old code still works with new implementation  

## Troubleshooting

### If you still get errors:

1. **"API key expired"**
   - Generate new keys at https://aistudio.google.com/app/apikey
   - Update both `GEMINI_API_KEY1` and `GEMINI_API_KEY2`

2. **"Model not found"**
   - Check the model name in logs
   - Verify the model exists at https://ai.google.dev/gemini-api/docs/models

3. **"Rate limit exceeded"**
   - Free tier has 60 requests/minute limit
   - Consider getting a paid API key or add delays

4. **"LLaMA fallback working"**
   - This means Gemini failed but LLaMA succeeded
   - Update your Gemini keys for better responses

## API Key Best Practices

1. **Never commit API keys to Git**
   - Keys are in `.env` which should be in `.gitignore`

2. **Get multiple keys for redundancy**
   - Use different Google accounts if needed
   - Helps if one key hits rate limits

3. **Monitor usage**
   - Check usage at https://aistudio.google.com/
   - Free tier: 60 requests/minute, 1500/day

4. **Rotate keys periodically**
   - Generate new keys every few months
   - Delete old keys from Google AI Studio

## Files Modified

- ✅ `backend/src/llm-service/index.js` - Smart model fallback
- ✅ `backend/src/utils/translationHelper.js` - API key fallback
- ✅ `backend/src/config/index.js` - Added backward compatibility
- 📄 Created this guide

## Status
✅ **FIXED** - Gemini API integration now uses correct models with automatic fallback  
⚠️ **ACTION REQUIRED** - You need to get new API keys from Google AI Studio

## Next Steps
1. Get new API keys from https://aistudio.google.com/app/apikey
2. Update `GEMINI_API_KEY1` in `backend/.env`
3. Optionally get a second key for `GEMINI_API_KEY2`
4. Restart your backend server
5. Test the chat feature

Your LLaMA fallback is working fine, but getting valid Gemini keys will provide better responses!
