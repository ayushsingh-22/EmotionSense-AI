# Emotion Detection Backend 🎭

A powerful, modular Node.js backend for multi-modal emotion detection that combines **dual-model text analysis** (BiLSTM ONNX + HuggingFace) and **voice analysis** with empathetic AI response generation.

## ✨ Key Features

- 🎭 **Dual-Model Text Emotion**: BiLSTM ONNX + HuggingFace DistilRoBERTa
- 🎤 **Advanced Voice Analysis**: Groq Whisper STT + HuggingFace Wav2Vec2
- 🔄 **Multi-Modal Fusion**: Intelligent weighted combination of text + voice emotions
- 🤖 **Smart LLM Integration**: Google Gemini (primary) with LLaMA fallback via Groq
- 🎵 **Text-to-Speech**: Optional Piper TTS for voice responses
- 📊 **Dual Database**: Supabase (cloud) or SQLite (local)
- ⚡ **ONNX Optimization**: Fast CPU inference with ONNX Runtime
- 🔐 **Production-Ready**: Robust error handling, logging, and fallback mechanisms

## 📊 Emotion Detection Pipeline

### Text Emotion Analysis (Dual Model)
```
Text Input
    ↓
BiLSTM ONNX Model (6 emotions) + HuggingFace DistilRoBERTa (7 emotions)
    ↓ (parallel execution)
Weighted Combination (50/50)
    ↓
Combined Emotion Result
```

### Voice Emotion Analysis (Multi-Stage)
```
Audio Input
    ↓
Groq Whisper API (Speech-to-Text)
    ↓
Transcription
    ↓
┌─────────────────────────┬──────────────────────────┐
│   Text Emotion          │   Voice Emotion          │
│   (from transcript)     │   (from audio features)  │
│   BiLSTM + HuggingFace  │   HuggingFace Wav2Vec2   │
└─────────────────────────┴──────────────────────────┘
    ↓
Weighted Fusion
    ↓
Final Combined Emotion
```

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ 
- **Python** 3.8+
- **API Keys**: Groq, Gemini, HuggingFace

### Installation

```bash
# 1. Clone and install
git clone <repository-url>
cd emotion-detection-backend
npm install

# 2. Install Python dependencies
pip install onnxruntime numpy

# 3. Configure environment
cp .env.example .env
# Edit .env with your API keys

# 4. Verify ONNX model exists
ls src/models/emotion_bilstm_final.onnx

# 5. Start server
npm start
```

### Quick Test

```bash
# Test text emotion
curl -X POST http://localhost:8080/api/analyze/text \
  -H "Content-Type: application/json" \
  -d '{"text": "I am so happy today!"}'

# Test voice emotion
curl -X POST http://localhost:8080/api/analyze/voice \
  -F "audio=@audio.wav"
```

## 📡 API Endpoints

### 1. Text Emotion Analysis

Analyzes text using **BiLSTM ONNX + HuggingFace** in parallel.

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
      "bilstm": {"emotion": "happy", "confidence": 0.85},
      "huggingface": {"emotion": "joy", "confidence": 0.91}
    },
    "scores": {...}
  }
}
```

### 2. Voice Emotion Analysis

Complete pipeline: **STT → Text Emotion → Voice Emotion → Combined**

```http
POST /api/analyze/voice
Content-Type: multipart/form-data

audioFile: <binary .wav/.mp3/.ogg/.webm file>
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
      "models_used": ["bilstm_onnx", "huggingface"]
    },
    "voiceEmotion": {
      "emotion": "happy",
      "confidence": 0.83
    },
    "emotion": "happy",
    "confidence": 0.86,
    "emotionMethod": "combined-weighted"
  }
}
```

### 3. Multi-Modal Analysis

```http
POST /api/analyze/multimodal
Content-Type: multipart/form-data

