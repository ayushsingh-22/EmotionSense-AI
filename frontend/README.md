> Historical documentation: authentication and data-access sections below describe a retired setup. See `docs/DEPLOYMENT_ENV.md` at the repository root for the current deployment configuration.

# 🎭 EmotionSense AI - Contextual Emotion Chat Platform

A cutting-edge emotion detection and AI chat platform that analyzes emotions from text and voice, provides contextual AI responses, and maintains conversational memory across sessions.

![Next.js](https://img.shields.io/badge/Next.js-14-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.0-38bdf8)
![Supabase](https://img.shields.io/badge/Supabase-Auth-green)

## ✨ Core Features

### � **Contextual AI Chat (New)**
- **Session-based conversations** with persistent memory
- **Emotion-aware AI responses** using Gemini 2.0 Flash + LLaMA 3.3 fallback
- **ChatGPT-like interface** with sidebar navigation
- **Real-time speech-to-text** input with microphone integration
- **Text-to-speech** AI responses with audio playback
- **User-specific data isolation** with Supabase Auth + RLS
- **Session management** - create, edit titles, delete conversations

### 🔐 **Authentication & User Management**
- **Supabase Auth integration** with JWT tokens
- **Row Level Security (RLS)** for data isolation
- **User-specific chat sessions** and conversation history
- **Secure API communication** with authenticated endpoints

### 🎤 **Voice & Speech Features**
- **Real-time speech recognition** using Web Speech API
- **Live transcription** with confidence indicators
- **Voice emotion detection** from audio patterns
- **Text-to-speech synthesis** for AI responses
- **Microphone permission handling** and error management

### � **Text Analysis**
- **Dual-model emotion detection** (BiLSTM + HuggingFace)
- **Real-time confidence scoring** and emotion distribution
- **Comprehensive emotion analysis** with detailed breakdowns
- **Context-aware processing** for conversation continuity

### 🎯 **Multi-Modal Analysis**
- **Combined text and voice** emotion detection
- **Weighted emotion scoring** from multiple inputs
- **Cross-modal validation** and enhanced accuracy
- **Synchronized analysis** results

## 🚀 Getting Started

### Prerequisites
- Node.js 18.x or higher
- Backend API running on `http://localhost:8080`
- Supabase project with proper configuration

### Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   Create a `.env.local` file:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:8080
   ```

3. **Run development server:**
   ```bash
   npm run dev
   ```

4. **Open browser:**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 📁 Project Structure

```
frontend/
├── app/                           # Next.js App Router
│   ├── globals.css               # Global styles
│   ├── layout.tsx                # Root layout
│   ├── page.tsx                  # Landing page
│   ├── auth/                     # Authentication pages
│   │   ├── login/               # Login page
│   │   └── signup/              # Signup page
│   ├── chat/                     # Main chat interface (NEW)
│   │   └── page.tsx             # Contextual chat with sidebar
│   ├── text/                     # Text emotion analysis
│   ├── voice/                    # Voice emotion analysis
│   ├── multimodal/               # Multi-modal analysis
│   ├── history/                  # Chat history (UPDATED)
│   ├── profile/                  # User profile
│   └── settings/                 # User preferences
├── components/
│   ├── navbar.tsx                # Navigation bar
│   ├── sidebar.tsx               # Chat sidebar (NEW)
│   ├── chat/                     # Chat components (NEW)
│   │   ├── ChatSidebar.tsx      # Session management sidebar
│   │   └── SpeechRecognition.tsx # Speech-to-text component
│   ├── emotions/                 # Emotion visualization
│   │   ├── AIResponseBox.tsx    # AI response display
│   │   ├── DualModelCompare.tsx # Model comparison
│   │   └── EmotionBarChart.tsx  # Emotion charts
│   ├── voice/                    # Voice components
│   └── ui/                       # shadcn/ui components
├── contexts/
│   ├── AuthContext.tsx           # Authentication context (NEW)
│   └── ChatContext.tsx           # Chat state management (NEW)
├── hooks/
│   ├── use-toast.ts             # Toast notifications
│   └── useVoiceRecorder.ts      # Voice recording hook
├── lib/
│   ├── api.ts                    # API client functions (UPDATED)
│   ├── supabase.ts              # Supabase configuration (NEW)
│   └── utils.ts                 # Utility functions
├── store/
│   └── useStore.ts              # Zustand state management
├── types/
│   └── index.ts                 # TypeScript interfaces (UPDATED)
└── components.json               # shadcn/ui configuration
```

## 🎨 New Components

### ChatSidebar Component
**Location:** `components/chat/ChatSidebar.tsx`

Features:
- Session list with search functionality
- Edit session titles inline
- Delete sessions with confirmation
- Real-time session updates
- New chat session creation

```typescript
interface ChatSidebarProps {
  currentSessionId: string | null;
  onSessionSelect: (sessionId: string) => void;
  onNewChat: () => void;
}
```

### SpeechRecognition Component
**Location:** `components/chat/SpeechRecognition.tsx`

Features:
- Web Speech API integration
- Real-time transcript display
- Microphone permission handling
- Speech recognition state management
- Error handling and fallbacks

```typescript
interface SpeechRecognitionProps {
  onTranscript: (text: string) => void;
  isListening: boolean;
  onStartListening: () => void;
  onStopListening: () => void;
}
```

## 🔌 API Integration

### New Chat Endpoints

```typescript
// Create or continue chat session
POST /api/chat/message
{
  "message": "Hello, how are you?",
  "sessionId": "optional-existing-session-id",
  "memoryLength": 10
}

// Get user chat sessions
GET /api/chat/sessions

// Get session messages
GET /api/chat/sessions/:sessionId/messages

// Update session title
PATCH /api/chat/sessions/:sessionId
{
  "title": "New session title"
}

// Delete chat session
DELETE /api/chat/sessions/:sessionId
```

### Updated Types

```typescript
interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  user_id: string;
}

interface ChatMessage {
  id: string;
  session_id: string;
  content: string;
  role: 'user' | 'assistant';
  emotion?: string;
  created_at: string;
}

interface ChatMessageResult {
  response: string;
  emotion: string;
  sessionId: string;
  audioUrl?: string;
  messageId: string;
}
```

## 🛠️ Tech Stack

### Core Technologies
- **Next.js 14** - React framework with App Router
- **TypeScript** - Type safety and developer experience
- **Tailwind CSS** - Utility-first styling
- **shadcn/ui** - Beautiful UI components

### Authentication & Database
- **Supabase Auth** - JWT-based authentication
- **Supabase Database** - PostgreSQL with RLS
- **Row Level Security** - User data isolation

### Chat & AI Features
- **Web Speech API** - Browser speech recognition
- **Gemini 2.0 Flash** - Primary AI model integration
- **LLaMA 3.3** - Fallback AI model via Groq
- **Context Memory** - Conversation history management

### UI & Visualization
- **Framer Motion** - Smooth animations
- **Recharts** - Emotion visualization charts
- **Lucide React** - Beautiful icons
- **React Hot Toast** - Notifications

### State Management
- **Zustand** - Lightweight state management
- **React Context** - Authentication state
- **SWR/React Query** - Server state caching

## 📱 Pages Overview

### Authentication Pages
- **`/auth/login`** - User login with Supabase Auth
- **`/auth/signup`** - User registration and email verification

### Main Chat Interface
- **`/chat`** - **NEW** Contextual chat with AI memory and sidebar
  - Session-based conversations
  - Real-time speech-to-text input
  - Emotion-aware AI responses
  - Audio playback for AI responses
  - ChatGPT-like interface design

### Analysis Pages
- **`/text`** - Text emotion analysis with dual models
- **`/voice`** - Voice recording and emotion detection
- **`/multimodal`** - Combined text + voice analysis

### User Management
- **`/history`** - **UPDATED** Chat history with session filtering
- **`/profile`** - User profile and account settings
- **`/settings`** - Application preferences and configuration

## 🎯 Key Features Implementation

### 1. User-Specific Data Isolation
- Supabase RLS policies ensure users only see their own data
- JWT tokens automatically filter API requests
- Secure session management with proper authentication

### 2. Contextual AI Memory
- Conversation history maintained across sessions
- Configurable memory length (default: 10 messages)
- Emotion context influences AI response generation

### 3. Real-time Speech Input
- Web Speech API for live transcription
- Microphone permission handling
- Error recovery and browser compatibility checks

### 4. Session Management
- Create, edit, and delete chat sessions
- Persistent conversation history
- Search and organize conversations

## 📜 Available Scripts

```bash
npm run dev      # Development server with hot reload
npm run build    # Production build optimization
npm start        # Start production server
npm run lint     # ESLint code analysis
npm run type-check # TypeScript compilation check
```

## � Environment Configuration

### Required Environment Variables

```env
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:8080

# Supabase Configuration

# Optional: Development Settings
NODE_ENV=development
```

## 🚀 Recent Updates

### v2.0 - Contextual Chat System
- ✅ **ChatGPT-like Interface**: Complete redesign with sidebar navigation
- ✅ **Real-time Speech Input**: Web Speech API integration
- ✅ **Session Management**: Create, edit, delete conversations
- ✅ **User Authentication**: Supabase Auth with secure data isolation
- ✅ **AI Memory System**: Contextual responses with conversation history
- ✅ **Audio Integration**: Text-to-speech for AI responses
- ✅ **Responsive Design**: Mobile-friendly chat interface

## 🔄 Migration from v1.x

If upgrading from the previous version:

1. **Update Dependencies**: Run `npm install` for latest packages
2. **Environment Variables**: Add Supabase configuration to `.env.local`
3. **Authentication**: Implement user registration/login flow
4. **Database Migration**: Ensure backend database schema is updated
5. **Component Updates**: Chat page completely rewritten with new features

## 🐛 Troubleshooting

### Common Issues

1. **Speech Recognition Not Working**
   - Check browser compatibility (Chrome/Edge recommended)
   - Verify microphone permissions
   - Ensure HTTPS in production

2. **Authentication Errors**
   - Verify Supabase configuration
   - Check JWT token expiration
   - Confirm RLS policies are properly set

3. **API Connection Issues**
   - Verify backend server is running on correct port
   - Check CORS configuration
   - Confirm environment variables are set

### Browser Compatibility

- **Speech Recognition**: Chrome, Edge, Safari (iOS 14+)
- **Audio Playback**: All modern browsers
- **Authentication**: All modern browsers with JavaScript enabled

## 📚 Additional Documentation

- **Backend API**: See `../backend/README.md` for server documentation
- **Database Schema**: Check `supabase_schema_migration.sql` for table structure
- **Component Library**: shadcn/ui documentation at [ui.shadcn.com](https://ui.shadcn.com)
- **Supabase Docs**: [supabase.com/docs](https://supabase.com/docs)

---

**Built with ❤️ for the future of emotion-aware AI communication**
