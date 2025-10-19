# 🎭 Emotion AI - Multi-Modal Emotion Detection PlatformThis is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).



A cutting-edge emotion detection platform powered by AI that analyzes emotions from text, voice, and combined multi-modal inputs.## Getting Started



![Next.js](https://img.shields.io/badge/Next.js-14-black)First, run the development server:

![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)

![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.0-38bdf8)```bash

npm run dev

## ✨ Features# or

yarn dev

### 🔤 **Text Analysis**# or

- Dual-model emotion detection (BiLSTM + HuggingFace)pnpm dev

- Real-time confidence scoring# or

- Comprehensive emotion distribution chartsbun dev

- AI-generated empathetic responses```



### 🎤 **Voice Analysis**Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

- Live audio recording with waveform visualization

- Speech-to-text transcriptionYou can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

- Voice emotion detection from audio patterns

- Combined text + voice emotion analysisThis project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.



### 🔗 **Multi-Modal Analysis**## Learn More

- Synchronized text and voice input

- Weighted emotion scoringTo learn more about Next.js, take a look at the following resources:

- Cross-modal validation

- Enhanced accuracy through data fusion- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.

- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

### 📊 **Analytics & History**

- Complete analysis history trackingYou can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

- Model agreement statistics

- Emotion trends visualization## Deploy on Vercel

- Session summaries

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

## 🚀 Getting Started

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

### Prerequisites
- Node.js 18.x or higher
- Backend API running on `http://localhost:8080`

### Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   The `.env.local` file is already configured with:
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
├── app/                    # Next.js App Router pages
├── components/             # React components
│   ├── emotions/          # Emotion visualization
│   ├── voice/             # Voice recording
│   └── ui/                # shadcn/ui components
├── hooks/                  # Custom hooks
├── lib/                    # Utilities & API
├── store/                  # Zustand state
└── types/                  # TypeScript types
```

## 🎨 Emotion Colors

| Emotion  | Color   | Emoji |
|----------|---------|-------|
| Angry    | #E74C3C | 😠    |
| Disgust  | #16A085 | 🤢    |
| Fear     | #9B59B6 | 😨    |
| Happy    | #F39C12 | 😊    |
| Neutral  | #95A5A6 | 😐    |
| Sad      | #3498DB | 😢    |
| Surprise | #E67E22 | 😲    |

## 🔌 API Endpoints

```typescript
POST /api/analyze/text        # Analyze text
POST /api/analyze/voice       # Analyze audio
POST /api/analyze/multimodal  # Combined analysis
POST /api/response/regenerate # Regenerate AI response
POST /api/tts                 # Text-to-speech
```

## 🛠️ Tech Stack

- **Next.js 14** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **shadcn/ui** - UI components
- **Framer Motion** - Animations
- **Recharts** - Charts
- **WaveSurfer.js** - Audio visualization
- **Zustand** - State management
- **Axios** - API client

## 📜 Available Scripts

```bash
npm run dev      # Development server
npm run build    # Production build
npm start        # Start production
npm run lint     # Lint code
```

## 📱 Features by Page

### Dashboard (`/`)
- Quick access cards to all analysis modes
- Session statistics
- Recent activity timeline
- Model performance metrics

### Text Analysis (`/text`)
- Text input area with character count
- Emotion detection with dual models
- Confidence scores and distribution
- AI empathetic response

### Voice Analysis (`/voice`)
- Voice recorder with controls
- Waveform visualization
- Transcript display
- Combined emotion analysis

### Multi-Modal (`/multimodal`)
- Text + voice input
- Synchronized analysis
- Weighted emotion results

### History (`/history`)
- Complete analysis log
- Filterable by type
- Detailed emotion breakdown

### Settings (`/settings`)
- Theme toggle (Light/Dark)
- Default mode selection
- Voice/TTS preferences

---

**Built with ❤️ by Ayush Singh**
