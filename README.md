# 🧠 Emotion AI - Multi-Modal Emotion Detection Platform

A comprehensive, production-ready emotion analysis platform that combines text, voice, and conversational AI to provide empathetic responses and emotional intelligence insights.

## ✨ NEW FEATURES IN THIS UPDATE

### 🔐 **Authentication & User Management**
- Secure user authentication with Supabase
- User profiles with emotion analytics
- Session management and data persistence

### 💬 **AI Chat Companion**
- Conversational emotion analysis
- Empathetic response generation using Gemini API / Groq Llama
- Real-time chat with emotion tracking
- Text-to-speech response playback

### 🎤 **Enhanced Voice Experience** 
- Real-time voice recording with browser MediaRecorder API
- Voice companion mode (like Alexa/Google Assistant)
- Combined text + voice emotion analysis

### 📊 **Personal Analytics Dashboard**
- Personal emotion journey tracking
- Weekly/monthly emotion trends
- Session statistics and confidence metrics
- Interactive emotion visualizations

### 🎨 **Modern UI/UX**
- Responsive design with TailwindCSS
- Dark/light theme support
- Smooth animations with Framer Motion
- Authentication-aware navigation

## 🚀 Quick Start

### Run Everything Together (Recommended)
```bash
# Double-click or run in terminal:
start-all.bat
```
This will open 2 windows:
- Backend on http://localhost:8080
- Frontend on http://localhost:3000

### Run Separately (When Needed)
```bash
# Backend only:
start-backend.bat

# Frontend only (backend must be running):
start-frontend.bat
```

**📖 See [STARTUP_GUIDE.md](STARTUP_GUIDE.md) for detailed instructions and troubleshooting.**

## 🗄️ Database Setup (NEW)

This update now includes **Supabase integration** for user authentication and data persistence.

### Quick Supabase Setup

