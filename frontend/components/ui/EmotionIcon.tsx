'use client';

import { motion } from 'framer-motion';
import { Smile, Frown, Meh, Heart, Zap, Cloud, LucideIcon } from 'lucide-react';

interface EmotionIconProps {
  emotion: string;
  size?: number;
  animated?: boolean;
  className?: string;
}

const emotionConfig: Record<string, { icon: LucideIcon; gradient: string; glow: string }> = {
  joy: { 
    icon: Smile, 
    gradient: 'from-yellow-400 to-orange-500',
    glow: 'rgba(251, 191, 36, 0.4)'
  },
  happiness: { 
    icon: Smile, 
    gradient: 'from-yellow-400 to-orange-500',
    glow: 'rgba(251, 191, 36, 0.4)'
  },
  sadness: { 
    icon: Frown, 
    gradient: 'from-blue-400 to-cyan-500',
    glow: 'rgba(59, 130, 246, 0.4)'
  },
  neutral: { 
    icon: Meh, 
    gradient: 'from-gray-400 to-slate-500',
    glow: 'rgba(156, 163, 175, 0.4)'
  },
  love: { 
    icon: Heart, 
    gradient: 'from-pink-400 to-rose-500',
    glow: 'rgba(236, 72, 153, 0.4)'
  },
  anger: { 
    icon: Zap, 
    gradient: 'from-red-400 to-orange-600',
    glow: 'rgba(239, 68, 68, 0.4)'
  },
  fear: { 
    icon: Cloud, 
    gradient: 'from-purple-400 to-indigo-500',
    glow: 'rgba(168, 85, 247, 0.4)'
  },
  surprise: { 
    icon: Zap, 
    gradient: 'from-green-400 to-emerald-500',
    glow: 'rgba(34, 197, 94, 0.4)'
  },
};

export function EmotionIcon({ 
  emotion, 
  size = 24,
  animated = true,
  className = ''
}: EmotionIconProps) {
  const emotionKey = emotion.toLowerCase();
  const config = emotionConfig[emotionKey] || emotionConfig.neutral;
  const Icon = config.icon;

  if (!animated) {
    return (
      <div className={`p-2 rounded-lg bg-gradient-to-br ${config.gradient} ${className}`}>
        <Icon size={size} className="text-white" />
      </div>
    );
  }

  return (
    <motion.div
      className={`p-2 rounded-lg bg-gradient-to-br ${config.gradient} ${className}`}
      animate={{
        boxShadow: [
          `0 0 15px ${config.glow}`,
          `0 0 25px ${config.glow.replace('0.4', '0.6')}`,
          `0 0 15px ${config.glow}`,
        ],
      }}
      transition={{ duration: 2, repeat: Infinity }}
      whileHover={{ scale: 1.1, rotate: 5 }}
    >
      <Icon size={size} className="text-white" />
    </motion.div>
  );
}
