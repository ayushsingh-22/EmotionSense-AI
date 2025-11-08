# EmotionSense AI - Copilot Instructions

## Project Overview

**EmotionSense AI** (MantrAI) is a full-stack emotion detection platform combining:
- **Backend**: Node.js/Express microservices for emotion analysis and AI responses
- **Frontend**: Next.js 14 TypeScript/React web application
- **ML Models**: BiLSTM ONNX (text), HuggingFace (text/voice), Wav2Vec2 (voice)
- **LLMs**: Google Gemini 2.0 Flash (primary), LLaMA 3.3 via Groq (fallback)
- **Database**: Supabase (PostgreSQL) with Row-Level Security

---

## Architecture & Data Flow

### Core Processing Pipeline

```
User Input (text/voice)
  ↓
Emotion Analysis (dual/multi-model)
  ├─ Text: BiLSTM ONNX (6 emotions) + HuggingFace DistilRoBERTa (7 emotions)
  ├─ Voice: Groq Whisper STT → Text emotion + HuggingFace Wav2Vec2
  └─ Fusion: Weighted combination of model results
  ↓
LLM Response Generation (Gemini → Groq LLaMA fallback)
  ├─ Empathetic prompt with emotion + conversation history
  └─ Context-aware response for chat sessions
  ↓
Optional: Text-to-Speech synthesis (Google TTS primary, Piper/Sarvam fallback)
  ↓
Database Save (Supabase) + Frontend display
```

### Service Separation

- **text-service** (`src/text-service/`): BiLSTM ONNX + HuggingFace inference
- **voice-service** (`src/voice-service/`): Groq STT + audio feature extraction + Wav2Vec2
- **llm-service** (`src/llm-service/`): Gemini/Groq response generation with fallback chains
- **tts-service** (`src/tts-service/`): Speech synthesis with multi-provider support
- **storage-service** (`src/storage-service/`): Supabase ORM layer for sessions/messages
- **aggregator** (`src/aggregator/`): Combines text+voice for multi-modal analysis
- **multi-modal-layer** (`src/multi-modal-layer/`): Weighted fusion logic

### Frontend Data Flow

```
React Context (Auth, Chat)
  ↓
API Client with caching (lib/api.ts)
  ↓
Zustand Store (local state + localStorage persistence)
  ↓
UI Components (with performance monitoring)
```

---

## Critical Development Patterns

### Backend: Emotion Analysis

**Text Emotion (Dual Model)**
```javascript
// src/text-service/index.js
export const analyzeTextEmotion = async (text) => {
  // 1. Check 5-min cache
  // 2. Run BiLSTM ONNX + HuggingFace in parallel
  // 3. Weighted fusion: bilstm_score * 0.5 + huggingface_score * 0.5
  // 4. Return { emotion, confidence, scores, individual_results }
}
```

**Voice Emotion (Multi-Stage)**
```javascript
// src/voice-service/index.js
export const analyzeVoiceEmotion = async (audioPath) => {
  // 1. Groq Whisper (STT) with auto-language detection
  // 2. Text emotion from transcript (use text-service)
  // 3. Audio features → HuggingFace Wav2Vec2 for voice emotion
  // 4. Fusion: weighted combination of text + voice scores
}
```

**Configuration-Driven Fallbacks**
```javascript
// All services read from config/index.js
// Priority order: env vars → config defaults → hardcoded fallbacks
// Example: STT uses Groq, but has fallback providers if needed

config.stt.groq.apiKey // Controlled via env
config.llm.primaryModel // Gemini 2.0 Flash
config.llm.fallbackModel // LLaMA via Groq
```

### Backend: Chat System Architecture

**Session-Based Conversations** (`src/routes/chatRoutes.js`)
- Each chat session has unique `sessionId` (UUID)
- Sessions scoped to user via Supabase RLS
- Endpoint: `POST /api/chat/message` processes:
  1. User message emotion analysis
  2. Fetch recent conversation history (context window)
  3. Generate empathetic response with history awareness
  4. Optional TTS synthesis
  5. Save to Supabase in single transaction

**Key: Context-Aware Prompting**
```javascript
// llm-service/index.js - createEmpatheticPrompt()
// Prompt includes:
// - Detected emotion + confidence
// - Previous 5-10 messages (maintains conversation thread)
// - Inferred "underlying topic" (money/relationships/work/etc)
// - Instructions to reference history, not just emotion
// CRITICAL: The LLM reads chatHistory to understand WHAT the user deals with,
// not just HOW they feel
```

### Frontend: State Management