1. **Create Account**: Sign up at [supabase.com](https://supabase.com)
2. **Create Project**: Create a new project and note your:
   - Project URL
   - Anon Key
3. **Set up Database**:
   - Go to SQL Editor in Supabase dashboard
   - Run the SQL from `database_schema.sql` (located in project root)
4. **Update Environment**:
   ```bash
   # Frontend (.env.local)
   NEXT_PUBLIC_SUPABASE_URL=your_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   ```

### Database Schema Includes:
- **User Profiles**: Extended user information
- **Emotion Sessions**: Analysis history and results  
- **Chat Messages**: Conversational data for chat companion
- **Row Level Security**: Secure data access per user

### Alternative: Local SQLite (Legacy)
You can still use SQLite for local development by configuring the backend environment.



## 📁 Project Structure (Polyrepo)## ✨ Key Features



```- 🎭 **Dual-Model Text Emotion**: BiLSTM ONNX + HuggingFace DistilRoBERTa

emotion-detection-platform/- 🎤 **Advanced Voice Analysis**: Groq Whisper STT + HuggingFace Wav2Vec2

├── backend/                     # Node.js backend API- 🔄 **Multi-Modal Fusion**: Intelligent weighted combination of text + voice emotions

│   ├── src/- 🤖 **Smart LLM Integration**: Google Gemini (primary) with LLaMA fallback via Groq

│   │   ├── server.js           # Entry point- 🎵 **Text-to-Speech**: Optional Piper TTS for voice responses

│   │   ├── config/             # Configuration- 📊 **Dual Database**: Supabase (cloud) or SQLite (local)

│   │   ├── routes/             # API routes- ⚡ **ONNX Optimization**: Fast CPU inference with ONNX Runtime

│   │   ├── text-service/       # Text emotion analysis- 🔐 **Production-Ready**: Robust error handling, logging, and fallback mechanisms

│   │   ├── voice-service/      # Voice emotion analysis

│   │   ├── multi-modal-layer/  # Emotion fusion## 📊 Emotion Detection Pipeline

│   │   ├── llm-service/        # LLM integration

│   │   ├── storage-service/    # Data persistence### Text Emotion Analysis (Dual Model)

│   │   ├── middleware/         # Express middleware```

│   │   └── utils/              # UtilitiesText Input

│   ├── models/                 # ML models (ONNX)    ↓

│   ├── data/                   # SQLite databaseBiLSTM ONNX Model (6 emotions) + HuggingFace DistilRoBERTa (7 emotions)

│   ├── logs/                   # Application logs    ↓ (parallel execution)

│   ├── temp/                   # Temporary filesWeighted Combination (50/50)

│   ├── package.json    ↓

│   └── README.md              # Backend documentationCombined Emotion Result

│```

├── frontend/                   # Frontend application (React/Vue/Next.js)

│   ├── src/### Voice Emotion Analysis (Multi-Stage)

│   │   ├── components/```

│   │   ├── pages/Audio Input

│   │   ├── services/    ↓

│   │   └── utils/Groq Whisper API (Speech-to-Text)

│   ├── package.json    ↓

│   └── README.md              # Frontend documentationTranscription

│    ↓

├── .git/                       # Git repository┌─────────────────────────┬──────────────────────────┐

├── .gitignore                  # Root gitignore│   Text Emotion          │   Voice Emotion          │

└── README.md                   # This file│   (from transcript)     │   (from audio features)  │

```│   BiLSTM + HuggingFace  │   HuggingFace Wav2Vec2   │

└─────────────────────────┴──────────────────────────┘

## ✨ Key Features    ↓

Weighted Fusion

- 🎭 **Dual-Model Text Emotion**: BiLSTM ONNX + HuggingFace DistilRoBERTa    ↓

- 🎤 **Advanced Voice Analysis**: Groq Whisper STT + HuggingFace Wav2Vec2Final Combined Emotion

- 🔄 **Multi-Modal Fusion**: Intelligent weighted combination of text + voice emotions```

- 🤖 **Smart LLM Integration**: Google Gemini (primary) with LLaMA fallback via Groq

- 🎵 **Text-to-Speech**: Optional Piper TTS for voice responses## 🚀 Quick Start

- 📊 **Dual Database**: Supabase (cloud) or SQLite (local)

- ⚡ **ONNX Optimization**: Fast CPU inference with ONNX Runtime### Prerequisites

- 🔐 **Production-Ready**: Robust error handling, logging, and fallback mechanisms

- **Node.js** 18+ 

## 🚀 Quick Start- **Python** 3.8+

- **API Keys**: Groq, Gemini, HuggingFace

### Prerequisites

### Installation

- **Node.js** 18+

- **Python** 3.8+```bash

- **npm** or **yarn**# 1. Clone and install

- **API Keys**: Groq, Gemini, HuggingFacegit clone <repository-url>

cd emotion-detection-backend

### 1. Setup Backendnpm install



```bash# 2. Install Python dependencies

# Navigate to backendpip install onnxruntime numpy

cd backend

# 3. Configure environment

# Install dependenciescp .env.example .env

npm install# Edit .env with your API keys



# Install Python dependencies# 4. Verify ONNX model exists

pip install onnxruntime numpyls src/models/emotion_bilstm_final.onnx



# Configure environment# 5. Start server

cp .env.example .envnpm start

# Edit .env with your API keys```



# Start backend server### Quick Test

npm run dev

``````bash

# Test text emotion

Backend will run on `http://localhost:3000`curl -X POST http://localhost:3000/api/analyze/text \

  -H "Content-Type: application/json" \

### 2. Setup Frontend  -d '{"text": "I am so happy today!"}'



```bash# Test voice emotion

# Navigate to frontendcurl -X POST http://localhost:3000/api/analyze/voice \

cd frontend  -F "audio=@audio.wav"

```

# Choose your framework and follow frontend/README.md

# Example with React + Vite:## 📡 API Endpoints

npm create vite@latest . -- --template react-ts

npm install### 1. Text Emotion Analysis

npm install axios tailwindcss

Analyzes text using **BiLSTM ONNX + HuggingFace** in parallel.

# Start frontend dev server

npm run dev```http

```POST /api/analyze/text

Content-Type: application/json

Frontend will run on `http://localhost:5173` (Vite) or `http://localhost:3001` (configure as needed)

{

## 📡 API Architecture  "text": "I'm feeling really happy today!",

  "userId": "user123"

### Backend API Endpoints}

```

| Endpoint | Method | Description |

|----------|--------|-------------|**Response:**

| `/api/analyze/text` | POST | Analyze text emotion (dual-model) |```json

| `/api/analyze/voice` | POST | Analyze voice emotion (multi-stage) |{

| `/api/analyze/multimodal` | POST | Combined text + voice analysis |  "success": true,

| `/api/response/generate` | POST | Generate AI empathetic response |  "data": {

| `/api/health` | GET | Health check |    "emotion": "happy",

    "confidence": 0.88,

### Text Emotion Pipeline    "models_used": ["bilstm_onnx", "huggingface"],

    "combination_strategy": "weighted_average",

```    "individual_results": {

Text Input → BiLSTM ONNX (6 emotions) + HuggingFace (7 emotions)      "bilstm": {"emotion": "happy", "confidence": 0.85},

    ↓ (parallel execution)      "huggingface": {"emotion": "joy", "confidence": 0.91}

Weighted Combination (50/50)    },

    ↓    "scores": {...}

Combined Emotion Result  }

```}

```

### Voice Emotion Pipeline

### 2. Voice Emotion Analysis

```

Audio Input → Groq Whisper (STT) → TranscriptionComplete pipeline: **STT → Text Emotion → Voice Emotion → Combined**

    ↓

Text Emotion (BiLSTM + HuggingFace) + Voice Emotion (Wav2Vec2)```http

    ↓POST /api/analyze/voice

Weighted FusionContent-Type: multipart/form-data

    ↓

Final Combined EmotionaudioFile: <binary .wav/.mp3/.ogg/.webm file>

```userId: user123

```

## 🎭 Emotion Models

**Response:**

### Text Analysis (Dual Model)```json

{

1. **BiLSTM ONNX** (Custom Model)  "success": true,

   - 6 emotions: angry, disgust, fear, happy, neutral, sad  "data": {

   - Speed: ~500ms    "transcript": "I'm feeling really happy today",

   - Format: ONNX (CPU optimized)    "transcriptConfidence": 0.95,

    "sttProvider": "groq",

2. **HuggingFace DistilRoBERTa**    "sttModel": "whisper-large-v3-turbo",

   - Model: `j-hartmann/emotion-english-distilroberta-base`    "textEmotion": {

   - 7 emotions: includes surprise      "emotion": "happy",

   - Speed: ~1-2s      "confidence": 0.88,

      "models_used": ["bilstm_onnx", "huggingface"]

### Voice Analysis (Multi-Stage)    },

    "voiceEmotion": {

1. **Groq Whisper** (Speech-to-Text)      "emotion": "happy",

   - Model: `whisper-large-v3-turbo`      "confidence": 0.83

   - Languages: 90+ supported    },

    "emotion": "happy",

2. **HuggingFace Wav2Vec2** (Voice Emotion)    "confidence": 0.86,

   - Model: `superb/wav2vec2-base-superb-er`    "emotionMethod": "combined-weighted"

   - Audio feature analysis  }

}

## 🔧 Configuration```



### Backend Environment Variables### 3. Multi-Modal Analysis



See `backend/.env.example` for complete configuration:```http

POST /api/analyze/multimodal

```envContent-Type: multipart/form-data

# API Keys (Required)

GROQ_API_KEY=your_groq_keyaudioFile: <binary audio>

GEMINI_API_KEY=your_gemini_keytext: "Optional text"

HUGGINGFACE_API_KEY=your_hf_keyuserId: user123

```

# BiLSTM Model (6 emotions)

BILSTM_TEXT_ENABLED=true### 4. LLM Response Generation

BILSTM_LABELS=angry,disgust,fear,happy,neutral,sad

```http

# ServerPOST /api/response/generate

PORT=3000Content-Type: application/json

NODE_ENV=development

```{

  "emotion": "happy",

### Frontend Environment Variables  "context": "User expressed happiness",

  "includeAudio": true

Create `frontend/.env`:}

```

```env

# Backend API URL### 5. Health Check

VITE_API_BASE_URL=http://localhost:3000/api

``````http

GET /api/health

## 🧪 Testing```



### Test Backend## 🎭 Emotion Models



```bash### Text Emotion (Dual Model)

cd backend

#### 1. BiLSTM ONNX (Custom Model)

# Test text analysis- **Format**: ONNX (optimized)

curl -X POST http://localhost:3000/api/analyze/text \- **Emotions**: 6 classes (angry, disgust, fear, happy, neutral, sad)

  -H "Content-Type: application/json" \- **Speed**: ~500ms

  -d '{"text": "I am so happy today!"}'- **Inference**: CPU via ONNX Runtime



# Test voice analysis#### 2. HuggingFace DistilRoBERTa

curl -X POST http://localhost:3000/api/analyze/voice \- **Model**: `j-hartmann/emotion-english-distilroberta-base`

  -F "audio=@test.wav"- **Emotions**: 7 classes (includes surprise)

- **Speed**: ~1-2s

# Health check- **API**: HuggingFace Inference

curl http://localhost:3000/api/health

```**Combination**: Both run in parallel, weighted 50/50 by default



### Test Frontend### Voice Emotion (Multi-Stage)



```bash#### 1. Groq Whisper (Speech-to-Text)

cd frontend- **Model**: `whisper-large-v3-turbo`

npm run dev- **Languages**: 90+ (English, Hindi, etc.)

# Open http://localhost:5173 in browser- **Provider**: Groq Cloud API

```

#### 2. Text Emotion on Transcript

## 📚 Documentation- Uses dual-model approach (BiLSTM + HuggingFace)



- **[Backend Documentation](./backend/README.md)** - API details, endpoints, architecture#### 3. HuggingFace Wav2Vec2 (Voice Emotion)

- **[Frontend Documentation](./frontend/README.md)** - Setup, frameworks, UI guidelines- **Model**: `superb/wav2vec2-base-superb-er`

- **[Backend Detailed Docs](./backend/README_DETAILED.md)** - Comprehensive backend documentation- **Features**: Audio signal analysis

- **Inference**: Local Python

## 🛠️ Development Workflow

## 🔧 Configuration

### Running Both Services

### Environment Variables (.env)

**Terminal 1 - Backend:**

```bash```env

cd backend# Server

npm run devPORT=3000

```NODE_ENV=development



**Terminal 2 - Frontend:**# API Keys (Required)

```bashGROQ_API_KEY=your_groq_key_here

cd frontendGEMINI_API_KEY=your_gemini_key_here

npm run devHUGGINGFACE_API_KEY=your_hf_key_here

```

# BiLSTM ONNX Model (6 emotions)

### Adding FeaturesBILSTM_TEXT_ENABLED=true

BILSTM_MODEL_PATH=./src/models/emotion_bilstm_final.onnx

**Backend:**BILSTM_LABELS=angry,disgust,fear,happy,neutral,sad

1. Add routes in `backend/src/routes/`

2. Implement service logic in respective service folders# HuggingFace Models

3. Update API documentationTEXT_EMOTION_MODEL=j-hartmann/emotion-english-distilroberta-base

VOICE_EMOTION_MODEL=superb/wav2vec2-base-superb-er

**Frontend:**

1. Create components in `frontend/src/components/`# Groq Whisper

2. Add API calls in `frontend/src/services/`GROQ_MODEL=whisper-large-v3-turbo

3. Update UI/UX as neededSTT_LANGUAGE=en  # or 'hi' for Hindi, or omit for auto-detect



## 🚨 Troubleshooting# LLM

LLAMA_ENABLED=true

### Backend IssuesLLAMA_MODEL=llama-3.3-70b-versatile



**"BiLSTM model fails"**# Multi-Modal Fusion Weights

- Ensure Python dependencies installed: `pip install onnxruntime numpy`TEXT_EMOTION_WEIGHT=0.5

- Check model exists: `ls backend/models/emotion_bilstm_final.onnx`VOICE_EMOTION_WEIGHT=0.5



**"API key errors"**# Database

- Verify all keys in `backend/.env`DATABASE_TYPE=supabase  # or 'sqlite'

- Check API rate limitsSUPABASE_URL=your_supabase_url

SUPABASE_ANON_KEY=your_key

### Frontend Issues

# TTS (Optional)

**"Cannot connect to backend"**TTS_ENABLED=false

- Ensure backend is running on port 3000```

- Check CORS settings in backend

- Verify API base URL in frontend `.env`## 📁 Project Structure



**"Build errors"**```

- Clear node_modules: `rm -rf node_modules && npm install`emotion-detection-backend/

- Check Node.js version (18+)├── src/

│   ├── server.js                          # Entry point

## 🎯 Roadmap│   ├── config/

│   │   └── index.js                       # Configuration

### Backend│   ├── routes/

- [x] Dual-model text emotion│   │   ├── textRoutes.js                  # Text API

- [x] Multi-stage voice emotion│   │   ├── voiceRoutes.js                 # Voice API

- [x] Multi-modal fusion│   │   ├── multiModalRoutes.js            # Multi-modal API

- [x] LLM integration (Gemini + LLaMA)│   │   └── healthRoutes.js                # Health check

- [x] ONNX optimization│   ├── text-service/

- [ ] WebSocket support for real-time│   │   ├── index.js                       # Text emotion service

- [ ] Docker containerization│   │   └── bilstm_onnx_inference.py       # BiLSTM ONNX inference

- [ ] Kubernetes deployment│   ├── voice-service/

│   │   ├── index.js                       # Voice emotion service

### Frontend│   │   └── huggingface_emotion.py         # Voice emotion model

- [ ] Dashboard UI│   ├── multi-modal-layer/

- [ ] Text analysis interface│   │   └── index.js                       # Emotion fusion

- [ ] Voice recording + upload│   ├── llm-service/

- [ ] Multi-modal interface│   │   └── index.js                       # Gemini/LLaMA

- [ ] History & analytics│   ├── storage-service/

- [ ] Settings panel│   │   └── index.js                       # Data persistence

- [ ] Dark mode│   ├── models/

- [ ] Mobile responsive│   │   └── emotion_bilstm_final.onnx      # BiLSTM model

- [ ] PWA support│   └── utils/

│       └── logger.js                      # Logging

## 🤝 Contributing├── temp/audio/                            # Temp files

├── data/                                  # SQLite DB

Contributions welcome! Please:├── BILSTM_FIX.md                         # Fix guide

├── SETUP_BILSTM.md                       # Setup guide

1. Fork the repository├── TESTING_GUIDE.md                      # Testing

2. Create feature branch (`git checkout -b feature/amazing-feature`)├── QUICK_REFERENCE.md                    # Quick ref

3. Commit changes (`git commit -m 'Add amazing feature'`)└── README.md                             # This file

4. Push to branch (`git push origin feature/amazing-feature`)```

5. Open Pull Request

## 🧪 Testing

### Code Style

```bash

**Backend:** ES6 modules, async/await, descriptive naming# Test BiLSTM directly

python src/text-service/bilstm_onnx_inference.py \

**Frontend:** TypeScript, functional components, hooks  "src/models/emotion_bilstm_final.onnx" \

  "I am so happy" \

## 📄 License  "angry,disgust,fear,happy,neutral,sad"



ISC# Test APIs

curl -X POST http://localhost:3000/api/analyze/text \

## 🙏 Acknowledgments  -H "Content-Type: application/json" \

  -d '{"text": "I am happy"}'

- **Groq** - Fast Whisper API

- **HuggingFace** - Emotion detection modelscurl -X POST http://localhost:3000/api/analyze/voice \

- **Google** - Gemini LLM  -F "audio=@test.wav"

- **ONNX** - Optimized ML inference```



---## 🚨 Troubleshooting



**Built with ❤️ for emotion-aware AI applications**### BiLSTM Issues



For detailed documentation on specific components, see the respective README files in `backend/` and `frontend/` directories.**"index 6 is out of bounds"**

- ✅ Fixed! Model uses 6 emotions (not 7)
- See [BILSTM_FIX.md](./BILSTM_FIX.md)

**"onnxruntime not installed"**
```bash
pip install onnxruntime numpy
```

**"Model file not found"**
```bash
ls src/models/emotion_bilstm_final.onnx
```

### API Issues

**"Groq API key not configured"**
- Add `GROQ_API_KEY` to `.env`

**"HuggingFace API failed"**
- Verify `HUGGINGFACE_API_KEY` in `.env`
- Check internet connection
- May be rate-limited (wait/retry)

## 📚 Documentation

### Setup & Testing
- [SETUP_BILSTM.md](./SETUP_BILSTM.md) - BiLSTM setup
- [BILSTM_FIX.md](./BILSTM_FIX.md) - Index error fix
- [TESTING_GUIDE.md](./TESTING_GUIDE.md) - Testing guide
- [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) - Quick reference

### Architecture
- [SUMMARY_CHANGES.md](./SUMMARY_CHANGES.md) - Change summary
- Service READMEs in each `src/*/README.md`

## 🎯 Features

- [x] Dual-model text emotion (BiLSTM + HuggingFace)
- [x] Groq Whisper cloud STT
- [x] Voice emotion from audio
- [x] Multi-modal fusion
- [x] Gemini LLM + LLaMA fallback
- [x] ONNX optimization
- [x] Error handling & fallbacks
- [ ] Real-time streaming
- [ ] Docker containerization
- [ ] Monitoring dashboard

## 🤝 Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create feature branch
3. Follow existing code style
4. Add tests and documentation
5. Submit Pull Request

## 📄 License

ISC

## 🙏 Acknowledgments

- **Groq** - Fast Whisper API
- **HuggingFace** - Emotion models
- **Google** - Gemini LLM
- **ONNX** - Optimized inference

---

**Built with ❤️ for emotion-aware AI applications**
