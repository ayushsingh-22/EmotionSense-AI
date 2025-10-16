# Emotion Detection Backend

A powerful, modular Node.js backend for multi-modal emotion detection that combines **dual-model text analysis** (BiLSTM ONNX + HuggingFace) and **voice analysis** with empathetic AI response generation.

## ✨ Key Features

- � **Dual-Model Text Emotion**: BiLSTM ONNX + HuggingFace for robust text emotion detection
- 🎤 **Advanced Voice Analysis**: Groq Whisper (cloud STT) + HuggingFace Wav2Vec2 for voice emotion
- 🔄 **Multi-Modal Fusion**: Intelligent combination of text and voice emotion signals
- 🤖 **Smart LLM Integration**: Google Gemini (primary) with LLaMA fallback
- 🎵 **Text-to-Speech**: Optional Piper TTS for voice responses
- 📊 **Dual Database Support**: Supabase (cloud) or SQLite (local)
- ⚡ **ONNX Optimization**: Fast inference with ONNX Runtime
- 🔐 **Production-Ready**: Robust error handling, logging, and fallback mechanisms

## �🏗️ Architecture

This backend implements a polyrepo-ready microservices architecture:

### Core Services

- **API Gateway** (`src/routes/`): Routes requests to appropriate services
- **Text Service** (`src/text-service/`): 
  - BiLSTM ONNX model for custom emotion detection
  - HuggingFace DistilRoBERTa for state-of-the-art accuracy
  - Weighted combination of both models
- **Voice Service** (`src/voice-service/`): 
  - Groq Whisper API for high-quality speech-to-text
  - Text emotion analysis on transcripts
  - HuggingFace Wav2Vec2 for voice emotion from audio
  - Combined text + voice emotion results
- **Storage Service** (`src/storage-service/`): Manages data persistence (Supabase/SQLite)
- **Multi-Modal Layer** (`src/multi-modal-layer/`): Fuses text and voice emotion analysis
- **LLM Service** (`src/llm-service/`): Generates empathetic responses using Gemini/LLaMA
- **TTS Service** (`src/tts-service/`): Converts text responses to speech (optional)
- **Response Aggregator** (`src/aggregator/`): Combines and formats final responses

### Tech Stack

- **Runtime**: Node.js 18+ with ES6 modules
- **AI/ML**: ONNX Runtime, TensorFlow.js
- **APIs**: Groq (Whisper), HuggingFace, Google Gemini
- **Database**: Supabase (PostgreSQL) / SQLite
- **Speech**: Groq Whisper (STT), Piper TTS

## 🚀 Getting Started

### Prerequisites

- **Node.js** v18 or higher
- **Python** 3.8+ (for ONNX and ML models)
- **npm** or yarn package manager
- **API Keys**:
  - Groq API (for Whisper STT)
  - Google Gemini API (for LLM)
  - HuggingFace API (for emotion models)

### Python Dependencies

```bash
pip install onnxruntime numpy
```

### Installation

```bash
# 1. Clone the repository
git clone <repository-url>
cd emotion-detection-backend

# 2. Install Node dependencies
npm install

# 3. Configure environment variables
cp .env.example .env
# Edit .env and add your API keys

# 4. Create required directories
mkdir -p temp/audio data logs

# 5. Verify ONNX model exists
ls src/models/emotion_bilstm_final.onnx

# 6. Start the server
npm start  # Production
npm run dev  # Development with auto-reload
```

## 📡 API Endpoints

### 1. Text Emotion Analysis

Analyzes text emotion using **dual models** (BiLSTM ONNX + HuggingFace).

```http
POST /api/analyze/text
Content-Type: application/json

{
  "text": "I'm feeling really happy today!",
  "userId": "user123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "emotion": "happy",
    "confidence": 0.88,
    "models_used": ["bilstm_onnx", "huggingface"],
    "combination_strategy": "weighted_average",
    "individual_results": {
      "bilstm": {
        "emotion": "happy",
        "confidence": 0.85
      },
      "huggingface": {
        "emotion": "joy",
        "confidence": 0.91
      }
    },
    "scores": {
      "happy": 0.88,
      "sad": 0.05,
      "angry": 0.03,
      ...
    }
  }
}
```

### 2. Voice Emotion Analysis

Complete voice analysis pipeline: **Groq Whisper STT → Text Emotion (BiLSTM + HuggingFace) → Voice Emotion → Combined Result**

```http
POST /api/analyze/voice
Content-Type: multipart/form-data

audioFile: <binary audio file (.wav, .mp3, .ogg, .webm)>
userId: user123
```

**Response:**
```json
{
  "success": true,
  "data": {
    "transcript": "I'm feeling really happy today",
    "transcriptConfidence": 0.95,
    "sttProvider": "groq",
    "sttModel": "whisper-large-v3-turbo",
    
    "textEmotion": {
      "emotion": "happy",
      "confidence": 0.88,
      "models_used": ["bilstm_onnx", "huggingface"],
      "individual_results": { ... }
    },
    
    "voiceEmotion": {
      "emotion": "happy",
      "confidence": 0.83,
      "model": "huggingface-voice"
    },
    
    "emotion": "happy",
    "confidence": 0.86,
    "scores": { ... },
    "emotionMethod": "combined-weighted"
  }
}
```

