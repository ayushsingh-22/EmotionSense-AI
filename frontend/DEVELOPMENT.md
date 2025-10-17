# 🎯 Frontend Development Guide

## Project Overview
This is a **Next.js 14** application built with **TypeScript**, **Tailwind CSS**, and **shadcn/ui** for the Emotion AI platform.

## 🏗️ Architecture

### Component Organization

#### **Presentation Components** (`components/`)
- Pure, reusable UI components
- No direct API calls
- Receive data via props
- Focus on visual presentation

#### **Page Components** (`app/`)
- Route-level components
- Handle data fetching
- Manage local state
- Orchestrate child components

#### **Hooks** (`hooks/`)
- Custom React hooks for reusable logic
- `useVoiceRecorder` - Voice recording functionality
- `use-toast` - Toast notifications (from shadcn/ui)

### State Management

**Zustand Store** (`store/useStore.ts`)
- Global application state
- Analysis history storage
- User preferences
- Persisted to localStorage

```typescript
const { history, addToHistory } = useStore();
```

### API Layer

**Centralized API Client** (`lib/api.ts`)
- Axios-based HTTP client
- Request/response interceptors
- Type-safe endpoints
- Error handling

```typescript
import { analyzeText } from '@/lib/api';
const result = await analyzeText(text);
```

## 🎨 Styling Guide

### Tailwind CSS Usage
- Use utility classes for styling
- Avoid inline styles
- Use `cn()` helper for conditional classes

```typescript
import { cn } from '@/lib/utils';

<div className={cn(
  "base-class",
  isActive && "active-class"
)} />
```

### Theme System
- Uses `next-themes` for theme management
- Supports light/dark/system modes
- CSS variables for colors in `globals.css`

### Component Styling Patterns

```typescript
// Emotion colors from config
style={{ backgroundColor: config.color }}

// Conditional classes
className={cn(
  "transition-all",
  isActive && "shadow-lg"
)}
```

## 🔧 Key Components Reference

### EmotionCard
```typescript
<EmotionCard 
  emotion="happy" 
  confidence={0.95}
  showProgress={true}
  animated={true}
/>
```

### DualModelCompare
```typescript
<DualModelCompare
  bilstmResult={result.bilstm_result}
  huggingfaceResult={result.huggingface_result}
/>
```

### VoiceRecorder
```typescript
<VoiceRecorder 
  onRecordingComplete={(blob) => handleAudio(blob)}
/>
```

### AIResponseBox
```typescript
<AIResponseBox
  response={result.ai_response}
  emotion={result.main_emotion.emotion}
  context={originalText}
/>
```

## 📡 API Integration Pattern

### Standard Flow

1. **Import API function**
   ```typescript
   import { analyzeText } from '@/lib/api';
   ```

2. **Setup state**
   ```typescript
   const [result, setResult] = useState<TextAnalysisResult | null>(null);
   const [isLoading, setIsLoading] = useState(false);
   ```

3. **Make API call**
   ```typescript
   try {
     setIsLoading(true);
     const data = await analyzeText(text);
     setResult(data);
   } catch (error) {
     // Handle error
   } finally {
     setIsLoading(false);
   }
   ```

4. **Update store**
   ```typescript
   addToHistory('text', data);
   ```

## 🎭 Emotion System

### Emotion Types
```typescript
type EmotionType = 'angry' | 'disgust' | 'fear' | 'happy' | 'neutral' | 'sad' | 'surprise';
```

### Emotion Configuration
```typescript
EMOTION_CONFIG[emotion] = {
  color: '#HEX',     // Display color
  emoji: '😊',        // Visual emoji
  bgColor: 'bg-*'    // Tailwind background
}
```

## 🔐 Type Safety

### Import Types
```typescript
import type {
  EmotionType,
  TextAnalysisResult,
  VoiceAnalysisResult,
  MultiModalResult
} from '@/types';
```

### API Response Types
All API responses are fully typed in `types/index.ts`

## 🚀 Performance Best Practices

### 1. Code Splitting
- Automatic with App Router
- Use dynamic imports for heavy components

### 2. Memoization
```typescript
import { useMemo } from 'react';

const processedData = useMemo(
  () => heavyCalculation(data),
  [data]
);
```

### 3. Lazy Loading
```typescript
import dynamic from 'next/dynamic';

const HeavyComponent = dynamic(() => import('./HeavyComponent'));
```

### 4. Image Optimization
```typescript
import Image from 'next/image';

<Image src="/icon.png" width={100} height={100} alt="Icon" />
```

## 🧪 Development Workflow

### 1. Create New Component
```typescript
// components/myComponent.tsx
'use client';

export function MyComponent({ prop }: Props) {
  return <div>...</div>;
}
```

### 2. Add to Page
```typescript
import { MyComponent } from '@/components/myComponent';
```

### 3. Style with Tailwind
```typescript
<div className="flex items-center gap-4 p-6 rounded-lg">
```

### 4. Connect to Store
```typescript
const data = useStore((state) => state.data);
```

## 📝 Common Patterns

### Loading States
```typescript
{isLoading ? (
  <Skeleton className="h-48 w-full" />
) : (
  <ActualComponent data={data} />
)}
```

### Empty States
```typescript
{data.length === 0 ? (
  <Card className="p-12 text-center">
    <p>No data available</p>
  </Card>
) : (
  <DataList items={data} />
)}
```

### Error Handling
```typescript
const { toast } = useToast();

toast({
  title: 'Error',
  description: 'Something went wrong',
  variant: 'destructive',
});
```

## 🔄 Animation Patterns

### Framer Motion Entry
```typescript
import { motion } from 'framer-motion';

<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.5 }}
>
  {children}
</motion.div>
```

### Staggered Lists
```typescript
{items.map((item, index) => (
  <motion.div
    key={item.id}
    initial={{ opacity: 0, x: -20 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay: index * 0.05 }}
  >
    {item.content}
  </motion.div>
))}
```

## 📦 Adding New Features

### 1. Define Types
Add to `types/index.ts`

### 2. Create API Function
Add to `lib/api.ts`

### 3. Build Component
Create in appropriate `components/` subfolder

### 4. Create Page (if needed)
Add to `app/` directory

### 5. Update Navigation
Add to `navbar.tsx` and `sidebar.tsx`

## 🐛 Debugging Tips

### 1. Check Console
Browser DevTools → Console for errors

### 2. React DevTools
Install React DevTools extension

### 3. Network Tab
Monitor API requests/responses

### 4. Zustand DevTools
```typescript
import { devtools } from 'zustand/middleware';
```

## 🔒 Environment Variables

Create `.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:8080
```

Access in code:
```typescript
process.env.NEXT_PUBLIC_API_URL
```

## 🎓 Learning Resources

- [Next.js Docs](https://nextjs.org/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [shadcn/ui](https://ui.shadcn.com/)
- [Framer Motion](https://www.framer.com/motion/)
- [Zustand](https://zustand-demo.pmnd.rs/)

## 🤝 Code Conventions

- Use TypeScript strict mode
- Follow ESLint rules
- Use `'use client'` directive for client components
- Keep components small and focused
- Write descriptive prop types
- Use meaningful variable names
- Add comments for complex logic

---

**Happy Coding! 🚀**
