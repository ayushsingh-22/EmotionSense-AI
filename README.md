# 🧠 EmotionSense AI (MantrAI) - Comprehensive AI Emotion Platform

A **full-stack AI-powered emotion detection platform** featuring **unified data architecture**, **dual-model text analysis**, **advanced voice processing**, **intelligent insights**, **auto-journaling**, and **empathetic AI responses**. Built with modern web technologies for real-time emotion tracking, analysis, and mental wellness support.

---

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [🆕 Latest Features](#latest-features)
3. [Tech Stack](#tech-stack)
4. [Architecture](#architecture)
5. [Core Features](#core-features)
6. [Project Structure](#project-structure)
7. [Setup & Installation](#setup--installation)
8. [Backend Services](#backend-services)
9. [Frontend Architecture](#frontend-architecture)
10. [API Endpoints](#api-endpoints)
11. [Database Schema](#database-schema)
12. [Unified Data Architecture](#unified-data-architecture)
13. [Emotion Detection Pipeline](#emotion-detection-pipeline)
14. [Configuration Guide](#configuration-guide)
15. [Development Workflows](#development-workflows)
16. [Deployment](#deployment)
17. [Troubleshooting](#troubleshooting)

---

## 🎯 Project Overview

**EmotionSense AI** (MantrAI) is an advanced emotion detection and mental wellness platform that provides comprehensive emotional insights through multiple channels. It combines cutting-edge AI models with an intuitive interface to offer:

- **📊 Real-time Emotion Detection** - Multi-modal analysis via text and voice
- **🧠 Intelligent Insights** - Advanced analytics and emotional patterns
- **📔 Auto-Journaling** - AI-powered daily emotional reflections  
- **💬 Empathetic Chat** - Context-aware AI conversations with safety features
- **📈 Unified Analytics** - Consistent data across all features via master activity table
- **🆘 Safety Support** - Emergency contact system with automated alerts
- **🎤 Voice Processing** - Advanced speech emotion analysis
- **🌍 Multi-language** - Automatic language detection and response

### ✨ Key Differentiators
- **Unified Data Architecture** - Single source of truth for all emotional data
- **Dual-Model Accuracy** - BiLSTM + HuggingFace ensemble for superior predictions
- **Enterprise Safety** - Built-in crisis detection and emergency contact system
- **Performance Optimized** - Response caching, connection pooling, optimized queries
- **Production Ready** - Comprehensive error handling, logging, and monitoring

---

## 🆕 Latest Features

### 📊 **Unified Data Architecture (Nov 2025)**
- **🎯 Single Source of Truth**: All features (chat, history, insights, journal) now use `master_user_activity` table
- **📈 Data Consistency**: No more inconsistencies between different sections
- **⚡ Performance**: Optimized queries with unified data access patterns
- **🔄 Migration Complete**: Automatic migration from legacy tables

### 📔 **AI-Powered Daily Journaling**
- **🕐 Auto-Generation**: Nightly journal creation at 23:30 IST using cron scheduler
- **🤖 AI Reflections**: Gemini/LLaMA-powered emotional summaries and insights
- **📊 Emotion Tracking**: Daily mood scores, emotion distributions, and patterns
- **⏰ Time Segments**: Morning/afternoon/evening emotional progression analysis
- **📅 Manual Creation**: On-demand journal generation for any date
- **🔐 Secure Storage**: Supabase RLS-protected journal data

### 📈 **Advanced Insights Dashboard**
- **📊 User Statistics**: Comprehensive emotion analytics and trends
- **🎯 Key Moments**: AI-identified emotional highlights and significant events  
- **📅 Daily/Weekly Views**: Detailed breakdowns with mood progression
- **📈 Emotion Timeline**: Visual emotion journey with confidence scores
- **🔍 Smart Filtering**: Advanced search and filtering capabilities

### 🔄 **Enhanced Chat Experience**
- **💾 Session Persistence**: Unified chat history across all devices
- **🧠 Context Awareness**: Improved conversation memory with emotional context
- **🌍 Language Support**: Automatic detection and multilingual responses
- **⚡ Performance**: Optimized message loading and session management

### 🛡️ **Enhanced Safety Features**
- **🚨 Advanced Risk Detection**: Improved keyword scanning and context analysis
- **📧 Reliable Alerts**: Enhanced emergency contact notification system
- **📝 Audit Logging**: Comprehensive safety event tracking
- **🔧 Admin Controls**: Better management tools for safety configurations

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
| **Email Alerts** | Nodemailer (Gmail/SMTP/SendGrid) | Emergency notifications |
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
  │  Safety Analysis & Alerting         │
  │ • High-Risk Keyword Scan            │
  │ • Emergency Contact Lookup          │
  │ • Alert Logging & Notification      │
  └────────┬────────────────────────────┘
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

### 🏗️ **Unified System Architecture**

EmotionSense AI now features a **unified data architecture** with the `master_user_activity` table as the single source of truth for all emotional and chat data. This architectural evolution ensures data consistency and provides a foundation for advanced features.

```
📊 MASTER USER ACTIVITY TABLE (Single Source of Truth)
├─ user_id (RLS Protected)
├─ activity_type (emotion_analysis | chat_message | ai_response)  
├─ emotion_data (JSON: emotion, confidence, scores)
├─ content (text/message content)
├─ metadata (JSON: model_info, audio_features, etc.)
├─ session_id (chat grouping)
├─ created_at (temporal tracking)
└─ updated_at (modification tracking)
```

### Service Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    🎭 EMOTIONSENSE AI PLATFORM                  │
├─────────────────────────────────────────────────────────────────┤
│                        EXPRESS SERVER                          │
│ • CORS Middleware • Error Handler • Request Logger • Upload     │
└─────────────────────────┬───────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
   ┌────▼─────┐    ┌─────▼──────┐    ┌───▼────────┐
   │TEXT      │    │VOICE       │    │LLM         │
   │SERVICE   │    │SERVICE     │    │SERVICE     │
   │          │    │            │    │            │
   │•BiLSTM   │    │•Groq STT   │    │•Gemini 2.0 │
   │•HuggingF │    │•Wav2Vec2   │    │•LLaMA 3.3  │
   │•5min     │    │•Audio      │    │•Context    │
   │ Cache    │    │ Features   │    │ Aware      │
   └────┬─────┘    └─────┬──────┘    └────┬───────┘
        │                │                │
        └────────────────┼────────────────┘
                        │
        ┌───────────────▼──────────────────┐
        │    ⚖️ MULTI-MODAL FUSION LAYER    │
        │ •Weighted Combination             │
        │ •Confidence Scoring               │
        │ •Result Normalization             │
        └───────────────┬──────────────────┘
                       │
   ┌────────────────────▼─────────────────────────────┐
   │        📊 MASTER ACTIVITY SERVICE                │
   │    (Unified Data Management Layer)               │
   │                                                  │
   │ •Single Source of Truth for All Data            │
   │ •Activity Type Management                        │
   │ •Temporal Analysis Functions                     │
   │ •Cross-Feature Data Access                       │
   │ •Emotion Score Calculations                      │
   └────────────────────┬─────────────────────────────┘
                       │
        ┌──────────────┼──────────────────┐
        │              │                  │
   ┌────▼──────┐  ┌───▼─────┐     ┌──────▼───────┐
   │📔JOURNAL  │  │💬CHAT   │     │📈INSIGHTS    │
   │SERVICE    │  │SERVICE  │     │SERVICE       │
   │           │  │         │     │              │
   │•Auto Cron │  │•Session │     │•Daily Summary│
   │•AI Reflex │  │•Context │     │•Weekly Trend │
   │•Emotion   │  │•History │     │•Key Moments  │
   │ Analysis  │  │•Real-time│     │•Statistics   │
   └───────────┘  └─────────┘     └──────────────┘
                       │
        ┌──────────────┼──────────────────┐
        │              │                  │
   ┌────▼──────┐  ┌───▼─────┐     ┌──────▼───────┐
   │🔊TTS      │  │🗄️STORAGE│     │⚡AGGREGATOR  │
   │SERVICE    │  │SERVICE  │     │              │
   │           │  │         │     │•Orchestration│
   │•Google    │  │•Supabase│     │•Error Handle │
   │•Piper     │  │•RLS     │     │•Performance  │
   │•Sarvam    │  │•Auth    │     │ Monitor      │
   └───────────┘  └─────────┘     └──────────────┘

  Safety-specific utilities (`emergencyNotifier`, `safetyHelper`, `nodemailerHelper`) plug into the chat request flow, allowing high-risk detections to query master_user_activity for patterns and dispatch alerts without blocking the main response pipeline.
```

---

## ✨ Core Features

### 🎭 **Multi-Modal Emotion Detection**
- **🔄 Unified Architecture**: All emotion data flows through `master_user_activity` table
- **🎯 Dual-Model Text Analysis**: BiLSTM ONNX + HuggingFace DistilRoBERTa ensemble
- **🎤 Advanced Voice Analysis**: Groq Whisper STT + HuggingFace Wav2Vec2 + audio features
- **⚖️ Intelligent Fusion**: Weighted combination with confidence scoring
- **⚡ Performance Caching**: 5-minute intelligent caching system
- **📊 Confidence Metrics**: Detailed prediction confidence and model comparison

### 🤖 **AI Response & LLM Integration**
- **🧠 Primary LLM**: Google Gemini 2.0 Flash (state-of-the-art reasoning)
- **🔄 Smart Fallback**: LLaMA 3.3 70B via Groq with automatic failover
- **💭 Context-Aware**: Reads last 5-10 messages for coherent conversations
- **❤️ Empathetic Prompts**: Emotion-specific response customization
- **🌍 Multilingual**: Auto-detection and response in 50+ languages
- **🎛️ Configurable**: Adjustable temperature, max tokens, and safety settings

### 📊 **Comprehensive Insights & Analytics**
- **📈 Unified Dashboard**: Consistent data across all sections
- **📅 Daily Summaries**: Mood scores, emotion patterns, and message analysis
- **📊 Weekly Insights**: Trend analysis with emotional arcs and highlights
- **🎯 Key Moments**: AI-identified significant emotional events
- **📊 User Statistics**: Activity tracking, emotion distribution, and streaks
- **⏰ Timeline Views**: Hour-by-hour and date-range emotional progression

### 📔 **AI-Powered Journaling System**
- **🕐 Automated Generation**: Nightly cron scheduler (23:30 IST)
- **🤖 AI Reflection**: Context-aware emotional summaries using LLM
- **📊 Emotion Analysis**: Daily mood scores and dominant emotion tracking
- **⏰ Time Progression**: Morning/afternoon/evening emotional patterns
- **📝 Manual Creation**: On-demand journal generation for any date
- **🔍 Smart Retrieval**: Date-based and list-based journal access

### 🎤 **Advanced Voice Processing**
- **🎯 Multi-Stage Pipeline**: STT → Text Analysis → Voice Features → Fusion
- **🌍 Auto-Language Detection**: Groq Whisper v3 Turbo with 90+ languages
- **📊 Audio Feature Analysis**: Prosody, pitch, energy, and rhythm analysis
- **🔊 TTS Synthesis**: Multi-provider (Google → Piper → Sarvam) fallbacks
- **📱 Format Support**: WAV, MP3, OPUS, OGG with auto-conversion

### 💬 **Enhanced Chat System**
- **🔄 Unified Data**: Session and message data from master activity table
- **📚 Smart Context**: Conversation history with emotional awareness
- **💾 Session Management**: Persistent chat sessions with metadata
- **🔄 Real-time Updates**: WebSocket support for live interactions
- **👤 User Isolation**: Row-Level Security with JWT authentication
- **📱 Multi-device**: Synchronized chat history across platforms

### 🎨 **Modern Frontend Experience**
- **📱 Responsive Design**: Mobile-first with Tailwind CSS and Radix UI
- **🌙 Dark Mode**: Automatic theme detection with manual toggle
- **🎤 Voice Controls**: Browser-native recording with visualization
- **📊 Waveform Display**: Real-time audio visualization with WaveSurfer.js
- **📈 Performance Monitoring**: Built-in API response tracking
- **🔍 Smart Search**: Chat history search with emotion filtering
- **⚡ Optimized Loading**: Skeleton states and progressive loading

### 🔐 **Enterprise Security & Safety**
- **🛡️ Supabase RLS**: Row-Level Security for complete data isolation
- **🔐 JWT Authentication**: Secure sessions with automatic refresh
- **🌐 CORS Protection**: Controlled cross-origin resource sharing
- **✅ Input Validation**: Comprehensive server-side validation
- **🚨 Safety Monitoring**: Real-time risk detection and alerting
- **📊 Audit Logging**: Comprehensive activity and safety logging

### 🆘 **Crisis Support & Safety**
- **👥 Emergency Contacts**: User-configurable trusted contact system
- **🚨 Risk Detection**: Advanced keyword and context analysis
- **📧 Automated Alerts**: Multi-provider email notification system
- **📝 Safety Logging**: Complete audit trail with RLS protection
- **💬 Gentle Prompts**: Non-intrusive setup flows and safety reminders
- **🔧 Admin Controls**: Management interface for safety configurations

### 🔧 **DevOps & Monitoring**
- **📊 Performance Tracking**: Request timing and error monitoring
- **📝 Comprehensive Logging**: Structured logging with correlation IDs
- **🔄 Health Checks**: Automated service health monitoring
- **🎛️ Configuration Management**: Environment-based config system
- **🐛 Error Handling**: Graceful degradation and error recovery
- **📈 Analytics**: Usage analytics and performance metrics

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
│   │   │   ├── chatRoutes.js            # Enhanced chat session endpoints
│   │   │   ├── emergencyRoutes.js       # Emergency contact management
│   │   │   ├── textRoutes.js            # Text emotion endpoints
│   │   │   ├── voiceRoutes.js           # Voice emotion endpoints
│   │   │   ├── multiModalRoutes.js      # Combined emotion endpoints
│   │   │   ├── responseRoutes.js        # LLM response endpoints
│   │   │   ├── ttsRoutes.js             # Text-to-speech endpoints
│   │   │   ├── journalRoutes.js         # 📔 AI journaling endpoints
│   │   │   ├── insightsRoutes.js        # 📊 Analytics endpoints
│   │   │   └── healthRoutes.js          # Health check endpoints
│   │   ├── storage-service/
│   │   │   ├── index.js                 # Legacy Supabase ORM layer
│   │   │   ├── masterActivityService.js # 🎯 UNIFIED DATA SERVICE
│   │   │   ├── masterActivityIntegration.js # Legacy migration support
│   │   │   ├── unifiedChatService.js    # 💬 Unified chat data access
│   │   │   └── README.md                # Service documentation
│   │   ├── journal-service/             # 📔 AI JOURNALING SYSTEM
│   │   │   ├── index.js                 # Journal generation & management
│   │   │   ├── cronScheduler.js         # Automated nightly journals (23:30 IST)
│   │   │   ├── journalGenerator.js      # LLM-powered journal creation
│   │   │   └── README.md                # Journaling feature documentation
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
│   │   │   ├── index.js                 # LLM response generation (Gemini → LLaMA)
│   │   │   └── README.md                # Service documentation
│   │   ├── tts-service/
│   │   │   ├── index.js                 # Text-to-speech synthesis
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
│   │   │   ├── emergencyNotifier.js     # Safety alert orchestration
│   │   │   ├── safetyHelper.js          # High-risk detection helpers
│   │   │   ├── nodemailerHelper.js      # Email provider abstraction
│   │   │   └── voiceHelper.js           # Voice utilities
│   │   └── models/
│   │       └── emotion_bilstm_final.onnx # BiLSTM model file
│   ├── migrations/                      # Database Schema Evolution
│   │   ├── add_audio_features_column.sql          # Audio feature storage
│   │   ├── create_alert_logs_table.sql            # Initial alert logging schema
│   │   ├── create_alert_logs_table_FIXED.sql      # Patched alert logging schema
│   │   ├── create_emergency_contacts.sql          # Emergency contacts + safety alerts
│   │   ├── 20251115_create_emotion_insights_complete.sql  # 📊 Unified insights schema
│   │   ├── 20241115_emotion_flow_extensions.sql   # Master activity table
│   │   ├── 20241117_align_messages_schema.sql     # Schema alignment
│   │   ├── create_chat_tables.sql                 # Chat system tables
│   │   ├── create_daily_emotion_summary.sql       # Daily aggregation views
│   │   └── create_weekly_emotion_summary.sql      # Weekly aggregation views
│   ├── scripts/                         # Utility Scripts
│   │   ├── generate-insights-from-messages.js     # Data migration utilities
│   │   ├── migrate-to-master-activity.js          # Legacy data migration
│   │   ├── populate-emotions.js                   # Test data generation
│   │   └── cleanup-legacy-tables.js               # Database cleanup
│   ├── .env                             # Environment variables
│   ├── .env.example                     # Environment template
│   ├── package.json                     # Dependencies
│   ├── requirements.txt                 # Python dependencies
│   ├── test-*.js                        # Test scripts
│   ├── JOURNAL_DEVELOPER_GUIDE.md       # 📔 Journal system documentation
│   ├── VERIFICATION_REPORT.md           # System verification status
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
│   │   │   ├── page.tsx                 # 💬 Enhanced chat interface
│   │   │   ├── enhanced-page.tsx        # Enhanced chat version
│   │   │   └── page-optimized.tsx       # Optimized version
│   │   ├── insights/                    # 📊 ANALYTICS DASHBOARD
│   │   │   ├── page.tsx                 # Main insights dashboard
│   │   │   ├── daily/page.tsx           # Daily emotion summaries
│   │   │   ├── weekly/page.tsx          # Weekly trend analysis
│   │   │   └── timeline/page.tsx        # Emotional timeline view
│   │   ├── journal/                     # 📔 AI JOURNALING INTERFACE
│   │   │   ├── page.tsx                 # Journal list & management
│   │   │   ├── create/page.tsx          # Manual journal creation
│   │   │   ├── [date]/page.tsx          # View specific journal entry
│   │   │   └── layout.tsx               # Journal section layout
│   │   ├── history/                     # 📊 UNIFIED HISTORY
│   │   │   ├── page.tsx                 # Enhanced history view
│   │   │   ├── emotions/page.tsx        # Emotion analysis history
│   │   │   └── conversations/page.tsx   # Chat conversation history
│   │   ├── text/page.tsx                # Text analysis page
│   │   ├── voice/page.tsx               # Voice analysis page
│   │   ├── multimodal/page.tsx          # Multi-modal analysis page
│   │   ├── profile/page.tsx             # User profile page
│   │   ├── settings/page.tsx            # Settings page
│   │   ├── setup/
│   │   │   └── emergency-contact/page.tsx # Guided emergency contact onboarding
│   │   └── globals.css                  # Global styles
│   ├── components/
│   │   ├── EmergencyContactChecker.tsx  # Safety prompt modal wrapper
│   │   ├── navbar.tsx                   # Navigation bar
│   │   ├── sidebar.tsx                  # Side navigation
│   │   ├── MainContent.tsx              # Main content wrapper
│   │   ├── LoadingStates.tsx            # Loading skeletons
│   │   ├── theme-provider.tsx           # Theme wrapper
│   │   ├── theme-toggle.tsx             # Dark mode toggle
│   │   ├── insights/                    # 📊 ANALYTICS COMPONENTS
│   │   │   ├── InsightsDashboard.tsx    # Main dashboard layout
│   │   │   ├── EmotionChart.tsx         # Emotion distribution charts
│   │   │   ├── MoodTimeline.tsx         # Temporal mood visualization
│   │   │   ├── WeeklyTrends.tsx         # Weekly pattern analysis
│   │   │   ├── KeyMoments.tsx           # Significant event highlights
│   │   │   ├── StatsCards.tsx           # Summary statistics
│   │   │   └── EmotionDistribution.tsx  # Pie/bar charts
│   │   ├── journal/                     # 📔 JOURNALING COMPONENTS
│   │   │   ├── JournalEntry.tsx         # Individual journal display
│   │   │   ├── JournalList.tsx          # Journal entries list
│   │   │   ├── JournalCalendar.tsx      # Calendar view for journals
│   │   │   ├── EmotionSummary.tsx       # Daily emotion summary
│   │   │   ├── GenerateJournalButton.tsx # Manual journal trigger
│   │   │   └── JournalFilters.tsx       # Date/emotion filtering
│   │   ├── auth/
│   │   │   ├── AuthGuard.tsx            # Route protection
│   │   │   ├── DeleteConfirmationDialog.tsx
│   │   │   ├── EmergencyContactForm.tsx # Create/update safety contact
│   │   │   └── EmergencyContactModal.tsx # Modal experience for prompts
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
│   │   ├── ChatContext.tsx              # Enhanced chat state & methods
│   │   └── SidebarContext.tsx           # Sidebar state
│   ├── hooks/
│   │   ├── use-toast.ts                 # Toast hook
│   │   ├── useEmergencyContactSetup.ts  # Safety setup logic
│   │   ├── useVoiceRecorder.ts          # Voice recording logic
│   │   └── useVoiceRecording.ts         # Alternative recording
│   ├── lib/
│   │   ├── api.ts                       # Enhanced API client with caching
│   │   ├── supabase.ts                  # Supabase client
│   │   ├── performance.ts               # Performance monitoring
│   │   └── utils.ts                     # Utility functions
│   ├── store/
│   │   └── useStore.ts                  # Zustand global store with persistence
│   ├── types/
│   │   └── index.ts                     # Enhanced TypeScript interfaces
│   ├── styles/
│   │   ├── globals.css                  # Global styles
│   │   ├── chat-enhancements.css        # Chat styling
│   │   └── chat-optimized.css           # Optimized styling
│   ├── package.json                     # Dependencies
│   ├── tsconfig.json                    # TypeScript config
│   ├── tailwind.config.ts               # Tailwind config
│   ├── postcss.config.mjs               # PostCSS config
│   ├── README_JOURNAL_FEATURE.md        # 📔 Journal feature documentation
│   ├── ARCHITECTURE.md                  # Frontend architecture guide
│   └── next.config.mjs                  # Next.js config
│
├── .github/
│   └── copilot-instructions.md          # Project development guidelines
│
├── UNIFIED_DATA_ARCHITECTURE.md         # 🎯 Unified architecture documentation
├── MASTER_ARCHITECTURE_*.md             # Architecture migration guides
├── GLOBAL_DATA_CONSISTENCY_FIX.md       # Data consistency documentation
├── EMOTION_SYSTEM_QUICK_REFERENCE.md    # Quick reference guide
├── DEPLOYMENT_CHECKLIST.md              # Production deployment guide
├── QUICK_START_MASTER_ARCHITECTURE.md   # Quick start guide
└── README.md                            # This comprehensive documentation
```

---

## 🆕 Recent Major Updates (2024)

### 🎯 **Unified Data Architecture** 
**The biggest architectural advancement in the project's history**

- **Single Source of Truth**: All emotional and chat data now flows through the `master_user_activity` table
- **Data Consistency**: Unified schema eliminates data duplication and inconsistencies
- **Cross-Feature Integration**: Journal, insights, chat, and analytics all use the same data source
- **Enhanced Performance**: Optimized queries and reduced database complexity
- **Future-Proof**: Scalable architecture supports new features without major refactoring

### 📔 **AI-Powered Daily Journaling System**
**Automated emotional reflection and analysis**

- **Automated Generation**: Cron scheduler creates journals nightly at 23:30 IST
- **AI Reflection**: LLM analyzes daily emotional patterns and creates thoughtful summaries
- **Emotion Analysis**: Tracks dominant emotions, mood scores, and temporal patterns
- **Manual Creation**: Users can generate journals for any date on-demand
- **Smart Retrieval**: Date-based access and comprehensive journal management

### 📊 **Comprehensive Insights & Analytics Dashboard** 
**Deep emotional intelligence and pattern recognition**

- **Daily Summaries**: Detailed emotion analysis, message counts, and key moments
- **Weekly Trends**: Emotional arc analysis with highlights and improvement tracking
- **Timeline Views**: Hour-by-hour and date-range emotional progression visualization
- **User Statistics**: Activity tracking, streaks, and personal improvement metrics
- **Key Moments Detection**: AI-identified significant emotional events and patterns

### 💬 **Enhanced Chat System**
**Unified and context-aware conversational AI**

- **Unified Data**: All chat data flows through the master activity architecture
- **Context Awareness**: Improved conversation history integration with emotional context
- **Enhanced UI**: Better performance, loading states, and user experience
- **Session Management**: Improved session persistence and cross-device synchronization
- **Real-time Features**: Better WebSocket integration and live updates

### 🔧 **Developer Experience Improvements**
**Enhanced development workflow and documentation**

- **Comprehensive Documentation**: Complete API documentation, architecture guides, and quick-start guides
- **Migration Scripts**: Automated tools for data consistency and legacy system migration
- **Testing Suite**: Enhanced testing scripts for journal, insights, and unified data validation
- **Performance Monitoring**: Built-in performance tracking and optimization tools
- **Configuration Management**: Streamlined environment setup and configuration

---

## 🚀 What's Next?

### **Planned Features**
- **🌍 Mobile App**: React Native app with offline support
- **🔄 Real-time Collaboration**: Multi-user emotion sharing and support groups
- **📱 Wearables Integration**: Smartwatch emotion tracking and heart rate analysis  
- **🧠 Advanced ML**: Custom transformer models and federated learning
- **🎯 Personalization**: Adaptive UI and personalized insights algorithms
- **🌐 Multi-language Support**: Expanded language coverage and cultural emotion models

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

# 6. Run emergency contact migrations (Supabase service role required)
psql $SUPABASE_DATABASE_URL -f migrations/create_emergency_contacts.sql

# 7. Verify ONNX model file
ls -la src/models/emotion_bilstm_final.onnx

# 8. Start development server
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
- [ ] Emergency contact migration applied (tables visible in Supabase)
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
- `emergency_contacts`: Trusted contacts per user (unique)
- `safety_alerts`: High-risk message audit trail

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

// Emergency Contacts
getEmergencyContact(userId)
hasEmergencyContact(userId)
createOrUpdateEmergencyContact(userId, name, email, phone?)
deleteEmergencyContact(userId)
logSafetyAlert(userId, emotion, message, contactId?, alertSent?)
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

### 8. **Emergency & Safety Service** (`src/routes/emergencyRoutes.js` + `src/utils/emergencyNotifier.js`)
Safeguards users by monitoring high-risk language and managing emergency outreach.

**Features:**
- Emergency contact CRUD with Supabase RLS and REST endpoints
- High/medium risk keyword detection configurable via environment
- Automated email alerts via Nodemailer with per-contact opt-in (`notify_enabled`)
- Persistent `safety_alerts` logging for auditability and analytics
- Optional escalation hooks reusable across services

**Key Endpoints:**
```http
POST /api/emergency/save        # Create or replace contact
POST /api/emergency/update      # Update existing contact (PUT supported)
GET  /api/emergency/:userId     # Fetch saved contact
GET  /api/emergency/check/:id   # Boolean presence check
DELETE /api/emergency/:userId   # Remove contact
GET  /api/emergency/email/status# Inspect email provider configuration
```

**Sample Alert Log:**
```json
{
  "user_id": "uuid",
  "detected_emotion": "sad",
  "message_text": "I don't want to live anymore",
  "alert_sent": true,
  "alert_sent_at": "2025-11-13T10:32:45.120Z",
  "emergency_contact_id": "contact-uuid"
}
```

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
├── Safety Setup
│   ├── EmergencyContactForm (guided onboarding)
│   └── EmergencyContactModal (in-app reminders)
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
// - Emergency contact helpers (`hasEmergencyContact`, `saveEmergencyContact`, etc.)
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

### 🔐 Authentication (Supabase)
```
POST   /auth/signup           - Register new user
POST   /auth/login            - Login user
POST   /auth/logout           - Logout user
GET    /auth/profile          - Get user profile
```

### 📝 Text Analysis
```
POST   /api/analyze/text
Content-Type: application/json

Request:
{
  "text": "I am feeling great!",
  "includeIndividualResults": true
}

Response: TextAnalysisResult (includes unified data save)
```

### 🎤 Voice Analysis
```
POST   /api/analyze/voice
Content-Type: multipart/form-data

Request:
- audio: <audio-file>

Response: VoiceAnalysisResult (includes unified data save)
```

### 💬 Enhanced Chat System
```
POST   /api/chat/message
Content-Type: application/json
Authorization: Bearer <JWT>

Request:
{
  "message": "Hello, how are you?",
  "sessionId": "optional-uuid",
  "memoryLength": 10,
  "enableTts": true
}

Response:
{
  "response": "AI response text",
  "emotion": "happy",
  "sessionId": "uuid",
  "audioUrl": "/api/tts/audio/file.wav",
  "messageId": "uuid",
  "conversationContext": { "messageCount": 5, "emotionalTrend": "improving" }
}

GET    /api/chat/sessions         - List user sessions
GET    /api/chat/sessions/:id     - Get session details
POST   /api/chat/sessions         - Create new session
DELETE /api/chat/sessions/:id     - Delete session
GET    /api/chat/history/:userId  - Get unified chat history from master_user_activity
```

### 📔 AI-Powered Journaling System
```
POST   /api/journal/generate
Content-Type: application/json
Authorization: Bearer <JWT>

Request:
{
  "userId": "uuid",
  "date": "2024-01-15",  // Optional, defaults to today
  "forceRegenerate": false
}

Response:
{
  "success": true,
  "journal": {
    "id": "uuid",
    "date": "2024-01-15",
    "content": "Today was a day of mixed emotions...",
    "emotion_summary": {
      "dominant_emotion": "happy",
      "mood_score": 7.2,
      "emotion_distribution": {
        "morning": "neutral",
        "afternoon": "happy", 
        "evening": "content"
      }
    },
    "created_at": "2024-01-15T23:30:00Z"
  }
}

GET    /api/journal/get/:userId/:date    - Get specific journal entry
GET    /api/journal/list/:userId         - List all user journal entries
GET    /api/journal/recent/:userId       - Get last 7 days of journals
POST   /api/journal/manual              - Manually trigger journal generation
```

### 📊 Comprehensive Insights & Analytics  
```
GET    /api/insights/daily/:userId/:date
Authorization: Bearer <JWT>

Response:
{
  "date": "2024-01-15",
  "summary": {
    "total_messages": 12,
    "dominant_emotion": "happy",
    "mood_score": 7.8,
    "activity_periods": ["morning", "evening"],
    "emotion_distribution": {
      "happy": 0.45,
      "neutral": 0.30,
      "sad": 0.15,
      "angry": 0.10
    },
    "key_moments": [
      {
        "time": "14:30",
        "emotion": "happy",
        "confidence": 0.95,
        "content": "Got promoted at work!"
      }
    ]
  }
}

GET    /api/insights/weekly/:userId/:weekStart
Response:
{
  "week_start": "2024-01-08",
  "week_end": "2024-01-14", 
  "summary": {
    "total_messages": 84,
    "average_mood_score": 6.8,
    "emotional_trend": "improving",
    "most_active_day": "Wednesday",
    "dominant_emotions": ["happy", "neutral", "content"],
    "weekly_highlights": [
      {
        "date": "2024-01-10",
        "event": "Highest mood score of the week",
        "mood_score": 9.2
      }
    ]
  }
}

GET    /api/insights/stats/:userId
Response:
{
  "user_statistics": {
    "total_analyses": 1247,
    "days_active": 89,
    "current_streak": 7,
    "longest_streak": 23,
    "average_daily_mood": 7.1,
    "most_common_emotion": "happy",
    "improvement_trend": "positive"
  }
}

GET    /api/insights/timeline/:userId
Query: ?startDate=2024-01-01&endDate=2024-01-31&granularity=day
Response:
{
  "timeline": [
    {
      "date": "2024-01-15",
      "mood_score": 7.8,
      "dominant_emotion": "happy",
      "message_count": 12,
      "notable_events": ["work_success"]
    }
  ],
  "emotional_arc": {
    "trend": "improving",
    "variance": 1.2,
    "stability_score": 8.1
  }
}
```

### 🆘 Emergency Contact Management
```
POST   /api/emergency/save
Content-Type: application/json
Authorization: Bearer <JWT>

Request:
{
  "userId": "uuid",
  "contactName": "Jane Doe",
  "contactEmail": "jane@example.com", 
  "contactPhone": "+1-555-123-4567"
}

GET    /api/emergency/:userId        - Retrieve saved contact
POST   /api/emergency/update         - Update contact information
GET    /api/emergency/check/:userId  - Returns { hasEmergencyContact: boolean }
DELETE /api/emergency/:userId        - Remove contact and disable alerts
GET    /api/emergency/email/status   - Inspect Nodemailer configuration
```

### 🤖 Response Generation
```
POST   /api/response-generator
Content-Type: application/json

Request:
{
  "message": "I am sad",
  "emotion": "sad",
  "confidence": 0.85,
  "chatHistory": [],
  "userId": "uuid",
  "sessionId": "uuid"
}

Response:
{
  "response": "I understand you're feeling sad...",
  "model": "gemini-2.0-flash",
  "tokens": { "input": 25, "output": 50 },
  "contextUsed": true,
  "emotionalTone": "empathetic"
}
```

### 🔊 Text-to-Speech
```
POST   /api/tts/synthesize
Content-Type: application/json

Request:
{
  "text": "I am feeling happy",
  "language": "en-US",
  "voiceGender": "female",
  "speed": 1.0
}

Response:
{
  "audioUrl": "/api/tts/audio/file.wav",
  "provider": "google",
  "duration": 2.5,
  "contentType": "audio/wav"
}
```

### ⚡ Health & Monitoring
```
GET    /api/health              - System health check
GET    /api/health/detailed     - Detailed service status
GET    /api/performance/stats   - Performance metrics
GET    /api/config/models       - Available ML models status
```
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

#### `emergency_contacts`
```sql
CREATE TABLE emergency_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  notify_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id)
);
```

#### `safety_alerts`
```sql
CREATE TABLE safety_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  emergency_contact_id UUID REFERENCES emergency_contacts(id) ON DELETE SET NULL,
  detected_emotion TEXT NOT NULL,
  message_text TEXT,
  alert_sent BOOLEAN DEFAULT FALSE,
  alert_sent_at TIMESTAMP,
  alert_response TEXT,
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
# SAFETY & EMERGENCY ALERTS
# ============================================
ENABLE_EMERGENCY_ALERTS=true
HIGH_RISK_KEYWORDS=suicide,self-harm,kill myself,end my life,hurt myself
MEDIUM_RISK_KEYWORDS=worthless,burden,give up,hopeless,no point

# Nodemailer provider (choose one)
EMAIL_ENABLED=true
EMAIL_PROVIDER=gmail        # gmail|outlook|smtp|sendgrid
GMAIL_EMAIL=your.gmail@example.com
GMAIL_APP_PASSWORD=generated-app-password
# SMTP_HOST= # Required when EMAIL_PROVIDER=smtp
# SENDGRID_API_KEY= # Required when EMAIL_PROVIDER=sendgrid

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

### Enabling Emergency Alert Workflow

1. **Run Database Migration**
  ```bash
  psql $SUPABASE_DATABASE_URL -f migrations/create_emergency_contacts.sql
  ```
  This creates `emergency_contacts`, `safety_alerts`, and associated RLS policies.

2. **Configure Email Provider**
  - Set `EMAIL_ENABLED=true` and select a provider via `EMAIL_PROVIDER`
  - Supply credentials (`GMAIL_APP_PASSWORD`, SMTP secrets, or `SENDGRID_API_KEY`)
  - Verify configuration with `GET /api/emergency/email/status`

3. **Seed Emergency Contacts (Optional)**
  - Users can add contacts via `/setup/emergency-contact`
  - For testing, POST to `/api/emergency/save` with a Supabase-authenticated user ID

4. **Trigger a Safe Test**
  - Send a chat message containing a high-risk keyword (e.g., "I want to hurt myself")
  - Confirm an email is sent and an entry appears in `safety_alerts`

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

### Testing Emergency Contact APIs

```bash
# Save or update contact
curl -X POST http://localhost:8080/api/emergency/save \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "userId": "your-user-uuid",
    "contactName": "Support Friend",
    "contactEmail": "friend@example.com"
  }'

# Check if contact exists
curl -X GET http://localhost:8080/api/emergency/check/your-user-uuid \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Inspect email configuration status
curl -X GET http://localhost:8080/api/emergency/email/status
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

**5. Safety Prompts**
- Mount `EmergencyContactChecker` near the app shell so it can prompt authenticated users once
- Reuse `EmergencyContactForm` in onboarding pages and modals to keep validation consistent
- Gate alert-related UI behind Supabase-authenticated `user.id` to avoid anonymous API calls

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

#### 8. **Emergency Alerts Not Sending**
```
Warning: Failed to send emergency alert email
```
**Solution:**
- Ensure `EMAIL_ENABLED=true` and `EMAIL_PROVIDER` matches your credential set
- For Gmail, use an App Password and enable `Less secure app access` (or Workspace equivalent)
- Confirm `GET /api/emergency/email/status` reports `configured: true`
- Verify recipient email exists in `emergency_contacts` (`notify_enabled` must be true)
- Check server logs for SMTP errors and adjust firewall/port settings

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
