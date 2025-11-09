# 🧠 EmotionSense AI (MantrAI) - Comprehensive Project Documentation

A full-stack **AI-powered emotion detection platform** combining **dual-model text analysis**, **advanced voice processing**, and **empathetic AI responses**. Built with modern web technologies for real-time emotion detection and intelligent conversation.

---

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [Tech Stack](#tech-stack)
3. [Architecture](#architecture)
4. [Features](#features)
5. [Project Structure](#project-structure)
6. [Setup & Installation](#setup--installation)
7. [Backend Services](#backend-services)
8. [Frontend Architecture](#frontend-architecture)
9. [API Endpoints](#api-endpoints)
10. [Database Schema](#database-schema)
11. [Emotion Detection Pipeline](#emotion-detection-pipeline)
12. [Configuration Guide](#configuration-guide)
13. [Development Workflows](#development-workflows)
14. [Deployment](#deployment)
15. [Troubleshooting](#troubleshooting)

---

## 🎯 Project Overview

**EmotionSense AI** (MantrAI) is an intelligent emotion detection and empathetic response generation platform. It analyzes user emotions through:
- **Text Analysis** - BiLSTM ONNX + HuggingFace DistilRoBERTa dual models
- **Voice Analysis** - Groq Whisper STT + HuggingFace Wav2Vec2 + Paraformer
- **Multi-Modal Fusion** - Weighted combination of text and voice emotions
- **AI Responses** - Google Gemini 2.0 Flash with LLaMA 3.3 fallback
- **Chat Persistence** - Supabase PostgreSQL with session management

### Use Cases
- Mental health support chatbot
- Empathetic customer service
- Mood tracking application
- Emotion-aware voice assistants
- Research on emotion detection

---

## 🛠 Tech Stack

### Backend
| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Runtime** | Node.js 18+ | JavaScript runtime |
| **Framework** | Express.js | HTTP server & routing |
| **ML Models** | ONNX Runtime | BiLSTM inference (text) |
| **Audio Processing** | FFmpeg, WAV | Audio format conversion |
| **LLM** | Google Gemini + Groq LLaMA | Text generation |
| **STT** | Groq Whisper v3 | Speech-to-text |
| **TTS** | Google Cloud, Piper, Sarvam | Text-to-speech |
| **Emotion Models** | HuggingFace | DistilRoBERTa, Wav2Vec2 |
| **Database** | Supabase (PostgreSQL) | User data & chat history |
| **Cache** | In-memory | 5-min emotion cache |

### Frontend
| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Framework** | Next.js 14 | React SSR/SSG |
| **Language** | TypeScript | Type safety |
| **Styling** | Tailwind CSS + Radix UI | UI components |
| **State Management** | Zustand + React Context | Global state |
| **API Client** | Axios | HTTP requests |
| **Database Client** | Supabase SDK | Real-time DB sync |
| **Voice Recording** | Web Audio API | Browser recording |
| **Audio Visualization** | WaveSurfer.js | Waveform display |
| **Analytics** | Custom Performance Monitor | Request tracking |

---

## 🏗 Architecture

### Data Flow Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│                   USER INPUT (Text/Voice)                   │
└────────────────────────┬────────────────────────────────────┘
                         │
        ┌────────────────┴────────────────┐
        ▼                                  ▼
   ┌─────────────┐               ┌──────────────────┐
   │  Text Input │               │  Voice Input     │
   └──────┬──────┘               └────────┬─────────┘
          │                               │
          ▼                               ▼
   ┌─────────────────┐          ┌─────────────────────┐
   │ Text Analysis   │          │ Voice Processing    │
   │ (Dual Model)    │          │ Groq Whisper STT    │
   │                 │          │ (Auto-language      │
   │ • BiLSTM ONNX   │          │  detection)         │
   │ • HuggingFace   │          └────────┬────────────┘
   │   DistilRoBERTa │                   │
   └────────┬────────┘          ┌────────▼──────────┐
            │                   │  Transcription    │
            │                   │  (Multi-lingual)  │
            │                   └────────┬──────────┘
            │                           │
            │          ┌────────────────┘
            │          │
   ┌────────▼──────────▼────────────┐
   │   Emotion Analysis Fusion      │
   │ • Text Emotion Score           │
   │ • Voice Emotion Score          │
   │ • Weighted Combination         │
   └────────┬───────────────────────┘
            │
            ▼
   ┌──────────────────────────┐
   │  Final Emotion Result    │
   │ • Detected Emotion       │
   │ • Confidence Score       │
   │ • All Model Scores       │
   └────────┬─────────────────┘
            │
   ┌────────▼────────────────────────────┐
   │  LLM Response Generation            │
   │  (with Fallback Chain)              │
   │ • Primary: Google Gemini 2.0 Flash  │
   │ • Fallback: LLaMA 3.3 via Groq     │
   │ • Context: Chat History (5-10 msgs) │
   └────────┬───────────────────────────┘
            │
   ┌────────▼──────────────────────┐
   │  Response Enhancement         │
   │ • Optional TTS Synthesis      │
   │ • Multi-language Support      │
   │ • Empathetic Tone             │
   └────────┬──────────────────────┘
            │
   ┌────────▼──────────────────────────┐
   │  Database Persistence            │
   │  (Supabase PostgreSQL)           │
   │ • Save Session                   │
   │ • Save Message History           │
   │ • Save Emotion Analytics         │
   └────────┬──────────────────────────┘
            │
            ▼
   ┌─────────────────────────────┐
   │  Frontend Display           │
   │ • Chat UI                   │
   │ • Emotion Badge             │
   │ • Audio Playback (TTS)      │
   │ • Typing Indicator          │
   └─────────────────────────────┘
```

### Service Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         EXPRESS SERVER                          │
├─────────────────────────────────────────────────────────────────┤
│ • CORS Middleware       • Error Handler      • Request Logger   │
│ • Compression           • Upload Handler     • Request Limiter  │
└─────────────────────────────────────────────────────────────────┘
                                  │
                ┌─────────────────┼─────────────────┐
                │                 │                 │
       ┌────────▼──────┐  ┌──────▼──────┐  ┌───────▼────────┐
       │ TEXT SERVICE  │  │VOICE SERVICE │  │  LLM SERVICE   │
       │               │  │              │  │                │
       │ • BiLSTM ONNX │  │• Groq STT    │  │• Gemini        │
       │ • HuggingFace │  │• Wav2Vec2    │  │• Groq LLaMA    │
       │ • 5-min Cache │  │• Features    │  │• Fallback      │
       └────────┬──────┘  └──────┬───────┘  └────────┬───────┘
                │                │                  │
       ┌────────▼────────────────▼──────────────────▼────────┐
       │           MULTI-MODAL FUSION LAYER                 │
       │  • Weighted Combination (0.5 text + 0.5 voice)     │
       │  • Confidence Scoring                              │
       │  • Result Normalization                            │
       └────────┬──────────────────────────────────────────┘
                │
       ┌────────▼──────────────┐
       │  TTS SERVICE          │
       │                       │
       │ • Google TTS (primary)│
       │ • Piper (fallback)    │
       │ • Sarvam (fallback)   │
       └────────┬──────────────┘
                │
       ┌────────▼─────────────────┐
       │  STORAGE SERVICE         │
       │ (Supabase ORM Layer)      │
       │                          │
       │ • Sessions               │
       │ • Messages               │
       │ • User Profiles          │
       │ • Analytics              │
       └──────────────────────────┘
```

---

## ✨ Key Features

### 🎭 Emotion Detection
- **Dual-Model Text Analysis**: Combines BiLSTM ONNX + HuggingFace for robust predictions
- **Voice Emotion**: Multi-stage pipeline with STT → Text Analysis → Voice Feature Analysis
- **Multi-Modal Fusion**: Intelligent weighted averaging of text and voice emotions
- **Confidence Scoring**: Detailed confidence metrics for all predictions
- **Caching**: 5-minute cache prevents redundant API calls

### 🤖 AI Response Generation
- **Primary LLM**: Google Gemini 2.0 Flash (state-of-the-art)
- **Fallback Chain**: LLaMA 3.3 70B via Groq if Gemini fails
- **Context-Aware**: Reads last 5-10 messages for coherent conversations
- **Empathetic Prompts**: Customized based on detected emotion
- **Language Support**: Automatic language detection and response in user's language

### 🎤 Voice Processing
- **STT**: Groq Whisper v3 Turbo (multi-language, auto-detect)
- **Audio Features**: Extracts prosody, pitch, energy for voice emotion
- **TTS**: Multi-provider (Google TTS → Piper → Sarvam) with fallbacks
- **Format Support**: WAV, MP3, OPUS, OGG

### 💬 Chat System
- **Session Management**: Persistent chat sessions with unique IDs
- **Message History**: Stored in Supabase with user association
- **Real-time Updates**: WebSocket support for live chat
- **Multi-turn Conversations**: Context window for coherent dialogue
- **User Isolation**: Row-Level Security on Supabase

### 🎨 Frontend Features
- **Responsive UI**: Mobile-friendly design with Tailwind CSS
- **Dark Mode**: Theme toggle with automatic preference detection
- **Voice Recording**: Browser-native recording with permission handling
- **Waveform Visualization**: Real-time audio visualization
- **Chat History**: Searchable message history with emotion filters
- **Performance Monitoring**: Track API response times

### 🔐 Security
- **Supabase RLS**: Row-Level Security for data isolation
- **JWT Authentication**: Secure user sessions
- **CORS Configuration**: Controlled cross-origin access
- **Input Validation**: Server-side text and audio validation
- **Rate Limiting**: (Configurable) API request throttling

---

## 📁 Project Structure

```
emotion-sense-ai/
├── backend/                              # Node.js Backend
│   ├── src/
│   │   ├── server.js                    # Main Express entry point
│   │   ├── config/
│   │   │   ├── index.js                 # Centralized configuration
│   │   │   └── indianLanguages.js       # Language code mappings
│   │   ├── middleware/
│   │   │   ├── errorHandler.js          # Global error middleware
│   │   │   ├── requestLogger.js         # HTTP request logging
│   │   │   └── uploadMiddleware.js      # Multer file upload config
│   │   ├── routes/
│   │   │   ├── chatRoutes.js            # Chat session endpoints
│   │   │   ├── textRoutes.js            # Text emotion endpoints
│   │   │   ├── voiceRoutes.js           # Voice emotion endpoints
│   │   │   ├── multiModalRoutes.js      # Combined emotion endpoints
│   │   │   ├── responseRoutes.js        # LLM response endpoints
│   │   │   ├── ttsRoutes.js             # Text-to-speech endpoints
│   │   │   └── healthRoutes.js          # Health check endpoints
│   │   ├── text-service/
│   │   │   ├── index.js                 # Text emotion analysis
│   │   │   ├── bilstm_onnx_inference.py # BiLSTM Python wrapper
│   │   │   └── README.md                # Service documentation
│   │   ├── voice-service/
│   │   │   ├── index.js                 # Voice emotion analysis
│   │   │   ├── emotion_inference.py     # Voice feature extraction
│   │   │   ├── huggingface_emotion.py   # HuggingFace wrapper
│   │   │   └── README.md                # Service documentation
│   │   ├── llm-service/
│   │   │   ├── index.js                 # LLM response generation
│   │   │   └── README.md                # Service documentation
│   │   ├── tts-service/
│   │   │   ├── index.js                 # Text-to-speech synthesis
│   │   │   └── README.md                # Service documentation
│   │   ├── storage-service/
│   │   │   ├── index.js                 # Supabase ORM layer
│   │   │   └── README.md                # Service documentation
│   │   ├── aggregator/
│   │   │   ├── index.js                 # Emotion fusion logic
│   │   │   └── README.md                # Service documentation
│   │   ├── multi-modal-layer/
│   │   │   ├── index.js                 # Multi-modal processing
│   │   │   └── README.md                # Service documentation
│   │   ├── utils/
│   │   │   ├── helpers.js               # Utility functions
│   │   │   ├── logger.js                # Logging utility
│   │   │   ├── translationHelper.js     # Translation utilities
│   │   │   └── voiceHelper.js           # Voice utilities
│   │   └── models/
│   │       └── emotion_bilstm_final.onnx # BiLSTM model file
│   ├── migrations/
│   │   └── add_audio_features_column.sql # Database migrations
│   ├── .env                             # Environment variables
│   ├── .env.example                     # Environment template
│   ├── package.json                     # Dependencies
│   ├── requirements.txt                 # Python dependencies
│   ├── test-*.js                        # Test scripts
│   └── README_DETAILED.md               # Detailed backend docs
│
├── frontend/                            # Next.js 14 Frontend
│   ├── app/
│   │   ├── layout.tsx                   # Root layout with providers
│   │   ├── page.tsx                     # Home page
│   │   ├── auth/
│   │   │   ├── login/page.tsx           # Login page
│   │   │   └── signup/page.tsx          # Registration page
│   │   ├── chat/
│   │   │   ├── page.tsx                 # Chat interface
│   │   │   ├── enhanced-page.tsx        # Enhanced chat version
│   │   │   └── page-optimized.tsx       # Optimized version
│   │   ├── text/page.tsx                # Text analysis page
│   │   ├── voice/page.tsx               # Voice analysis page
│   │   ├── multimodal/page.tsx          # Multi-modal analysis page
│   │   ├── history/page.tsx             # Chat history page
│   │   ├── profile/page.tsx             # User profile page
│   │   ├── settings/page.tsx            # Settings page
│   │   └── globals.css                  # Global styles
│   ├── components/
│   │   ├── navbar.tsx                   # Navigation bar
│   │   ├── sidebar.tsx                  # Side navigation
│   │   ├── MainContent.tsx              # Main content wrapper
│   │   ├── LoadingStates.tsx            # Loading skeletons
│   │   ├── theme-provider.tsx           # Theme wrapper
│   │   ├── theme-toggle.tsx             # Dark mode toggle
│   │   ├── auth/
│   │   │   ├── AuthGuard.tsx            # Route protection
│   │   │   └── DeleteConfirmationDialog.tsx
│   │   ├── chat/
│   │   │   ├── ChatLayout.tsx           # Chat container
│   │   │   ├── ChatSidebar.tsx          # Chat session list
│   │   │   ├── ChatMessage.tsx          # Message component
│   │   │   ├── ChatBubble.tsx           # Message bubble
│   │   │   ├── ChatInput.tsx            # Message input
│   │   │   ├── EnhancedChatInput.tsx    # Rich input
│   │   │   ├── EnhancedVoiceControls.tsx
│   │   │   ├── SimpleVoiceRecorder.tsx  # Voice recorder
│   │   │   └── TypingIndicator.tsx      # Typing animation
│   │   ├── emotions/
│   │   │   └── [emotion-components]    # Emotion display
│   │   ├── voice/
│   │   │   └── [voice-components]      # Voice controls
│   │   └── ui/
│   │       ├── button.tsx               # Button component
│   │       ├── input.tsx                # Input field
│   │       ├── card.tsx                 # Card layout
│   │       ├── dialog.tsx               # Modal dialog
│   │       ├── toast.tsx                # Toast notifications
│   │       └── [other-ui-components]
│   ├── contexts/
│   │   ├── AuthContext.tsx              # Auth state & methods
│   │   ├── ChatContext.tsx              # Chat state & methods
│   │   └── SidebarContext.tsx           # Sidebar state
│   ├── hooks/
│   │   ├── use-toast.ts                 # Toast hook
│   │   ├── useVoiceRecorder.ts          # Voice recording logic
│   │   └── useVoiceRecording.ts         # Alternative recording
│   ├── lib/
│   │   ├── api.ts                       # Axios API client
│   │   ├── supabase.ts                  # Supabase client
│   │   ├── performance.ts               # Performance monitoring
│   │   └── utils.ts                     # Utility functions
│   ├── store/
│   │   └── useStore.ts                  # Zustand global store
│   ├── types/
│   │   └── index.ts                     # TypeScript interfaces
│   ├── styles/
│   │   ├── globals.css                  # Global styles
│   │   ├── chat-enhancements.css        # Chat styling
│   │   └── chat-optimized.css           # Optimized styling
│   ├── package.json                     # Dependencies
│   ├── tsconfig.json                    # TypeScript config
│   ├── tailwind.config.ts               # Tailwind config
│   ├── postcss.config.mjs               # PostCSS config
│   └── next.config.mjs                  # Next.js config
│
├── .github/
│   └── copilot-instructions.md          # Project guidelines
│
└── README.md                            # This file

```

---

## 🚀 Setup & Installation

### Prerequisites

```
✓ Node.js 18 or higher (npm 9+)
✓ Python 3.8+ (for ONNX inference)
✓ Git
✓ API Keys:
  - Google Gemini API
  - Groq API (for LLaMA & Whisper)
  - HuggingFace API Token
  - Supabase Project
  - Google TTS API (optional)
```

### Backend Setup

```bash
# 1. Navigate to backend directory
cd backend

# 2. Install Node dependencies
npm install

# 3. Install Python dependencies
pip install -r requirements.txt

# 4. Create environment configuration
cp .env.example .env

# 5. Edit .env with your API keys
nano .env
# (See Configuration Guide below)

# 6. Verify ONNX model file
ls -la src/models/emotion_bilstm_final.onnx

# 7. Start development server
npm run dev

# Backend runs on: http://localhost:8080
```

### Frontend Setup

```bash
# 1. Navigate to frontend directory
cd frontend

# 2. Install Node dependencies
npm install

# 3. Create environment file
cp .env.local.example .env.local

# 4. Configure environment variables
# Edit .env.local with Supabase and API URLs

# 5. Start development server
npm run dev

# Frontend runs on: http://localhost:3000
```

### Full Stack Quick Start

```bash
# From project root

# Terminal 1: Backend
cd backend && npm run dev

# Terminal 2: Frontend
cd frontend && npm run dev

# Terminal 3 (optional): Run tests
cd backend && npm run test:basic
```

### Verification Checklist

- [ ] Backend server starts without errors (Port 8080)
- [ ] Frontend builds successfully (Port 3000)
- [ ] ONNX model file exists in `backend/src/models/`
- [ ] All environment variables are set
- [ ] Supabase connection established
- [ ] API endpoints respond to health checks

```bash
# Test endpoints
curl http://localhost:8080/api/health
curl http://localhost:3000/api/health
```

---

## 🔧 Backend Services

### 1. **Text Service** (`src/text-service/`)
Dual-model text emotion analysis combining BiLSTM and HuggingFace.

**Models:**
- BiLSTM ONNX: 6 emotions (angry, disgust, fear, happy, neutral, sad)
- HuggingFace DistilRoBERTa: 7 emotions (adds surprise)

**Features:**
- Parallel model execution
- 5-minute caching
- Weighted fusion (50/50 by default)
- Confidence scoring

**Input:** `{ text: string }`

**Output:**
```json
{
  "emotion": "happy",
  "confidence": 0.92,
  "scores": {
    "angry": 0.02,
    "disgust": 0.01,
    "fear": 0.02,
    "happy": 0.92,
    "neutral": 0.02,
    "sad": 0.01
  },
  "individual_results": {
    "bilstm": { "emotion": "happy", "confidence": 0.95, "scores": {} },
    "huggingface": { "emotion": "happy", "confidence": 0.89, "scores": {} }
  }
}
```

---

### 2. **Voice Service** (`src/voice-service/`)
Multi-stage voice emotion analysis with transcription.

**Pipeline:**
1. Audio Upload → Groq Whisper STT (auto language detection)
2. Transcription → Text Emotion Analysis
3. Audio Features → HuggingFace Wav2Vec2 Voice Emotion
4. Fusion: Weight text (60%) + voice (40%)

**Features:**
- Multi-language support
- Audio format conversion (FFmpeg)
- Feature extraction (MFCC, prosody)
- Fallback providers for STT

**Input:** Audio file (WAV, MP3, OPUS)

**Output:**
```json
{
  "transcript": "I am feeling great today",
  "detected_language": "en",
  "text_emotion": { "emotion": "happy", "confidence": 0.88 },
  "voice_emotion": { "emotion": "happy", "confidence": 0.85 },
  "combined_emotion": { "emotion": "happy", "confidence": 0.867 }
}
```

---

### 3. **LLM Service** (`src/llm-service/`)
Empathetic response generation with fallback chain.

**Primary Model:** Google Gemini 2.0 Flash (fast, multimodal)
**Fallback:** LLaMA 3.3 70B via Groq

**Features:**
- Context-aware prompting (last 5-10 messages)
- Empathetic tone based on detected emotion
- Fallback to Groq LLaMA if Gemini fails
- API key rotation support
- Temperature control (default 0.7)

**Function Signature:**
```javascript
generateResponse({
  message: string,
  emotion: string,
  confidence: number,
  chatHistory?: Array,
  userId?: string
})
```

**Prompt Template:**
```
The user is feeling {emotion} (confidence: {confidence}%).
Recent context: {chatHistory}

Respond empathetically and conversationally. Reference the chat history
if relevant. Keep response concise (2-3 sentences).
```

---

### 4. **TTS Service** (`src/tts-service/`)
Multi-provider text-to-speech synthesis.

**Providers:**
1. Google Cloud TTS (primary) - Supports 100+ languages, Neural voices
2. Piper TTS (fallback) - Open-source, fast
3. Sarvam TTS (fallback) - Indian language support
4. OpenAI TTS (fallback) - High quality

**Features:**
- Language auto-detection from text
- Voice selection based on gender/language
- MP3 or WAV output
- Configurable speaking rate & pitch

**Input:** `{ text: string, language?: string }`

**Output:** `{ audioUrl: string, contentType: string }`

---

### 5. **Storage Service** (`src/storage-service/`)
Supabase ORM layer for persistent data storage.

**Tables:**
- `users`: User profiles
- `chat_sessions`: Chat session metadata
- `messages`: Individual chat messages
- `emotions`: Emotion analysis logs

**Features:**
- Row-Level Security (RLS) for user isolation
- Transaction support for atomic operations
- Automatic timestamps and user tracking
- Query optimization with proper indexing

**Key Functions:**
```javascript
// Sessions
createSession(userId, topic)
getSession(sessionId)
updateSession(sessionId, data)
listSessions(userId)

// Messages
saveMessage(sessionId, role, content, emotion)
getMessages(sessionId, limit)
deleteMessage(messageId)

// Users
createUser(userData)
updateUserProfile(userId, data)
getUserAnalytics(userId)
```

---

### 6. **Aggregator** (`src/aggregator/`)
Weighted emotion fusion for multi-modal analysis.

**Fusion Logic:**
```
Combined Emotion = (text_emotion_score × text_weight) + (voice_emotion_score × voice_weight)

Default weights:
- Text: 50%
- Voice: 50%

Custom weights can be configured per use case
```

**Features:**
- Confidence-based weighting
- Outlier detection
- Emotion conflict resolution
- Detailed score tracking

---

### 7. **Multi-Modal Layer** (`src/multi-modal-layer/`)
Orchestrates text, voice, and data services.

**Responsibilities:**
- Request routing
- Service coordination
- Error handling & fallbacks
- Response normalization

---

## 🎨 Frontend Architecture

### State Management

**1. React Context API**

```typescript
// AuthContext - User authentication
const { user, isLoading, login, signup, logout, profile } = useAuth();

// ChatContext - Chat state
const { messages, sessionId, isLoading, sendMessage, newSession } = useChat();

// SidebarContext - UI state
const { isOpen, toggle } = useSidebar();
```

**2. Zustand Store**

```typescript
// Global store with localStorage persistence
const { history, addAnalysis, clearHistory, preferences } = useStore();

// Features:
// - Capped at 25 analyses
// - localStorage sync
// - Immer middleware for immutable updates
```

### Component Architecture

```
App
├── Layout (with providers)
│   ├── Navbar
│   ├── Sidebar
│   └── MainContent
│       └── Page Route
│
├── Chat Page
│   ├── ChatLayout
│   ├── ChatSidebar (session list)
│   ├── ChatMessage (individual messages)
│   ├── ChatInput (text + voice)
│   └── TypingIndicator
│
├── Text Analysis Page
│   ├── TextInput
│   └── EmotionResult
│
├── Voice Analysis Page
│   ├── VoiceRecorder
│   ├── Waveform
│   └── EmotionResult
│
├── MultiModal Page
│   ├── TextInput
│   ├── VoiceRecorder
│   └── CombinedResult
│
├── History Page
│   └── AnalysisTable (filterable, sortable)
│
└── Settings Page
    ├── ThemeToggle
    ├── LanguageSelect
    └── PreferencesForm
```

### API Client Pattern

```typescript
// lib/api.ts - Centralized API calls
export const analyzeText = async (text: string) => {
  return withCache(`text-${text.slice(0, 50)}`, async () => {
    const response = await api.post('/analyze/text', { text });
    return transformResponse(response.data);
  });
};

// Features:
// - Request/response caching
// - Error handling & retry logic
// - Performance monitoring
// - Type-safe responses
```

### Performance Optimizations

1. **Dynamic Imports**: Navbar and heavy components
2. **Response Caching**: 5-minute cache for identical inputs
3. **Debouncing**: Profile fetch, text input (300ms)
4. **Memoization**: Prevent unnecessary re-renders
5. **Code Splitting**: Next.js automatic route-based splitting
6. **Image Optimization**: Next.js Image component

---

## 📡 API Endpoints

### Authentication (Supabase)
```
POST   /auth/signup           - Register new user
POST   /auth/login            - Login user
POST   /auth/logout           - Logout user
GET    /auth/profile          - Get user profile
```

### Text Analysis
```
POST   /api/analyze/text
Content-Type: application/json

Request:
{
  "text": "I am feeling great!",
  "includeIndividualResults": true
}

Response: TextAnalysisResult
```

### Voice Analysis
```
POST   /api/analyze/voice
Content-Type: multipart/form-data

Request:
- audio: <audio-file>

Response: VoiceAnalysisResult
```

### Chat System
```
POST   /api/chat/message
Content-Type: application/json
Authorization: Bearer <JWT>

Request:
{
  "message": "Hello, how are you?",
  "sessionId": "optional-uuid",
  "memoryLength": 10
}

Response:
{
  "response": "AI response text",
  "emotion": "happy",
  "sessionId": "uuid",
  "audioUrl": "/api/tts/audio/file.wav",
  "messageId": "uuid"
}
```

### Chat Sessions
```
GET    /api/chat/sessions         - List user sessions
GET    /api/chat/sessions/:id     - Get session details
POST   /api/chat/sessions         - Create new session
DELETE /api/chat/sessions/:id     - Delete session
```

### Response Generation
```
POST   /api/response-generator
Content-Type: application/json

Request:
{
  "message": "I am sad",
  "emotion": "sad",
  "confidence": 0.85,
  "chatHistory": []
}

Response:
{
  "response": "I understand you're feeling sad...",
  "model": "gemini-2.0-flash",
  "tokens": { "input": 25, "output": 50 }
}
```

### Text-to-Speech
```
POST   /api/tts/synthesize
Content-Type: application/json

Request:
{
  "text": "I am feeling happy",
  "language": "en-US",
  "voiceGender": "female"
}

Response:
{
  "audioUrl": "/api/tts/audio/file.wav",
  "provider": "google",
  "duration": 2.5
}
```

### Health & Diagnostics
```
GET    /api/health              - Server status
GET    /api/health/services     - All service status
GET    /api/health/models       - ML model status
```

---

## 🗄 Database Schema

### Supabase PostgreSQL Tables

#### `users`
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id UUID UNIQUE REFERENCES auth.users(id),
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255),
  avatar_url TEXT,
  preferred_language VARCHAR(10) DEFAULT 'en',
  theme_preference VARCHAR(10) DEFAULT 'system',
  tts_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### `chat_sessions`
```sql
CREATE TABLE chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255),
  topic VARCHAR(100),
  emotion_context TEXT,
  message_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### `messages`
```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  emotion VARCHAR(50),
  emotion_confidence FLOAT,
  audio_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### `emotions`
```sql
CREATE TABLE emotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
  emotion VARCHAR(50) NOT NULL,
  confidence FLOAT,
  model_used VARCHAR(100),
  input_type VARCHAR(20) CHECK (input_type IN ('text', 'voice', 'multimodal')),
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Row-Level Security (RLS) Policies

```sql
-- Users can only access their own data
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sessions"
  ON chat_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create sessions"
  ON chat_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

---

## 🧠 Emotion Detection Pipeline (Detailed)

### 1. Text Emotion Detection

**Step 1: Input Processing**
- Normalize text (lowercase, remove extra spaces)
- Check 5-minute cache for exact match
- Return cached result if found

**Step 2: Parallel Model Inference**

**BiLSTM ONNX Model:**
- Input: Tokenized text
- Model: emotion_bilstm_final.onnx
- Output: 6 emotion logits
- Labels: angry, disgust, fear, happy, neutral, sad

**HuggingFace DistilRoBERTa:**
- Model: `michellejieli/emotion_text_classifier`
- Output: 7 emotion scores (includes surprise)
- Provider: HuggingFace Inference API

**Step 3: Weighted Fusion**
```javascript
combinedScores = {};
for (emotion in allEmotions) {
  score = (bilstmScore[emotion] * 0.5) + (hfScore[emotion] * 0.5);
  combinedScores[emotion] = score;
}
finalEmotion = max(combinedScores);
confidence = combinedScores[finalEmotion];
```

**Step 4: Cache Result**
- Store in memory for 5 minutes
- Key: hash(text)

---

### 2. Voice Emotion Detection

**Step 1: Speech-to-Text (Groq Whisper)**
```
Audio File (any format)
    ↓
FFmpeg Conversion → WAV format
    ↓
Groq Whisper v3 Turbo API
    ↓
Text Transcription + Language Detection
```

**Step 2: Text Emotion from Transcription**
- Run text emotion pipeline on transcript
- Confidence adjusted by transcription quality

**Step 3: Voice Feature Extraction**
```
Audio Analysis:
- MFCC (Mel-Frequency Cepstral Coefficients)
- Prosody (pitch, energy, speaking rate)
- Pause duration
- Voice quality metrics
```

**Step 4: Voice Emotion via Wav2Vec2**
- Model: `superb/wav2vec2-base-superb-er`
- Input: Audio features + waveform
- Output: Emotion classification

**Step 5: Multi-Modal Fusion**
```
Voice Emotion Score = (transcription_emotion * 0.6) + (audio_emotion * 0.4)
```

---

### 3. Multi-Modal Fusion

**Scenario 1: Text + Voice (equal confidence)**
```
Final Emotion = (text_emotion * 0.5) + (voice_emotion * 0.5)
```

**Scenario 2: Text + Voice (confidence-based)**
```
text_weight = text_confidence / (text_confidence + voice_confidence)
voice_weight = voice_confidence / (text_confidence + voice_confidence)

Final Emotion = (text_emotion * text_weight) + (voice_emotion * voice_weight)
```

**Scenario 3: Conflicting emotions**
```
if (text_emotion != voice_emotion) {
  // Choose based on higher confidence
  // Or use emotion similarity scoring
  // Or average neutral ground
}
```

---

## ⚙️ Configuration Guide

### Backend .env File

```env
# ============================================
# SERVER CONFIGURATION
# ============================================
PORT=8080
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000

# ============================================
# GEMINI API (Primary LLM)
# ============================================
GEMINI_API_KEY1=your-key-here
GEMINI_API_KEY2=backup-key-here
GEMINI_MAX_TOKENS=1024
GEMINI_TEMPERATURE=0.7

# ============================================
# GROQ API (LLaMA + Whisper STT)
# ============================================
GROQ_API_KEY=your-groq-key
GROQ_MODEL=whisper-large-v3-turbo
STT_LANGUAGE=  # Leave empty for auto-detect

# ============================================
# HUGGINGFACE (Emotion Models)
# ============================================
HUGGINGFACE_API_KEY=your-hf-token
TEXT_EMOTION_MODEL=michellejieli/emotion_text_classifier
VOICE_EMOTION_MODEL=superb/wav2vec2-base-superb-er

# ============================================
# TEXT-TO-SPEECH
# ============================================
TTS_ENABLED=true
TTS_PROVIDER=google  # google|piper|sarvam|openai
GOOGLE_TTS_API_KEY=your-google-tts-key
GOOGLE_TTS_VOICE=en-US-Neural2-C
GOOGLE_TTS_SPEED=1.0

# ============================================
# SUPABASE DATABASE
# ============================================
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-service-role-key

# ============================================
# ONNX MODEL
# ============================================
BILSTM_TEXT_ENABLED=true
BILSTM_MODEL_PATH=./src/models/emotion_bilstm_final.onnx
BILSTM_LABELS=angry,disgust,fear,happy,neutral,sad
```

### Frontend .env.local File

```env
# ============================================
# API CONFIGURATION
# ============================================
NEXT_PUBLIC_API_URL=http://localhost:8080

# ============================================
# SUPABASE
# ============================================
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# ============================================
# FEATURES
# ============================================
NEXT_PUBLIC_ENABLE_VOICE=true
NEXT_PUBLIC_ENABLE_TTS=true
NEXT_PUBLIC_ENABLE_CHAT_PERSISTENCE=true
```

---

## 💻 Development Workflows

### Adding a New Emotion Detection Model

**1. Implement Model Service**
```javascript
// backend/src/your-service/index.js
export const analyzeWithNewModel = async (input) => {
  // Model inference logic
};
```

**2. Update Fusion Layer**
```javascript
// backend/src/aggregator/index.js
const newModelResult = await analyzeWithNewModel(input);
scores.newModel = newModelResult.scores;
```

**3. Update Types**
```typescript
// frontend/types/index.ts
export interface TextAnalysisResult {
  individual_results?: {
    // ... existing models
    newModel?: ModelResult;
  };
}
```

---

### Adding a New LLM Provider

**1. Implement Provider Function**
```javascript
// backend/src/llm-service/index.js
async function generateResponseWithNewProvider(message, context) {
  // API call to new provider
}
```

**2. Add to Fallback Chain**
```javascript
export async function generateResponse(message, emotion) {
  try {
    return await generateResponseWithGemini(message, emotion);
  } catch (error) {
    try {
      return await generateResponseWithGroqLLaMA(message, emotion);
    } catch (error2) {
      return await generateResponseWithNewProvider(message, emotion);
    }
  }
}
```

---

### Testing Emotion Detection

```bash
# Test text emotion endpoint
curl -X POST http://localhost:8080/api/analyze/text \
  -H "Content-Type: application/json" \
  -d '{"text": "I am so happy today!"}'

# Test voice emotion endpoint
curl -X POST http://localhost:8080/api/analyze/voice \
  -F "audio=@test_audio.wav"

# Test chat endpoint
curl -X POST http://localhost:8080/api/chat/message \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "message": "I had a bad day",
    "sessionId": "session-123"
  }'
```

---

### Running Tests

```bash
# Backend tests
cd backend

# Test basic endpoints
npm run test:basic

# Test live API (full pipeline)
npm run test:live

# Test translation service
npm run test:translation
```

---

### Frontend Development Tips

**1. Environment Variables**
- Always prefix with `NEXT_PUBLIC_` for browser access
- Create `.env.local` for local development

**2. Type Safety**
- Define interfaces in `types/index.ts`
- Use TypeScript strict mode
- Avoid `any` type

**3. State Management**
- Use Zustand for global state
- Use Context for auth/chat
- Local component state for UI

**4. Performance**
- Use `React.memo()` for expensive components
- Implement `useMemo()` for heavy computations
- Use dynamic imports for large components
- Cache API responses

---

## 🚀 Deployment

### Backend Deployment (Heroku/Railway/Render)

```bash
# 1. Create Procfile
echo "web: npm start" > Procfile

# 2. Add buildpacks
heroku buildpacks:add heroku/nodejs
heroku buildpacks:add heroku/python

# 3. Set environment variables
heroku config:set GEMINI_API_KEY=your-key
heroku config:set GROQ_API_KEY=your-key
# ... etc

# 4. Deploy
git push heroku main
```

### Frontend Deployment (Vercel)

```bash
# 1. Push to GitHub
git push origin main

# 2. Connect to Vercel
# Go to https://vercel.com/new
# Select repository
# Add environment variables from .env.local

# 3. Deploy
# Automatic on push to main
```

### Docker Containerization

```dockerfile
# Backend Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY src ./src

EXPOSE 8080

CMD ["npm", "start"]
```

```bash
# Build and run
docker build -t emotion-sense-backend .
docker run -p 8080:8080 emotion-sense-backend
```

---

## 🐛 Troubleshooting

### Common Issues & Solutions

#### 1. **ONNX Model Not Found**
```
Error: Cannot find module 'emotion_bilstm_final.onnx'
```
**Solution:**
- Verify file exists: `ls backend/src/models/emotion_bilstm_final.onnx`
- Check permissions: `chmod 644 src/models/*.onnx`
- Download model if missing: [Download Link]

---

#### 2. **HuggingFace Rate Limited**
```
Error: Rate limit exceeded from HuggingFace API
```
**Solution:**
- Text emotion results are cached for 5 minutes
- Wait 1-2 minutes before retrying
- Batch requests where possible
- Upgrade HuggingFace account for higher limits

---

#### 3. **Gemini API Key Invalid**
```
Error: 403 Permission denied from Gemini API
```
**Solution:**
- Verify API key in `.env`
- Check API key has correct permissions
- Ensure quota not exceeded
- Use backup key: `GEMINI_API_KEY2`

---

#### 4. **Supabase Connection Failed**
```
Error: Failed to connect to Supabase
```
**Solution:**
- Check `SUPABASE_URL` and `SUPABASE_KEY` in `.env`
- Verify network connectivity
- Ensure Supabase project is running
- Check Row-Level Security policies

---

#### 5. **Voice Recording Permission Denied**
```
Error: NotAllowedError: Permission denied
```
**Solution:**
- HTTPS required for production (localhost OK)
- Check browser microphone permissions
- Request permission explicitly in app
- Try different browser

---

#### 6. **Frontend Can't Connect to Backend**
```
Error: Failed to fetch from http://localhost:8080
```
**Solution:**
- Backend must be running on port 8080
- Check CORS configuration in backend
- Verify `NEXT_PUBLIC_API_URL` in frontend `.env.local`
- Check firewall settings

---

#### 7. **Python Dependencies Missing**
```
Error: ModuleNotFoundError: No module named 'onnxruntime'
```
**Solution:**
```bash
cd backend
pip install -r requirements.txt

# Or manually:
pip install onnxruntime numpy librosa
```

---

### Debug Mode

Enable verbose logging:

```bash
# Backend
NODE_DEBUG=express npm run dev

# With Python logging
DEBUG=* npm run dev

# Frontend
next dev --debug
```

### Health Check Endpoints

```bash
# Server status
curl http://localhost:8080/api/health

# All services
curl http://localhost:8080/api/health/services

# ML models
curl http://localhost:8080/api/health/models
```

---

## 📚 Additional Resources

### Documentation Files
- **Backend**: `backend/README_DETAILED.md`
- **Backend Services**: Each service has `README.md`
- **Frontend**: `frontend/ARCHITECTURE.md`
- **Copilot Instructions**: `.github/copilot-instructions.md`

### API Documentation
- [Groq API Docs](https://console.groq.com/docs)
- [Google Gemini API](https://ai.google.dev/)
- [HuggingFace Inference](https://huggingface.co/docs/api-inference)
- [Supabase Docs](https://supabase.com/docs)

### ML Model Resources
- [ONNX Runtime](https://onnxruntime.ai/)
- [Transformers Library](https://huggingface.co/docs/transformers)
- [Wav2Vec2 Model](https://huggingface.co/docs/transformers/model_doc/wav2vec2)

---

## 🤝 Contributing

### Code Standards
- Follow ESLint rules (frontend)
- Use consistent naming conventions
- Document complex logic with comments
- Test before pushing

### Pull Request Process
1. Create feature branch: `git checkout -b feature/your-feature`
2. Make changes following code standards
3. Test thoroughly
4. Commit with clear messages
5. Push and create pull request

---

## 📄 License

This project is part of the EmotionSense AI initiative.

---

## 👤 Author & Support

**Created by**: Ayush Singh

For questions or support, refer to the project documentation or contact the development team.

---

**Last Updated**: November 2025
**Version**: 1.0.0
**Status**: Active Development
