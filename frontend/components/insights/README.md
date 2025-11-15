# Emotion Insights Components - Documentation

## Overview

This directory contains the redesigned Emotion Insights UI components for EmotionSense AI. The components provide a premium, interactive, and emotionally engaging experience for viewing emotional data.

## Design Philosophy

### Visual Style
- **Glassmorphism**: Soft gradient backgrounds with backdrop blur
- **Premium Color System**: Emotion-specific gradients with glow effects
- **Micro-Animations**: Framer Motion animations for all interactions
- **Modern UI**: Inspired by Apple Health, Notion, Replika, and Calm app

### Emotion Color Mapping
```typescript
fear → purple/indigo gradient
sadness → blue/cyan gradient
anger → red/rose gradient
happy/joy → yellow/amber/orange gradient
neutral → gray/slate gradient
```

## Components

### 1. DailyView.tsx
**Premium Daily Emotion Capsule**

Features:
- Gradient header with animated background patterns
- Emotion icon badge with pulse animation
- Mood wave sparkline visualization
- Journal entry with typewriter animation and quote icon
- Animated emotion flow bars (time segments)
- Bubble-based emotion distribution with glow effects
- Glassmorphism cards with hover effects

Props:
```typescript
interface DailyViewProps {
  insights: DailyInsight[];
  isLoading: boolean;
}
```

### 2. WeeklyView.tsx
**Interactive Collapsible Weekly Panels**

Features:
- Collapsible cards with animated open/close
- Gradient week header with emoji badge
- Animated grid background pattern
- Line + bar charts for weekly emotional arc
- Color-coded highlight chips with icons
- Smooth expand/collapse transitions

Props:
```typescript
interface WeeklyViewProps {
  insights: WeeklyInsight[];
  isLoading: boolean;
}
```

### 3. TimelineView.tsx
**Interactive Infinite-Scroll Timeline**

Features:
- Timeline cards with emotion avatar and glow
- Vertical timeline line (desktop)
- Emotion intensity bars
- Detail panel that slides in from right
- Mini sparkline for confidence visualization
- Backdrop blur overlay
- Smooth animations for all items

Props:
```typescript
interface TimelineViewProps {
  moments: KeyMoment[];
  isLoading: boolean;
}
```

### 4. EmotionFlow.tsx
**Animated Emotion Flow Component**

Features:
- Time segment cards (morning/afternoon/evening)
- Gradient backgrounds per emotion
- Animated glow overlay
- Pulsing emoji animations
- Hover scale effect
- Count badges

Props:
```typescript
interface EmotionFlowProps {
  timeSegments: TimeSegment[];
}
```

### 5. EmotionDistribution.tsx
**Bubble Chart for Emotion Percentages**

Features:
- Circular bubbles sized by percentage
- Gradient fills with rotating overlay
- Pulsing glow animations
- Hoverable with scale effect
- Detailed breakdown chips below
- Responsive sizing (60-120px)

Props:
```typescript
interface EmotionDistributionProps {
  emotionCounts: Record<string, number>;
}
```

### 6. WeeklyArcChart.tsx
**Interactive Chart for Weekly Journey**

Features:
- Line chart for mood score trend
- Bar chart for daily emotions
- Color-coded cells per emotion
- Custom tooltip with gradient styling
- Recharts integration
- Daily emotion cards grid

Props:
```typescript
interface WeeklyArcChartProps {
  dailyArc: DayPoint[];
}
```

### 7. emotionConfig.ts
**Shared Emotion Configuration**

Provides centralized emotion styling:
```typescript
export const emotionColors = {
  [emotion]: {
    primary: '#HEX',
    gradient: 'from-color via-color to-color',
    bg: 'bg-gradient-to-br ...',
    border: 'border-color/30',
    glow: 'shadow-color/20',
    text: 'text-color',
  }
}

export const emotionEmojis = { ... }
export const getEmotionConfig = (emotion: string) => { ... }
export const getEmotionEmoji = (emotion: string) => { ... }
```

### 8. InsightsLoading.tsx
**Premium Loading Skeletons**

Exports:
- `DailyViewSkeleton`
- `WeeklyViewSkeleton`
- `TimelineViewSkeleton`
- `StatsCardSkeleton`

All with staggered fade-in animations.

## Performance Optimizations

### React.memo
All components are wrapped with `React.memo` to prevent unnecessary re-renders:
```typescript
export const DailyView = React.memo(({ insights, isLoading }: DailyViewProps) => {
  // ...
});
```

