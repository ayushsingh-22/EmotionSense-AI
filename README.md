# 🧠 EmotionSense AI (MantrAI)

EmotionSense AI (MantrAI) is a full-stack **emotion-intelligence platform** engineered for deep emotional understanding, mental well-being support, and advanced multi-modal AI interaction. With multi-layered ML processing, real-time insights, dual-model emotion inference, journaling automation, crisis-detection, conversational awareness, and a clean next-gen UI — this system aims to transform emotional wellness into a measurable and interactive experience.


[![Node.js](https://img.shields.io/badge/Node.js-18+-green?logo=node.js)](https://nodejs.org/)
[![Python](https://img.shields.io/badge/Python-3.8+-blue?logo=python)](https://python.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase-336791?logo=postgresql)](https://supabase.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow)]()

---

## 📊 Project Showcase

### 📌 Core Features in Action

A complete visual walkthrough of the EmotionSense AI platform — from landing → journaling → insights → safety → real-time emotional chat processing.

---

<table>
  <tr>
    <td align="center"><img src="https://github.com/user-attachments/assets/d6466e7c-2e34-4953-a010-28b620c89775" width="300" height="190"/></td>
    <td align="center"><img src="https://github.com/user-attachments/assets/a12defdc-2744-417c-bada-74c62d18a1d3" width="300" height="190"/></td>
    <td align="center"><img src="https://github.com/user-attachments/assets/ba48c291-b983-42b9-80e3-7cf4e65bbf12" width="300" height="190"/></td>
  </tr>
  <tr>
    <td align="center">🏠 Landing Page</td>
    <td align="center">👋 Welcome Screen</td>
    <td align="center">📅 Journal Calendar</td>
  </tr>

  <tr>
    <td align="center"><img src="https://github.com/user-attachments/assets/9fa9c1b3-d0ec-4338-ba4b-c34782c49246" width="300" height="190"/></td>
    <td align="center"><img src="https://github.com/user-attachments/assets/d61eafb6-eb5e-4cb6-a802-4a4801228973" width="300" height="190"/></td>
    <td align="center"><img src="https://github.com/user-attachments/assets/a4395260-a81d-4602-a134-aa609b6d3a52" width="300" height="190"/></td>
  </tr>
  <tr>
    <td align="center">📊 Insights & Analytics</td>
    <td align="center">📔 AI Journaling System</td>
    <td align="center">🚨 Crisis Response Alert</td>
  </tr>

  <tr>
    <td align="center"><img src="https://github.com/user-attachments/assets/6877c62b-f246-4889-b434-1faf53b28778" width="300" height="190"/></td>
    <td align="center"><img src="https://github.com/user-attachments/assets/43400e20-c4a4-426e-ac70-194ba79d8ef3" width="300" height="190"/></td>
    <td align="center"><img src="https://github.com/user-attachments/assets/82642911-7718-48b1-9247-898f1e6d3ca6" width="300" height="190"/></td>
  </tr>
  <tr>
    <td align="center">💬 Chat History</td>
    <td align="center">💭 Text Input Chat</td>
    <td align="center">🎙 Voice Input Chat</td>
  </tr>
</table>

---

## ✨ Key Features

### 🎭 Multi-Modal Emotion Detection
- **Dual-Model Text Analysis**: BiLSTM ONNX + HuggingFace DistilRoBERTa ensemble
- **Advanced Voice Analysis**: Groq Whisper STT + Wav2Vec2 emotion recognition
- **Intelligent Fusion**: Weighted combination with confidence scoring
- **5-Minute Smart Caching**: Optimized performance and reduced API calls

### 💬 AI-Powered Conversational Support
- **Gemini 2.0 Flash** as primary LLM with **LLaMA 3.3 fallback**
- **Context-Aware Responses**: Leverages chat history for coherent conversations
- **Empathetic AI**: Emotion-specific response customization
- **50+ Languages**: Automatic language detection and multilingual support

### 📔 AI-Powered Daily Journaling
- **Automated Generation**: Nightly journals created at 23:30 IST via cron scheduler
- **LLM-Powered Insights**: Context-aware emotional summaries and patterns
- **Temporal Analysis**: Morning/afternoon/evening emotional progression tracking
- **Manual Creation**: Generate journals for any date on-demand

### 📊 Comprehensive Analytics Dashboard
- **Unified Data Architecture**: Single source of truth via master activity table
- **Daily Summaries**: Mood scores, emotion patterns, and key moments
- **Weekly Trends**: Emotional arc analysis with improvement tracking
- **Timeline Visualization**: Hour-by-hour emotional journey tracking
- **User Statistics**: Streaks, activity metrics, and personal insights

### 🎤 Professional Voice Processing
- **Multi-Format Support**: WAV, MP3, OPUS, OGG with auto-conversion
- **Auto Language Detection**: 90+ languages via Groq Whisper v3
- **Audio Feature Analysis**: Prosody, pitch, energy, and rhythm extraction
- **Multi-Provider TTS**: Google Cloud → Sarvam AI → Murf AI fallback chain

### 🔐 Enterprise Security & Safety
- **Supabase Row-Level Security**: Complete data isolation per user
- **Crisis Detection System**: Advanced keyword and context analysis
- **Emergency Contact Management**: User-configured trusted contact system
- **Automated Alerts**: Multi-provider email notifications with audit logging
- **Safety Audit Trail**: Comprehensive logging of all safety events

### 🌐 Modern Frontend Experience
- **Responsive Design**: Mobile-first with Tailwind CSS and Radix UI
- **Dark Mode**: Automatic theme detection with manual toggle
- **Real-time Visualization**: Waveform display and audio controls
- **Performance Optimized**: Skeleton states and progressive loading
- **Accessible UI**: WCAG compliant with semantic markup

---

## 🛠 Tech Stack

### Backend
| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Runtime** | Node.js 18+ | JavaScript execution environment |
| **Framework** | Express.js | HTTP server & RESTful routing |
| **ML Models** | ONNX Runtime | BiLSTM inference for text emotion |
| **Audio Processing** | FFmpeg, WAV | Format conversion & feature extraction |
| **LLM** | Google Gemini + Groq LLaMA | Intelligent response generation |
| **STT** | Groq Whisper v3 | Speech-to-text with auto language detection |
| **TTS** | Google Cloud, Sarvam AI | Text-to-speech synthesis |
| **Emotion Models** | HuggingFace | DistilRoBERTa, Wav2Vec2 |
| **Database** | Supabase (PostgreSQL) | User data & chat persistence |
| **Cache** | In-Memory | 5-minute emotion analysis cache |

### Frontend
| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Framework** | Next.js 14 | React SSR/SSG with TypeScript |
| **Styling** | Tailwind CSS + Radix UI | Modern component library |
| **State** | Zustand + Context | Global state management |
| **API Client** | Axios | HTTP requests with caching |
| **Database** | Supabase SDK | Real-time DB synchronization |
| **Voice** | Web Audio API | Browser-native recording |
| **Visualization** | WaveSurfer.js | Audio waveform display |

---

## 🚀 Quick Start

### Prerequisites

```bash
✓ Node.js 18+ (npm 9+)
✓ Python 3.8+
✓ Git & GitHub account
✓ API Keys:
  - Google Gemini API
  - Groq API (LLaMA & Whisper)
  - HuggingFace API Token
  - Supabase Project
```

### Backend Setup

```bash
# Navigate to backend
cd backend

# Install dependencies
npm install
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your API keys

# Apply database migrations
psql $SUPABASE_DATABASE_URL -f migrations/create_emergency_contacts.sql

# Start development server
npm run dev
# Backend runs on: http://localhost:8080
```

### Frontend Setup

```bash
# Navigate to frontend
cd frontend

# Install dependencies
npm install

# Configure environment
cp .env.local.example .env.local
# Edit .env.local with API endpoints

# Start development server
npm run dev
# Frontend runs on: http://localhost:3000
```

### Full Stack Launch

```bash
# Terminal 1: Backend
cd backend && npm run dev

# Terminal 2: Frontend
cd frontend && npm run dev

# Application ready at: http://localhost:3000
```

---

## 🗄 Database Architecture

**Unified Data Model** with `master_user_activity` as single source of truth:

- `users` - User profiles and preferences
- `master_user_activity` - All emotional data, chat messages, and analysis
- `chat_sessions` - Chat session metadata
- `messages` - Individual message history
- `emotions` - Emotion analysis logs
- `emergency_contacts` - Crisis support contacts
- `safety_alerts` - Risk event audit trail

Row-Level Security ensures complete user data isolation.

---

## 📁 Project Structure

```
emotion-sense-ai/
├── backend/
│   ├── src/
│   │   ├── server.js
│   │   ├── routes/
│   │   ├── services/
│   │   │   ├── text-service/
│   │   │   ├── voice-service/
│   │   │   ├── llm-service/
│   │   │   ├── journal-service/
│   │   │   └── storage-service/
│   │   └── utils/
│   ├── migrations/
│   ├── models/
│   └── package.json
│
├── frontend/
│   ├── app/
│   │   ├── chat/
│   │   ├── voice/
│   │   ├── insights/
│   │   ├── journal/
│   │   └── settings/
│   ├── components/
│   ├── lib/
│   ├── store/
│   └── package.json
│
└── README.md
```

---

## 📚 Documentation

- **Backend**: `backend/README_DETAILED.md`
- **Frontend Architecture**: `frontend/ARCHITECTURE.md`
- **Journal System**: `backend/JOURNAL_DEVELOPER_GUIDE.md`
- **Unified Data Architecture**: `UNIFIED_DATA_ARCHITECTURE.md`
- **API Endpoints**: Full documentation in backend services

---

## 🔐 Security Features

✅ **Supabase Row-Level Security** - User data isolation  
✅ **JWT Authentication** - Secure session management  
✅ **Input Validation** - Server-side validation  
✅ **CORS Protection** - Controlled cross-origin requests  
✅ **Crisis Detection** - Real-time risk monitoring  
✅ **Audit Logging** - Complete activity tracking  

---

## 🤝 Contributing

### Code Standards
- Follow ESLint rules
- Use TypeScript for type safety
- Write clear commit messages
- Test before pushing

### Development Process
1. Create feature branch: `git checkout -b feature/your-feature`
2. Make changes following code standards
3. Test thoroughly
4. Commit with clear messages
5. Create pull request

---

## 📊 Performance Metrics

- **Text Analysis**: ~50-100ms (with caching)
- **Voice Analysis**: ~1-2s (including transcription)
- **LLM Response**: ~2-5s (depending on provider)
- **Frontend Load**: <2s (optimized build)
- **API Response Cache**: 5 minutes

---

## 🎯 Roadmap

### Planned Features
- 📱 React Native mobile app with offline support
- 🔄 Real-time collaboration and support groups
- ⌚ Wearables integration (smartwatch tracking)
- 🧠 Custom transformer models and federated learning
- 🌍 Expanded language and cultural emotion models
- 📊 Advanced predictive analytics

---

## 📄 License

MIT License - Feel free to use this project for educational and commercial purposes.

---

## 👨‍💻 Author

**Created by**: Ayush Singh

For questions, feature requests, or bug reports, please open an issue on GitHub.

---
