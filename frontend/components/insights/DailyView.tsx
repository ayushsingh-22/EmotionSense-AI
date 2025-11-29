/**
 * DailyView - Premium daily emotion capsule with animations
 */

'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, parseISO } from 'date-fns';
import { Calendar, Sparkles, Quote } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmotionFlow } from './EmotionFlow';
import { EmotionDistribution } from './EmotionDistribution';
import { getEmotionConfig, getEmotionEmoji } from './emotionConfig';
import type { DailyInsight } from '@/lib/insightsApi';

interface DailyViewProps {
  insights: DailyInsight[];
  isLoading: boolean;
}

const MoodWaveSparkline = React.memo(({ moodScore }: { moodScore: number }) => {
  const points = React.useMemo(() => {
    const variation = 10;
    return Array.from({ length: 12 }, () => {
      const baseValue = moodScore;
      const randomOffset = (Math.random() - 0.5) * variation;
      return Math.max(0, Math.min(100, baseValue + randomOffset));
    });
  }, [moodScore]);

  const maxPoint = 100;
  const pathData = points
    .map((point, i) => {
      const x = (i / (points.length - 1)) * 100;
      const y = 100 - (point / maxPoint) * 100;
      return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
    })
    .join(' ');

  return (
    <svg className="w-full h-12" viewBox="0 0 100 100" preserveAspectRatio="none">
      <defs>
        <linearGradient id="sparklineGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.3" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.05" />
        </linearGradient>
      </defs>
      <motion.path
        d={`${pathData} L 100 100 L 0 100 Z`}
        fill="url(#sparklineGradient)"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.5, ease: "easeInOut" }}
      />
      <motion.path
        d={pathData}
        stroke="hsl(var(--primary))"
        strokeWidth="2"
        fill="none"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.5, ease: "easeInOut" }}
      />
    </svg>
  );
});

MoodWaveSparkline.displayName = 'MoodWaveSparkline';

const TypewriterText = React.memo(({ text }: { text: string }) => {
  const [displayText, setDisplayText] = React.useState('');
  
  React.useEffect(() => {
    let i = 0;
    const timer = setInterval(() => {
      if (i < text.length) {
        setDisplayText(text.slice(0, i + 1));
        i++;
      } else {
        clearInterval(timer);
      }
    }, 20);
    
    return () => clearInterval(timer);
  }, [text]);

  return <p className="text-sm leading-relaxed text-muted-foreground">{displayText}</p>;
});

TypewriterText.displayName = 'TypewriterText';

