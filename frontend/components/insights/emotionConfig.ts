/**
 * Shared emotion configuration for insights
 * Premium color system with glassmorphism support
 */

export const emotionColors = {
  joy: {
    primary: '#F59E0B',
    gradient: 'from-yellow-400 via-amber-500 to-orange-500',
    bg: 'bg-gradient-to-br from-yellow-400/10 via-amber-500/10 to-orange-500/10',
    border: 'border-yellow-500/30',
    glow: 'shadow-yellow-500/20',
    text: 'text-yellow-600',
  },
  sadness: {
    primary: '#3B82F6',
    gradient: 'from-blue-400 via-blue-500 to-cyan-600',
    bg: 'bg-gradient-to-br from-blue-400/10 via-blue-500/10 to-cyan-600/10',
    border: 'border-blue-500/30',
    glow: 'shadow-blue-500/20',
    text: 'text-blue-600',
  },
  anger: {
    primary: '#EF4444',
    gradient: 'from-red-400 via-red-500 to-rose-600',
    bg: 'bg-gradient-to-br from-red-400/10 via-red-500/10 to-rose-600/10',
    border: 'border-red-500/30',
    glow: 'shadow-red-500/20',
    text: 'text-red-600',
  },
  fear: {
    primary: '#8B5CF6',
    gradient: 'from-purple-400 via-violet-500 to-indigo-600',
    bg: 'bg-gradient-to-br from-purple-400/10 via-violet-500/10 to-indigo-600/10',
    border: 'border-purple-500/30',
    glow: 'shadow-purple-500/20',
    text: 'text-purple-600',
  },
  surprise: {
    primary: '#EC4899',
    gradient: 'from-pink-400 via-pink-500 to-fuchsia-600',
    bg: 'bg-gradient-to-br from-pink-400/10 via-pink-500/10 to-fuchsia-600/10',
    border: 'border-pink-500/30',
    glow: 'shadow-pink-500/20',
    text: 'text-pink-600',
  },
  neutral: {
    primary: '#6B7280',
    gradient: 'from-slate-400 via-gray-500 to-zinc-600',
    bg: 'bg-gradient-to-br from-slate-400/10 via-gray-500/10 to-zinc-600/10',
    border: 'border-gray-500/30',
    glow: 'shadow-gray-500/20',
    text: 'text-gray-600',
  },
  disgust: {
    primary: '#10B981',
    gradient: 'from-green-400 via-emerald-500 to-teal-600',
    bg: 'bg-gradient-to-br from-green-400/10 via-emerald-500/10 to-teal-600/10',
    border: 'border-green-500/30',
    glow: 'shadow-green-500/20',
    text: 'text-green-600',
  },
};

export const emotionEmojis: Record<string, string> = {
  anger: '🤬',
  disgust: '🤢', 
  fear: '😨',
  joy: '😀',
  neutral: '😐',
  sadness: '😭',
  surprise: '😲',
};

export const getEmotionConfig = (emotion: string | null | undefined) => {
  if (!emotion) {
    return emotionColors.neutral;
  }
  const lowerEmotion = emotion.toLowerCase();
  return emotionColors[lowerEmotion as keyof typeof emotionColors] || emotionColors.neutral;
};

export const getEmotionEmoji = (emotion: string | null | undefined) => {
  if (!emotion) {
    return '😐';
  }
  const lowerEmotion = emotion.toLowerCase();
  return emotionEmojis[lowerEmotion] || '😐';
};