**Auth Context** (`contexts/AuthContext.tsx`)
- Manages Supabase session + user profile
- Debounced profile fetch to prevent excessive API calls
- Automatic logout on session expiry

**Chat Context** (`contexts/ChatContext.tsx`)
- Stores current messages, sessionId, isLoading/isTyping flags
- `sendMessage()` creates user message, calls backend, updates UI
- Backend handles all persistence; frontend just tracks local state
- `playAudio()` syncs TTS playback with UI

**Zustand Store** (`store/useStore.ts`)
- Global history (capped at 25 analyses)
- User preferences (theme, TTS enabled, etc)
- Persisted to localStorage with `persist` middleware
- Use `immer` middleware for immutable updates

### Frontend: API Client Pattern

```typescript
// lib/api.ts - All API calls go here
export const analyzeText = async (text: string): Promise<TextAnalysisResult> => {
  return withCache(`text-${text.slice(0,50)}`, async () => {
    // Transforms backend response to match frontend types
    // Backend: { success, data: { emotion, confidence, scores } }
    // Frontend expects: { originalText, emotion, confidence, scores, models_used, ... }
  })
}

// Performance monitoring on every request
api.interceptors.request.use((config) => {
  PerformanceMonitor.start(requestId);
})
```

---

## Configuration & Environment

### Backend `.env` Structure

```env
# Server
PORT=8080
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000

# Primary LLM (Gemini)
GEMINI_API_KEY1=<key1>
GEMINI_API_KEY2=<key2>  # Rotation fallback

# Fallback LLM (LLaMA via Groq)
GROQ_API_KEY=<key>
LLAMA_ENABLED=true

# STT (Groq Whisper)
GROQ_MODEL=whisper-large-v3-turbo
STT_LANGUAGE=  # Leave empty for auto-detect

# TTS (Google primary, providers fallback)
TTS_PROVIDER=google
GOOGLE_TTS_API_KEY=<key>
GOOGLE_TTS_VOICE=en-US-Neural2-C

# HuggingFace (emotion models)
HUGGINGFACE_API_KEY=<key>
HF_TEXT_EMOTION_MODEL=distilbert-base-uncased-finetuned-sst-2-english

# Supabase
SUPABASE_URL=<url>
SUPABASE_KEY=<key>
```

### Frontend `.env.local` Structure

```env
NEXT_PUBLIC_API_URL=http://localhost:8080
NEXT_PUBLIC_SUPABASE_URL=<url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<key>
```

---

## Common Developer Workflows

### Starting Development

```bash
# Backend: Terminal 1
cd backend
npm install
npm run dev  # Runs on :8080

# Frontend: Terminal 2
cd frontend
npm install
npm run dev  # Runs on :3000
```

### Testing Emotion Detection

```bash
# Test text emotion
curl -X POST http://localhost:8080/api/analyze/text \
  -H "Content-Type: application/json" \
  -d '{"text": "I am so happy today!"}'

# Test voice emotion (with audio file)
curl -X POST http://localhost:8080/api/analyze/voice \
  -F "audio=@audio.wav"

# Test chat (with session persistence)
curl -X POST http://localhost:8080/api/chat/message \
  -H "Content-Type: application/json" \
  -d '{
    "message": "I had a bad day",
    "userId": "test-user",
    "sessionId": "test-session-123"
  }'
```

### Debugging Emotion Analysis

1. **BiLSTM ONNX Inference**: Check `src/text-service/bilstm_onnx_inference.py` for model loading
2. **HuggingFace Errors**: Common rate limits → check cache first, then retry with delay
3. **Voice Emotion**: Run `src/voice-service/test_custom_model.py` to verify Wav2Vec2 setup
4. **Model Files**: ONNX model at `src/models/emotion_bilstm_final.onnx` must exist

---

## Code Organization Standards

### Backend Service Structure

```
src/
├── server.js                 # Entry point - middleware + route registration
├── config/                   # Centralized configuration (env vars)
├── middleware/               # Express middleware (error handling, logging)
├── routes/                   # Express route handlers
├── [service]/                # Independent service modules
│   ├── index.js             # Main exports (functions, not class)
│   ├── [utility].py         # Python ML/inference scripts
│   └── README.md            # Service documentation
├── storage-service/         # Supabase ORM layer
├── utils/                    # Shared utilities (translation, logging)
└── models/                   # ML model files (.onnx)
```

### Frontend Structure

```
frontend/
├── app/                      # Next.js App Router (pages)
├── components/               # Reusable UI components (Radix UI based)
├── contexts/                 # React Contexts (Auth, Chat, Sidebar)
├── hooks/                    # Custom hooks (useVoiceRecorder, use-toast)
├── lib/                      # Utilities (API client, Supabase, performance)
├── store/                    # Zustand global state
├── types/                    # TypeScript interfaces
└── styles/                   # Global + component CSS
```