### Memoized Calculations
Heavy calculations use `React.useMemo`:
```typescript
const points = React.useMemo(() => {
  // expensive calculation
}, [dependency]);
```

### Lazy Loading
Components can be dynamically imported:
```typescript
const DailyView = dynamic(() => import('@/components/insights/DailyView'), {
  loading: () => <DailyViewSkeleton />
});
```

### Animation Performance
- CSS transforms (not layout properties)
- `will-change` hints for animations
- Debounced hover effects
- GPU-accelerated animations

## Usage Example

```tsx
import { DailyView, WeeklyView, TimelineView } from '@/components/insights';

export default function InsightsPage() {
  const [dailyInsights, setDailyInsights] = useState<DailyInsight[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  return (
    <Tabs>
      <TabsContent value="daily">
        <DailyView insights={dailyInsights} isLoading={isLoading} />
      </TabsContent>
      <TabsContent value="weekly">
        <WeeklyView insights={weeklyInsights} isLoading={isLoading} />
      </TabsContent>
      <TabsContent value="timeline">
        <TimelineView moments={moments} isLoading={isLoading} />
      </TabsContent>
    </Tabs>
  );
}
```

## Animation Guidelines

### Framer Motion Patterns

**Fade In on Mount**:
```tsx
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.5 }}
>
```

**Staggered Children**:
```tsx
{items.map((item, idx) => (
  <motion.div
    key={item.id}
    initial={{ opacity: 0, y: 30 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: idx * 0.1 }}
  >
))}
```

**Hover Scale**:
```tsx
<motion.div
  whileHover={{ scale: 1.05, y: -4 }}
  transition={{ type: "spring", stiffness: 300 }}
>
```

**Infinite Pulse**:
```tsx
<motion.div
  animate={{
    boxShadow: [
      '0 0 20px rgba(color, 0.3)',
      '0 0 30px rgba(color, 0.5)',
      '0 0 20px rgba(color, 0.3)',
    ],
  }}
  transition={{ duration: 2, repeat: Infinity }}
>
```

## Styling Conventions

### Glassmorphism Card
```tsx
<Card className="
  overflow-hidden 
  border-2 border-border/50 
  shadow-xl hover:shadow-2xl 
  transition-all duration-300 
  bg-gradient-to-br from-background via-background to-background/50 
  backdrop-blur-sm
">
```

### Gradient Headers
```tsx
<div className={`
  relative 
  bg-gradient-to-r ${config.gradient} 
  p-6 
  overflow-hidden
`}>
```

### Emotion Badges
```tsx
<Badge className={`
  px-3 py-1.5 
  rounded-full 
  ${config.bg} 
  border ${config.border} 
  backdrop-blur-sm
`}>
```

## Data Flow

```
page.tsx (main insights page)
  ↓
  Fetches data from API (getDailyInsights, getWeeklyInsights, getKeyMoments)
  ↓
  Passes to view components as props
  ↓
  View components render sub-components (EmotionFlow, EmotionDistribution, WeeklyArcChart)
  ↓
  Sub-components use emotionConfig for styling
```

## Accessibility

- Semantic HTML elements
- ARIA labels for interactive elements
- Keyboard navigation support (Tab, Enter, Escape)
- Focus indicators on interactive elements
- Color-blind friendly emotion gradients
- Screen reader friendly content

## Browser Compatibility

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

Requires:
- CSS Grid
- CSS Backdrop Filter
- Framer Motion (React)
- Recharts

## File Structure

```
components/insights/
├── index.ts                    # Central exports
├── emotionConfig.ts            # Shared styling config
├── DailyView.tsx              # Daily emotion capsule
├── WeeklyView.tsx             # Weekly panels
├── TimelineView.tsx           # Timeline with detail panel
├── EmotionFlow.tsx            # Time segment bars
├── EmotionDistribution.tsx    # Bubble chart
├── WeeklyArcChart.tsx         # Line + bar charts
└── InsightsLoading.tsx        # Loading skeletons
```

## Backend Integration

No backend changes required. Components consume existing API:
- `/api/insights/daily` → DailyInsight[]
- `/api/insights/weekly` → WeeklyInsight[]
- `/api/insights/moments` → KeyMoment[]
- `/api/insights/stats` → UserStats

All data structures remain unchanged.

## Future Enhancements

Potential additions (not implemented):
- Export insights as PDF
- Share insights on social media
- Custom date range filters
- Emotion pattern predictions
- Voice narration of insights
- Haptic feedback on mobile

---

**Last Updated**: November 15, 2025
**Version**: 2.0.0
**Maintainer**: EmotionSense AI Team