export const DailyView = React.memo(({ insights, isLoading }: DailyViewProps) => {
  if (isLoading) {
    return (
      <div className="space-y-6">
        {[1, 2].map((i) => (
          <Card key={i} className="overflow-hidden">
            <CardHeader>
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32 mt-2" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-16 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (insights.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="overflow-hidden border-2 border-dashed">
          <CardContent className="p-12 text-center">
            <motion.div
              animate={{ 
                rotate: 10,
                scale: 1.1
              }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
            >
              <Sparkles className="h-16 w-16 mx-auto mb-4 text-primary" />
            </motion.div>
            <h3 className="text-lg font-semibold mb-2">No daily insights yet</h3>
            <p className="text-muted-foreground">
              Start chatting to track your emotions and build your emotional journey!
            </p>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <div className="space-y-6">
      <AnimatePresence mode="popLayout">
        {insights.map((insight, idx) => {
          const dominantEmotion = insight.emotion_summary?.dominant_emotion || 'neutral';
          const config = getEmotionConfig(dominantEmotion);
          const emoji = getEmotionEmoji(dominantEmotion);

          return (
            <motion.div
              key={insight.id}
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -50 }}
              transition={{ 
                delay: idx * 0.1, 
                duration: 0.5,
                type: "spring",
                stiffness: 100
              }}
            >
              <Card className="overflow-hidden border-2 border-border/50 shadow-xl hover:shadow-2xl transition-all duration-300 bg-gradient-to-br from-background via-background to-background/50 backdrop-blur-sm">
                {/* Gradient Header */}
                <div className={`relative bg-gradient-to-r ${config.gradient} p-6 overflow-hidden`}>
                  {/* Animated background pattern */}
                  <motion.div
                    className="absolute inset-0 opacity-20"
                    style={{
                      backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
                      backgroundSize: '20px 20px',
                    }}
                    animate={{
                      backgroundPosition: ['0px 0px', '20px 20px'],
                    }}
                    transition={{
                      duration: 4,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                  />
                  
                  <div className="relative z-10 flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Calendar className="h-5 w-5 text-white/90" />
                        <h3 className="text-xl font-bold text-white drop-shadow-lg">
                          {format(parseISO(insight.date), 'EEEE, MMMM d, yyyy')}
                        </h3>
                      </div>
                      <p className="text-white/90 text-sm font-medium">
                        Mood Score: {Math.round(insight.emotion_summary?.mood_score || 50)}/100
                      </p>
                    </div>
                    
                    <motion.div
                      className="flex flex-col items-center gap-1"
                      whileHover={{ scale: 1.1, rotate: 5 }}
                    >
                      <div className="text-4xl">{emoji}</div>
                      <Badge variant="secondary" className="capitalize font-semibold bg-white/90 text-gray-900">
                        {insight.emotion_summary?.dominant_emotion || 'neutral'}
                      </Badge>
                    </motion.div>
                  </div>

                  {/* Mood Wave Sparkline */}
                  <div className="mt-4">
                    <MoodWaveSparkline moodScore={insight.emotion_summary?.mood_score || 50} />
                  </div>
                </div>

                <CardContent className="p-6 space-y-6">
                  {/* Day-at-a-Glance Stats - NEW */}
                  <motion.div
                    className="grid grid-cols-3 gap-4"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                  >
                    <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-lg p-3 text-center border border-primary/20">
                      <div className="text-2xl font-bold text-primary">
                        {insight.emotion_summary?.message_count || 0}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">Messages</div>
                    </div>
                    <div className="bg-gradient-to-br from-secondary/5 to-secondary/10 rounded-lg p-3 text-center border border-secondary/20">
                      <div className="text-2xl font-bold text-secondary-foreground">
                        {insight.emotion_summary?.time_segments?.filter((s: { count: number }) => s.count > 0).length || 0}/3
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">Time Periods</div>
                    </div>
                    <div className="bg-gradient-to-br from-accent/5 to-accent/10 rounded-lg p-3 text-center border border-accent/20">
                      <div className="text-lg font-bold flex items-center justify-center gap-1">
                        {Object.entries(insight.emotion_summary?.emotion_counts || {})
                          .sort(([, a], [, b]) => (b as number) - (a as number))
                          .slice(0, 3)
                          .map(([emotion]) => getEmotionEmoji(emotion))
                          .join(' ')}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">Top Emotions</div>
                    </div>
                  </motion.div>

                  {/* Context Summary */}
                  {insight.emotion_summary?.context_summary && (
                    <motion.div
                      className="bg-gradient-to-r from-muted/50 to-muted/30 rounded-xl p-4 border border-border/50"
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                    >
                      <p className="text-sm text-muted-foreground italic">
                        {insight.emotion_summary.context_summary}
                      </p>
                    </motion.div>
                  )}

                  {/* Journal Entry with Quote Icon */}
                  {insight.content && (
                    <motion.div
                      className="relative bg-gradient-to-br from-primary/5 to-primary/10 rounded-2xl p-5 border border-primary/20"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 }}
                    >
                      <Quote className="absolute top-3 left-3 h-6 w-6 text-primary/30" />
                      <div className="pl-8">
                        <h4 className="text-xs font-semibold text-primary mb-2 uppercase tracking-wider">
                          Daily Reflection
                        </h4>
                        <TypewriterText text={insight.content} />
                      </div>
                    </motion.div>
                  )}

                  {/* Emotion Flow */}
                  {insight.emotion_summary?.time_segments && insight.emotion_summary.time_segments.length > 0 && (
                    <EmotionFlow timeSegments={insight.emotion_summary.time_segments} />
                  )}

                  {/* Emotion Distribution Bubbles */}
                  {insight.emotion_summary?.emotion_counts && Object.keys(insight.emotion_summary.emotion_counts).length > 0 && (
                    <EmotionDistribution emotionCounts={insight.emotion_summary.emotion_counts} />
                  )}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
});

DailyView.displayName = 'DailyView';
