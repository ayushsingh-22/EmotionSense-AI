# Backend - Emotion Detection API

This is the backend service for the Emotion Detection platform.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your API keys

# Start development server
npm run dev

# Start production server
npm start
```

## 📡 API Endpoints

The backend runs on `http://localhost:8080` by default.

### Text Emotion Analysis
```bash
POST /api/analyze/text
Content-Type: application/json

{
  "text": "I am so happy today!",
  "userId": "user123"
}
```

### Voice Emotion Analysis
```bash
POST /api/analyze/voice
Content-Type: multipart/form-data

audioFile: <binary file>
userId: user123
```

### Multi-Modal Analysis
```bash
POST /api/analyze/multimodal
Content-Type: multipart/form-data

audioFile: <binary file>
text: "Optional text"
userId: user123
```

### AI Response Generation
```bash
POST /api/response/generate
Content-Type: application/json

{
  "emotion": "happy",
  "context": "User expressed happiness",
  "includeAudio": true
}
```

### Health Check
```bash
GET /api/health
```

## 🔧 Environment Variables

See `.env.example` for all required environment variables:

- `GROQ_API_KEY` - Groq API for Whisper STT
- `GEMINI_API_KEY` - Google Gemini for LLM
- `HUGGINGFACE_API_KEY` - HuggingFace for emotion models
- `PORT` - Server port (default: 8080)

## 📁 Project Structure

```
backend/
├── src/
│   ├── server.js                    # Entry point
│   ├── config/                      # Configuration
│   ├── routes/                      # API routes
│   ├── text-service/                # Text emotion analysis
│   ├── voice-service/               # Voice emotion analysis
│   ├── multi-modal-layer/           # Emotion fusion
│   ├── llm-service/                 # LLM integration
│   ├── storage-service/             # Data persistence
│   ├── middleware/                  # Express middleware
│   └── utils/                       # Utilities
├── models/                          # ML models (ONNX)
├── data/                            # SQLite database
├── logs/                            # Application logs
├── temp/                            # Temporary files
└── package.json
```

## 🧪 Testing

```bash
# Test text analysis
curl -X POST http://localhost:8080/api/analyze/text \
  -H "Content-Type: application/json" \
  -d '{"text": "I am happy"}'

# Test voice analysis
curl -X POST http://localhost:8080/api/analyze/voice \
  -F "audio=@test.wav"
```

## 📚 Documentation

For complete documentation, see the root README.md file.