### 3. Multi-Modal Analysis

Combines text input and voice input for comprehensive emotion detection.

```http
POST /api/analyze/multimodal
Content-Type: multipart/form-data

audioFile: <binary audio file>
text: "Optional text input"
userId: user123
```

### 4. LLM Response Generation

Generate empathetic AI responses based on detected emotions.

```http
POST /api/response/generate
Content-Type: application/json

{
  "emotion": "happy",
  "context": "User expressed happiness",
  "includeAudio": true
}
```

### 5. Health Check

```http
GET /api/health
```

## 🎭 Emotion Detection Models

### Text Emotion (Dual Model Approach)

#### 1. BiLSTM ONNX Model (Custom)
- **Format**: ONNX (optimized for inference)
- **Architecture**: Embedding → BiLSTM → Attention → Dense
- **Emotions**: 6 classes (angry, disgust, fear, happy, neutral, sad)
- **Input**: Tokenized text (max 80 tokens)
- **Inference**: CPU-based via ONNX Runtime
- **Speed**: ~500ms per prediction

#### 2. HuggingFace DistilRoBERTa
- **Model**: `j-hartmann/emotion-english-distilroberta-base`
- **Architecture**: BERT-based transformer
- **Emotions**: 7 classes (includes surprise)
- **API**: HuggingFace Inference API
- **Speed**: ~1-2s per prediction

#### Combined Approach
- Both models run **in parallel**
- Results combined using **weighted averaging** (50/50 default)
- Fallback to single model if one fails
- Returns individual + combined predictions

### Voice Emotion Pipeline

#### 1. Speech-to-Text: Groq Whisper
- **Model**: `whisper-large-v3-turbo`
- **Provider**: Groq Cloud API
- **Languages**: English, Hindi, and 90+ others
- **Accuracy**: Industry-leading (OpenAI Whisper)
- **Speed**: Fast cloud inference

#### 2. Text Emotion from Transcript
- Transcript analyzed using **BiLSTM + HuggingFace** (dual model)
- Full emotion detection on spoken words
- Captures semantic emotion content

#### 3. Voice Emotion from Audio
- **Model**: `superb/wav2vec2-base-superb-er` (HuggingFace)
- **Features**: Audio signal analysis (tone, pitch, energy)
- **Emotions**: Detected from voice characteristics
- **Inference**: Local Python execution

#### 4. Combined Result
- Text emotion + Voice emotion → **Weighted fusion**
- Final emotion represents both what was said and how it was said

## 🔧 Configuration

### Environment Variables (.env)

```env
# Server Configuration
PORT=3000
NODE_ENV=development
CORS_ORIGIN=*

# API Keys (Required)
GROQ_API_KEY=your_groq_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here
HUGGINGFACE_API_KEY=your_huggingface_api_key_here

# BiLSTM ONNX Model
BILSTM_TEXT_ENABLED=true
BILSTM_MODEL_PATH=./src/models/emotion_bilstm_final.onnx
BILSTM_LABELS=angry,disgust,fear,happy,neutral,sad

# Text Emotion Model (HuggingFace)
TEXT_EMOTION_MODEL=j-hartmann/emotion-english-distilroberta-base

# Voice Emotion Model (HuggingFace)
VOICE_EMOTION_MODEL=superb/wav2vec2-base-superb-er

# Groq Whisper Configuration
GROQ_MODEL=whisper-large-v3-turbo
STT_LANGUAGE=en  # English, or 'hi' for Hindi, or omit for auto-detect

# LLM Configuration
LLAMA_ENABLED=true
LLAMA_MODEL=llama-3.3-70b-versatile

# Multi-Modal Fusion
EMOTION_FUSION_STRATEGY=weighted
TEXT_EMOTION_WEIGHT=0.5
VOICE_EMOTION_WEIGHT=0.5

# Database
DATABASE_TYPE=supabase  # or 'sqlite'
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_key

# TTS (Optional)
TTS_ENABLED=false
PIPER_MODEL_PATH=./models/piper/en_US-lessac-medium.onnx
```

### Model Weights

You can adjust the fusion weights in `.env`:
- `TEXT_EMOTION_WEIGHT=0.7` (prioritize text emotion)
- `VOICE_EMOTION_WEIGHT=0.3` (de-emphasize voice emotion)

## 📁 Project Structure