---

## Cross-Language Considerations

### Backend: Multi-Language Support

- **STT**: Groq auto-detects language from audio
- **Text Emotion**: Works on any language (models trained multilingual)
- **LLM Responses**: Gemini writes in same language as user input
- **TTS**: Google TTS supports 100+ languages, detect language from response

```javascript
// chatRoutes.js automatically handles translation if needed
const { translatedText, detectedLanguage } = await translateToEnglishIfNeeded(message);
```

### Frontend: Language Display

- All UI strings in English (no i18n currently)
- User input/output respects original language
- Emotion labels universal across languages

---

## Performance & Optimization

### Backend Optimizations

1. **Text Emotion Caching**: 5-min cache for identical text inputs
2. **Parallel Model Execution**: BiLSTM + HuggingFace run concurrently
3. **API Fallback Chains**: Gemini → Groq LLaMA (transparent to frontend)
4. **Audio Streaming**: Upload directly to Groq API, no local processing required

### Frontend Optimizations

1. **Response Caching**: API results cached by `withCache()` wrapper
2. **Zustand Persistence**: History/prefs stored locally, no DB round-trip
3. **Debounced Profile Fetch**: 300ms debounce prevents excessive Supabase calls
4. **Performance Monitoring**: Every API call tracked via `PerformanceMonitor`
5. **Dynamic Navbar Import**: Prevents hydration mismatches in SSR

---

## Key Files & Import Patterns

| Feature | Backend | Frontend |
|---------|---------|----------|
| **Emotion Detection** | `src/text-service/`, `src/voice-service/` | Calls API, displays results |
| **Chat Sessions** | `src/routes/chatRoutes.js`, `src/storage-service/` | `contexts/ChatContext.tsx` |
| **Auth** | N/A (uses Supabase) | `contexts/AuthContext.tsx` |
| **State** | N/A | `store/useStore.ts` (Zustand) |
| **API Client** | N/A | `lib/api.ts` (Axios + caching) |
| **Types** | None (JS) | `types/index.ts` (TypeScript) |

---

## Common Pitfalls & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| `HuggingFace rate limited` | Too many concurrent requests | Already cached; wait 1-2 minutes or batch requests |
| `Gemini quota exceeded` | API key overused | Switch to GEMINI_API_KEY2 in config rotation |
| `BiLSTM ONNX not found` | Model file missing | Verify `src/models/emotion_bilstm_final.onnx` exists |
| `Supabase RLS errors` | Missing auth headers | Ensure `Authorization: Bearer <JWT>` on protected endpoints |
| `Voice Recorder permission denied` | Browser permission | Check HTTPS (required) or localhost exceptions |
| `Chat messages not persisting` | Backend transaction failed | Check `chatRoutes.js` transaction logic + Supabase connection |

---

## Extending the System

### Adding a New Emotion Detection Model

1. Add model inference in `src/text-service/` or `src/voice-service/`
2. Update fusion logic in `src/aggregator/` (add new weight coefficient)
3. Update type `EmotionType` in `frontend/types/index.ts` if new emotion labels
4. Update `createEmpatheticPrompt()` in `src/llm-service/` if new emotions need special handling

### Adding a New LLM Provider

1. Add provider config to `src/config/index.js`
2. Implement provider function in `src/llm-service/index.js`
3. Add to fallback chain in `generateResponse()`
4. Test via `POST /api/response-generator` endpoint

### Adding Frontend Features

1. Create reusable component in `components/`
2. Add hooks in `hooks/` for logic
3. Use `useStore()` for global state, `useAuth()` for user context
4. API calls via `lib/api.ts` functions
5. Add TypeScript types to `types/index.ts`

---

## Useful Commands

```bash
# Backend
npm run dev              # Watch mode
npm start               # Production mode
npm run test:basic      # Test emotion endpoints
npm run test:live       # Full pipeline test

# Frontend
npm run dev             # Next.js dev server
npm run build           # Production build
npm run lint            # ESLint check

# Testing
# Backend test endpoints in backend/ directory
node test-translation.js
node test-emotion-endpoint.js
```

---

## Documentation References

- **Backend README**: `backend/README_DETAILED.md` (emotion pipeline, API spec)
- **Frontend Architecture**: `frontend/ARCHITECTURE.md` (component hierarchy, data flow)
- **Frontend Development**: `frontend/DEVELOPMENT.md` (styling, hooks guide)
- **Service READMEs**: Each service has own `README.md` explaining its role
