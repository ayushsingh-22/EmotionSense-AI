/**
 * EmotionDistribution - Animated bubble chart for emotion percentages
 */

'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { getEmotionConfig, getEmotionEmoji } from './emotionConfig';

interface EmotionDistributionProps {
  emotionCounts: Record<string, number>;
}

export const EmotionDistribution = React.memo(({ emotionCounts }: EmotionDistributionProps) => {
  if (!emotionCounts || Object.keys(emotionCounts).length === 0) {
    return null;
  }

  const total = Object.values(emotionCounts).reduce((sum, count) => sum + count, 0);
  const emotions = Object.entries(emotionCounts).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
        Emotion Distribution
      </h4>
      
      <div className="flex flex-wrap gap-3">
        {emotions.map(([emotion, count], idx) => {
          const config = getEmotionConfig(emotion);
          const emoji = getEmotionEmoji(emotion);
          const percentage = Math.round((count / total) * 100);
          
          // Calculate size based on percentage (min 60px, max 120px)
          const size = Math.max(60, Math.min(120, 60 + (percentage * 0.6)));
          
          return (
            <motion.div
              key={emotion}
              className="relative group"
              initial={{ opacity: 0, scale: 0.3 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ 
                delay: idx * 0.1,
                type: "spring",
                stiffness: 200,
                damping: 15
              }}
              whileHover={{ scale: 1.1, zIndex: 10 }}
            >
              <motion.div
                className={`rounded-full bg-gradient-to-br ${config.gradient} backdrop-blur-sm border-2 ${config.border} shadow-xl ${config.glow} flex flex-col items-center justify-center cursor-pointer overflow-hidden`}
                style={{ 
                  width: `${size}px`, 
                  height: `${size}px` 
                }}
                animate={{
                  boxShadow: [
                    `0 0 20px ${config.primary}40`,
                    `0 0 30px ${config.primary}60`,
                    `0 0 20px ${config.primary}40`,
                  ],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  repeatDelay: 1,
                }}
              >
                {/* Animated gradient overlay */}
                <motion.div
                  className="absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-transparent"
                  animate={{
                    rotate: [0, 360],
                  }}
                  transition={{
                    duration: 8,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                />
                
                {/* Content */}
                <div className="relative z-10 text-center text-white">
                  <motion.div 
                    className="text-2xl mb-1"
                    animate={{
                      rotate: 10,
                    }}
                    transition={{
                      duration: 3,
                      repeat: Infinity,
                      repeatDelay: 2,
                    }}
                  >
                    {emoji}
                  </motion.div>
                  <div className="text-lg font-bold drop-shadow-lg">
                    {percentage}%
                  </div>
                </div>

                {/* Hover pulse */}
                <motion.div
                  className="absolute inset-0 bg-white/0 group-hover:bg-white/20 transition-all duration-300 rounded-full"
                />
              </motion.div>
              
              {/* Label */}
              <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
                <div className="text-xs font-medium capitalize text-center">
                  {emotion}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
      
      {/* Detailed breakdown */}
      <div className="flex flex-wrap gap-2 pt-4 mt-4 border-t border-border/50">
        {emotions.map(([emotion, count]) => {
          const config = getEmotionConfig(emotion);
          const emoji = getEmotionEmoji(emotion);
          const percentage = Math.round((count / total) * 100);
          
          return (
            <motion.div
              key={emotion}
              className={`px-3 py-1.5 rounded-full ${config.bg} border ${config.border} backdrop-blur-sm`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              whileHover={{ scale: 1.05 }}
            >
              <span className="text-sm">
                {emoji} <span className="capitalize font-medium">{emotion}</span>
                <span className="text-muted-foreground ml-1">× {count}</span>
                <span className={`ml-1 text-xs ${config.text} font-semibold`}>({percentage}%)</span>
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
});

EmotionDistribution.displayName = 'EmotionDistribution';
