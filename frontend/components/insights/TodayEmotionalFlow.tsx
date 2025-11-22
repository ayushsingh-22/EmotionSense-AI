/**
 * TodayEmotionalFlow - Time-based emotion breakdown
 * Shows Morning/Afternoon/Evening emotion distribution with stats
 */

'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Sun, Sunset, Moon, MessageSquare, Heart, TrendingUp } from 'lucide-react';
import { getEmotionConfig, getEmotionEmoji } from './emotionConfig';
import type { DailyInsight } from '@/lib/insightsApi';

interface TodayEmotionalFlowProps {
  insight: DailyInsight;
}

const periodIcons = {
  morning: Sun,
  afternoon: Sunset,
  evening: Moon,
};

const periodLabels = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
};

export const TodayEmotionalFlow = React.memo(({ insight }: TodayEmotionalFlowProps) => {
  const { emotion_summary } = insight;
  
  // Calculate unique emotions count
  const uniqueEmotionsCount = useMemo(() => {
    return Object.keys(emotion_summary?.emotion_counts || {}).length;
  }, [emotion_summary]);

  // Process time segments for visualization
  const timeSegments = useMemo(() => {
    if (!emotion_summary?.time_segments || emotion_summary.time_segments.length === 0) {
      return [];
    }
    
    return emotion_summary.time_segments.map(segment => ({
      ...segment,
      Icon: periodIcons[segment.period] || Sun,
      label: periodLabels[segment.period] || segment.period,
      config: getEmotionConfig(segment.emotion),
      emoji: getEmotionEmoji(segment.emotion),
    }));
  }, [emotion_summary]);

  if (!emotion_summary || timeSegments.length === 0) {
    return null;
  }

  return (
    <motion.div
      className="space-y-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <h3 className="text-lg font-semibold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
        Today&apos;s Emotional Flow
      </h3>

      {/* Main Container with Glassmorphism */}
      <motion.div
        className="relative bg-gradient-to-br from-background via-background to-background/50 backdrop-blur-sm rounded-2xl p-6 border-2 border-border/50 shadow-xl overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.5 }}
      >
        {/* Animated background pattern */}
        <motion.div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: 'linear-gradient(90deg, hsl(var(--primary)) 1px, transparent 1px), linear-gradient(0deg, hsl(var(--primary)) 1px, transparent 1px)',
            backgroundSize: '30px 30px',
          }}
          animate={{
            backgroundPosition: ['0px 0px', '30px 30px'],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "linear",
          }}
        />

        <div className="relative z-10 grid md:grid-cols-[1fr_auto] gap-6">
          {/* Time Segments */}
          <div className="space-y-4">
            {timeSegments.map((segment, idx) => (
              <motion.div
                key={segment.period}
                className="space-y-2"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + idx * 0.1 }}
              >
                {/* Period Header */}
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-lg bg-gradient-to-br ${segment.config.bg} border ${segment.config.border}`}>
                    <segment.Icon className={`h-4 w-4 ${segment.config.text}`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{segment.label}</span>
                      <span className="text-xl">{segment.emoji}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {segment.count} {segment.count === 1 ? 'message' : 'messages'}
                    </p>
                  </div>
                </div>

                {/* Emotion Bar - Enhanced with better color visibility */}
                <div className="relative h-10 rounded-xl overflow-hidden border border-border/30">
                  {/* Background with emotion theme */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${segment.config.bg}`} />
                  
                  {/* Main gradient bar */}
                  <motion.div
                    className={`absolute inset-0 bg-gradient-to-r ${segment.config.gradient}`}
                    style={{ opacity: 0.85 }}
                    initial={{ width: 0 }}
                    animate={{ width: '100%' }}
                    transition={{ delay: 0.3 + idx * 0.1, duration: 0.8, ease: "easeOut" }}
                  />
                  
                  {/* Content overlay */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-sm font-semibold text-white drop-shadow-lg capitalize">
                      {segment.emotion}
                    </span>
                  </div>
                  
                  {/* Shimmer effect */}
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                    animate={{
                      x: ['-100%', '100%'],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      repeatDelay: 3,
                      ease: "easeInOut",
                    }}
                  />
                </div>
              </motion.div>
            ))}
          </div>

          {/* Stats Cards */}
          <div className="flex md:flex-col gap-3 md:min-w-[160px]">
            {/* Messages Count */}
            <motion.div
              className="flex-1 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border border-blue-500/30 rounded-xl p-4 text-center"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4, type: "spring" }}
            >
              <MessageSquare className="h-5 w-5 text-blue-600 mx-auto mb-1.5" />
              <div className="text-2xl font-bold text-blue-700">
                {emotion_summary.message_count || 0}
              </div>
              <div className="text-xs text-blue-600 font-medium">Messages</div>
            </motion.div>

            {/* Unique Emotions */}
            <motion.div
              className="flex-1 bg-gradient-to-br from-pink-500/10 to-rose-500/10 border border-pink-500/30 rounded-xl p-4 text-center"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5, type: "spring" }}
            >
              <Heart className="h-5 w-5 text-pink-600 mx-auto mb-1.5" />
              <div className="text-2xl font-bold text-pink-700">
                {uniqueEmotionsCount}
              </div>
              <div className="text-xs text-pink-600 font-medium">Emotions</div>
            </motion.div>

            {/* Average Mood Score */}
            <motion.div
              className="flex-1 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/30 rounded-xl p-4 text-center"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6, type: "spring" }}
            >
              <TrendingUp className="h-5 w-5 text-emerald-600 mx-auto mb-1.5" />
              <div className="text-2xl font-bold text-emerald-700">
                {Math.round(emotion_summary.mood_score || 50)}
              </div>
              <div className="text-xs text-emerald-600 font-medium">Avg Mood</div>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
});

TodayEmotionalFlow.displayName = 'TodayEmotionalFlow';
