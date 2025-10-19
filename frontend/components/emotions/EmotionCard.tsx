'use client';

import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { EMOTION_CONFIG, type EmotionType } from '@/types';

interface EmotionCardProps {
  emotion: string;
  confidence: number;
  showProgress?: boolean;
  animated?: boolean;
}

export function EmotionCard({
  emotion,
  confidence,
  showProgress = true,
  animated = true,
}: EmotionCardProps) {
  // Get config for the emotion, with fallback for unknown emotions
  const config = EMOTION_CONFIG[emotion as EmotionType] || { 
    color: '#6B7280', 
    emoji: '❓', 
    bgColor: 'bg-gray-400' 
  };
  const confidencePercent = Math.round(confidence * 100);

  const cardContent = (
    <Card className="p-6 hover:shadow-lg transition-shadow">
      <div className="flex flex-col items-center space-y-4">
        {/* Emotion Emoji */}
        <div className="relative">
          <div
            className="w-24 h-24 rounded-full flex items-center justify-center text-5xl"
            style={{ backgroundColor: `${config.color}20` }}
          >
            {config.emoji}
          </div>
          {/* Circular Progress Ring */}
          <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="46"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-gray-200 dark:text-gray-700"
            />
            <circle
              cx="50"
              cy="50"
              r="46"
              fill="none"
              stroke={config.color}
              strokeWidth="2"
              strokeDasharray={`${confidencePercent * 2.89} 289`}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-out"
            />
          </svg>
        </div>

        {/* Emotion Label */}
        <div className="text-center">
          <h3 className="text-2xl font-bold capitalize" style={{ color: config.color }}>
            {emotion}
          </h3>
          <p className="text-3xl font-bold mt-2">{confidencePercent}%</p>
          <p className="text-sm text-muted-foreground">Confidence</p>
        </div>

        {/* Progress Bar */}
        {showProgress && (
          <div className="w-full">
            <Progress value={confidencePercent} className="h-2" />
          </div>
        )}
      </div>
    </Card>
  );

  if (!animated) return cardContent;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {cardContent}
    </motion.div>
  );
}