audioFile: <binary audio>
text: "Optional text"
userId: user123
```

### 4. LLM Response Generation

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

## 🎭 Emotion Models

### Text Emotion (Dual Model)

#### 1. BiLSTM ONNX (Custom Model)
- **Format**: ONNX (optimized)
- **Emotions**: 6 classes (angry, disgust, fear, happy, neutral, sad)
- **Speed**: ~500ms
- **Inference**: CPU via ONNX Runtime

#### 2. HuggingFace DistilRoBERTa
- **Model**: `j-hartmann/emotion-english-distilroberta-base`
- **Emotions**: 7 classes (includes surprise)
- **Speed**: ~1-2s
- **API**: HuggingFace Inference

**Combination**: Both run in parallel, weighted 50/50 by default

### Voice Emotion (Multi-Stage)

#### 1. Groq Whisper (Speech-to-Text)
- **Model**: `whisper-large-v3-turbo`
- **Languages**: 90+ (English, Hindi, etc.)
- **Provider**: Groq Cloud API

#### 2. Text Emotion on Transcript
- Uses dual-model approach (BiLSTM + HuggingFace)

#### 3. HuggingFace Wav2Vec2 (Voice Emotion)
- **Model**: `superb/wav2vec2-base-superb-er`
- **Features**: Audio signal analysis
- **Inference**: Local Python

## 🔧 Configuration

### Environment Variables (.env)

```env
# Server
PORT=8080
NODE_ENV=development

# API Keys (Required)
GROQ_API_KEY=your_groq_key_here
GEMINI_API_KEY=your_gemini_key_here
HUGGINGFACE_API_KEY=your_hf_key_here

# BiLSTM ONNX Model (6 emotions)
BILSTM_TEXT_ENABLED=true
BILSTM_MODEL_PATH=./src/models/emotion_bilstm_final.onnx
BILSTM_LABELS=angry,disgust,fear,happy,neutral,sad

# HuggingFace Models
TEXT_EMOTION_MODEL=j-hartmann/emotion-english-distilroberta-base
VOICE_EMOTION_MODEL=superb/wav2vec2-base-superb-er

# Groq Whisper
GROQ_MODEL=whisper-large-v3-turbo
STT_LANGUAGE=en  # or 'hi' for Hindi, or omit for auto-detect

# LLM
LLAMA_ENABLED=true
LLAMA_MODEL=llama-3.3-70b-versatile

# Multi-Modal Fusion Weights
TEXT_EMOTION_WEIGHT=0.5
VOICE_EMOTION_WEIGHT=0.5

# Database
DATABASE_TYPE=supabase  # or 'sqlite'
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_key

# TTS (Optional)
TTS_ENABLED=false
```

## 📁 Project Structure

```
emotion-detection-backend/
├── src/
│   ├── server.js                          # Entry point
│   ├── config/
│   │   └── index.js                       # Configuration
│   ├── routes/
│   │   ├── textRoutes.js                  # Text API
│   │   ├── voiceRoutes.js                 # Voice API
│   │   ├── multiModalRoutes.js            # Multi-modal API
│   │   └── healthRoutes.js                # Health check
│   ├── text-service/
│   │   ├── index.js                       # Text emotion service
│   │   └── bilstm_onnx_inference.py       # BiLSTM ONNX inference
│   ├── voice-service/
│   │   ├── index.js                       # Voice emotion service
│   │   └── huggingface_emotion.py         # Voice emotion model
│   ├── multi-modal-layer/
│   │   └── index.js                       # Emotion fusion
│   ├── llm-service/
│   │   └── index.js                       # Gemini/LLaMA
│   ├── storage-service/
│   │   └── index.js                       # Data persistence
│   ├── models/
│   │   └── emotion_bilstm_final.onnx      # BiLSTM model
│   └── utils/
│       └── logger.js                      # Logging
├── temp/audio/                            # Temp files
├── data/                                  # SQLite DB
├── BILSTM_FIX.md                         # Fix guide
├── SETUP_BILSTM.md                       # Setup guide
├── TESTING_GUIDE.md                      # Testing
├── QUICK_REFERENCE.md                    # Quick ref
└── README.md                             # This file
```

## 🧪 Testing

```bash
# Test BiLSTM directly
python src/text-service/bilstm_onnx_inference.py \
  "src/models/emotion_bilstm_final.onnx" \
  "I am so happy" \
  "angry,disgust,fear,happy,neutral,sad"

# Test APIs
curl -X POST http://localhost:8080/api/analyze/text \
  -H "Content-Type: application/json" \
  -d '{"text": "I am happy"}'

curl -X POST http://localhost:8080/api/analyze/voice \
  -F "audio=@test.wav"
```

## 🚨 Troubleshooting

### BiLSTM Issues

**"index 6 is out of bounds"**
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