```
emotion-detection-backend/
├── src/
│   ├── server.js                          # Main entry point
│   ├── config/
│   │   └── index.js                       # Centralized configuration
│   ├── routes/
│   │   ├── textRoutes.js                  # Text emotion endpoints
│   │   ├── voiceRoutes.js                 # Voice emotion endpoints
│   │   ├── multiModalRoutes.js            # Multi-modal endpoints
│   │   ├── responseRoutes.js              # LLM response endpoints
│   │   └── healthRoutes.js                # Health check
│   ├── middleware/
│   │   ├── errorHandler.js                # Global error handling
│   │   ├── requestLogger.js               # Request logging
│   │   └── uploadMiddleware.js            # File upload handling
│   ├── text-service/
│   │   ├── index.js                       # Text emotion service
│   │   ├── bilstm_onnx_inference.py       # BiLSTM ONNX inference
│   │   └── README.md                      # Text service docs
│   ├── voice-service/
│   │   ├── index.js                       # Voice emotion service
│   │   ├── huggingface_emotion.py         # HuggingFace voice model
│   │   └── README.md                      # Voice service docs
│   ├── storage-service/
│   │   ├── index.js                       # Data persistence
│   │   └── README.md                      # Storage docs
│   ├── multi-modal-layer/
│   │   ├── index.js                       # Emotion fusion logic
│   │   └── README.md                      # Multi-modal docs
│   ├── llm-service/
│   │   ├── index.js                       # Gemini/LLaMA integration
│   │   └── README.md                      # LLM docs
│   ├── tts-service/
│   │   ├── index.js                       # Text-to-speech
│   │   └── README.md                      # TTS docs
│   ├── aggregator/
│   │   ├── index.js                       # Response aggregation
│   │   └── README.md                      # Aggregator docs
│   ├── models/
│   │   ├── emotion_bilstm_final.onnx      # BiLSTM ONNX model
│   │   ├── emotion_bilstm_final.h5        # Original Keras model
│   │   └── piper/                         # TTS models
│   └── utils/
│       ├── helpers.js                     # Utility functions
│       └── logger.js                      # Logging utilities
├── temp/
│   └── audio/                             # Temporary audio files
├── data/                                  # SQLite database (if used)
├── logs/                                  # Application logs
├── docs/
│   ├── BILSTM_ONNX_MIGRATION.md          # Migration guide
│   ├── BILSTM_FIX.md                     # Index error fix
│   ├── SETUP_BILSTM.md                   # BiLSTM setup
│   ├── TESTING_GUIDE.md                  # Testing guide
│   ├── QUICK_REFERENCE.md                # Quick reference
│   └── SUMMARY_CHANGES.md                # Change summary
├── .env                                   # Environment variables (create from .env.example)
├── .env.example                           # Environment template
├── package.json                           # Node.js dependencies
└── README.md                              # This file
```

## 🔌 Polyrepo Architecture

This backend is designed to work independently from the frontend:

- **Backend**: This repository (API server)
- **Frontend**: Separate repository (Android/Web/App)
- **Communication**: RESTful API with JSON responses
- **Deployment**: Can be deployed independently on different platforms
- **Scalability**: Each service can be extracted into its own microservice

## 🧪 Testing

### Quick Test Commands

```bash
# Test BiLSTM ONNX model directly
python src/text-service/bilstm_onnx_inference.py \
  "src/models/emotion_bilstm_final.onnx" \
  "I am so happy today" \
  "angry,disgust,fear,happy,neutral,sad"

# Test text emotion API
curl -X POST http://localhost:3000/api/analyze/text \
  -H "Content-Type: application/json" \
  -d '{"text": "I am feeling great!"}'

# Test voice emotion API
curl -X POST http://localhost:3000/api/analyze/voice \
  -F "audio=@test_audio.wav" \
  -F "userId=test_user"
```

## 🛠️ Development

### Adding New Emotion Models

1. Add model file to `src/models/`
2. Create inference script (Python or JavaScript)
3. Update configuration in `src/config/index.js`
4. Modify service module (`text-service` or `voice-service`)
5. Update fusion logic in `multi-modal-layer` if needed
6. Test with sample data

### Switching LLM Providers

The system automatically falls back to LLaMA if Gemini is unavailable. Configure in `.env`:

```
LLAMA_ENABLED=true
LLAMA_API_URL=http://localhost:8080/api/generate
```

## � Documentation

### Core Documentation
- **[Getting Started Guide](./GETTING_STARTED.md)** - Quick start instructions and setup
- **[API Documentation](./API_DOCUMENTATION.md)** - Complete API reference with examples
- **[Project Summary](./PROJECT_SUMMARY.md)** - High-level architecture and overview
- **[Deployment Guide](./DEPLOYMENT.md)** - Production deployment instructions
- **[Testing Examples](./TESTING_EXAMPLES.md)** - API testing with PowerShell, cURL, JavaScript, Python
- **[Checklist](./CHECKLIST.md)** - Implementation status and TODO tracking
- **[Supabase Setup](./SUPABASE_SETUP.md)** - Database setup and configuration guide

### Service Documentation
Each service directory contains its own README with detailed information:
- [Text Service README](./src/text-service/README.md)
- [Voice Service README](./src/voice-service/README.md)
- [Multi-Modal Layer README](./src/multi-modal-layer/README.md)
- [LLM Service README](./src/llm-service/README.md)
- [TTS Service README](./src/tts-service/README.md)
- [Storage Service README](./src/storage-service/README.md)
- [Aggregator README](./src/aggregator/README.md)

### Helper Scripts
- **setup.ps1** - Automated setup script (PowerShell)
- **test-api.ps1** - API testing script (PowerShell)

## �📝 License

ISC

## 🤝 Contributing

Contributions welcome! Please follow the existing code structure and add appropriate documentation.
