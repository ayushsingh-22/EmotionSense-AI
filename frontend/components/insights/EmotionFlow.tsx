/**
 * EmotionFlow - Animated emotion flow bar with smooth transitions
 */

'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { getEmotionConfig, getEmotionEmoji } from './emotionConfig';
import type { TimeSegment } from '@/lib/insightsApi';

interface EmotionFlowProps {
  timeSegments: TimeSegment[];
}

export const EmotionFlow = React.memo(({ timeSegments }: EmotionFlowProps) => {
  if (!timeSegments || timeSegments.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
        Emotion Flow
      </h4>
      <div className="flex gap-2">
        {timeSegments.map((segment, idx) => {
          const config = getEmotionConfig(segment.emotion);
          const emoji = getEmotionEmoji(segment.emotion);
          
          return (
            <motion.div
              key={idx}
              className="flex-1"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1, duration: 0.5 }}
            >
              <div className="text-center mb-2">
                <div className="text-xs font-medium text-muted-foreground capitalize mb-1">
                  {segment.period}
                </div>
              </div>
              
              <motion.div
                className={`relative p-4 rounded-2xl bg-gradient-to-br ${config.gradient} backdrop-blur-sm border ${config.border} shadow-lg ${config.glow} overflow-hidden group cursor-pointer`}
                whileHover={{ scale: 1.05, y: -4 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
                {/* Animated glow background */}
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                  animate={{
                    x: ['-100%', '200%'],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    repeatDelay: 2,
                  }}
                />
                
                {/* Content */}
                <div className="relative z-10 text-white text-center">
                  <motion.div
                    className="text-3xl mb-1"
                    animate={{
                      scale: [1, 1.1, 1],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      repeatDelay: 1,
                    }}
                  >
                    {emoji}
                  </motion.div>
                  <div className="text-sm font-semibold capitalize drop-shadow-lg">
                    {segment.emotion}
                  </div>
                  <div className="text-xs opacity-90 mt-1">
                    {segment.count} times
                  </div>
                </div>

                {/* Hover overlay */}
                <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-all duration-300 rounded-2xl" />
              </motion.div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
});

EmotionFlow.displayName = 'EmotionFlow';
