/**
 * WeeklyView - Interactive collapsible weekly panels with charts
 */

'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, parseISO } from 'date-fns';
import { ChevronDown, Sparkles, TrendingUp, Star } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { WeeklyArcChart } from './WeeklyArcChart';
import { getEmotionConfig, getEmotionEmoji } from './emotionConfig';
import type { WeeklyInsight, KeyHighlight } from '@/lib/insightsApi';

interface WeeklyViewProps {
  insights: WeeklyInsight[];
  isLoading: boolean;
}

interface CollapsibleWeekCardProps {
  insight: WeeklyInsight;
  index: number;
}

const HighlightChip = React.memo(({ highlight, index }: { highlight: string | KeyHighlight; index: number }) => {
  const isObject = typeof highlight === 'object' && highlight !== null;
  const displayText = isObject ? highlight.description : highlight;
  const highlightType = isObject ? highlight.type : 'insight';
  const emotion = isObject ? highlight.emotion : null;

  const config = emotion ? getEmotionConfig(emotion) : null;
  
  const typeConfig = {
    peak: { icon: Star, color: 'text-green-600', bg: 'bg-green-500/10', border: 'border-green-500/30' },
    low: { icon: TrendingUp, color: 'text-orange-600', bg: 'bg-orange-500/10', border: 'border-orange-500/30' },
    insight: { icon: Sparkles, color: 'text-blue-600', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
  };

  const type = typeConfig[highlightType as keyof typeof typeConfig] || typeConfig.insight;
  const Icon = type.icon;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`flex items-start gap-3 p-3 rounded-xl ${config?.bg || type.bg} border ${config?.border || type.border} backdrop-blur-sm`}
      whileHover={{ scale: 1.02, x: 4 }}
    >
      <div className={`p-2 rounded-lg ${type.bg} ${type.color} shrink-0`}>
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-sm flex-1 leading-relaxed">{displayText}</p>
    </motion.div>
  );
});

HighlightChip.displayName = 'HighlightChip';

const CollapsibleWeekCard = React.memo(({ insight, index }: CollapsibleWeekCardProps) => {
  const [isOpen, setIsOpen] = useState(index === 0);
  const config = getEmotionConfig(insight.dominant_emotion);
  const emoji = getEmotionEmoji(insight.dominant_emotion);

  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.5 }}
    >
      <Card className="overflow-hidden border-2 border-border/50 shadow-xl hover:shadow-2xl transition-all duration-300 bg-gradient-to-br from-background via-background to-background/50 backdrop-blur-sm">
        {/* Collapsible Header */}
        <motion.div
          className={`relative bg-gradient-to-r ${config.gradient} p-5 cursor-pointer overflow-hidden`}
          onClick={() => setIsOpen(!isOpen)}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
        >
          {/* Animated grid pattern */}
          <motion.div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: 'linear-gradient(0deg, transparent 24%, white 25%, white 26%, transparent 27%, transparent 74%, white 75%, white 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, white 25%, white 26%, transparent 27%, transparent 74%, white 75%, white 76%, transparent 77%, transparent)',
              backgroundSize: '50px 50px',
            }}
            animate={{
              backgroundPosition: ['0px 0px', '50px 50px'],
            }}
            transition={{
              duration: 5,
              repeat: Infinity,
              ease: "linear",
            }}
          />

          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-4 flex-1">
              {/* Emoji Badge */}
              <motion.div
                className="bg-white/20 backdrop-blur-sm rounded-2xl p-3 border-2 border-white/30"
                animate={{
                  rotate: isOpen ? 0 : [0, -10, 10, 0],
                }}
                transition={{
                  duration: 2,
                  repeat: isOpen ? 0 : Infinity,
                  repeatDelay: 3,
                }}
              >
                <span className="text-4xl">{emoji}</span>
              </motion.div>

              <div className="flex-1">
                <h3 className="text-xl font-bold text-white drop-shadow-lg mb-1">
                  Week of {format(parseISO(insight.week_start), 'MMM d')} - {format(parseISO(insight.week_end), 'MMM d, yyyy')}
                </h3>
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className="capitalize font-semibold bg-white/90 text-gray-900">
                    {insight.dominant_emotion}
                  </Badge>
                  <span className="text-white/90 text-sm font-medium">
                    Avg Mood: {Math.round(insight.avg_mood_score)}/100
                  </span>
                </div>
              </div>
            </div>

            {/* Expand/Collapse Icon */}
            <motion.div
              animate={{ rotate: isOpen ? 180 : 0 }}
              transition={{ duration: 0.3 }}
              className="bg-white/20 backdrop-blur-sm rounded-full p-2"
            >
              <ChevronDown className="h-6 w-6 text-white" />
            </motion.div>
          </div>
        </motion.div>

        {/* Collapsible Content */}
        <AnimatePresence initial={false}>
          {isOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
            >
              <CardContent className="p-6 space-y-6">
                {/* Weekly Reflection */}
                {insight.reflection_text && (
                  <motion.div
                    className="relative bg-gradient-to-br from-primary/5 to-primary/10 rounded-2xl p-5 border border-primary/20"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 }}
                  >
                    <h4 className="text-xs font-semibold text-primary mb-2 uppercase tracking-wider">
                      Weekly Reflection
                    </h4>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {insight.reflection_text}
                    </p>
                  </motion.div>
                )}

                {/* Weekly Arc Chart */}
                {insight.daily_arc && insight.daily_arc.length > 0 && (
                  <WeeklyArcChart dailyArc={insight.daily_arc} />
                )}

                {/* Key Highlights */}
                {insight.key_highlights && insight.key_highlights.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                      Key Highlights
                    </h4>
                    <div className="space-y-2">
                      {insight.key_highlights.map((highlight, idx) => (
                        <HighlightChip key={idx} highlight={highlight} index={idx} />
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
});

CollapsibleWeekCard.displayName = 'CollapsibleWeekCard';

export const WeeklyView = React.memo(({ insights, isLoading }: WeeklyViewProps) => {
  if (isLoading) {
    return (
      <div className="space-y-6">
        {[1, 2].map((i) => (
          <Card key={i} className="overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-primary/20 to-primary/10">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-40 mt-2" />
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <Skeleton className="h-48 w-full" />
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
                rotate: [0, 10, -10, 0],
                scale: [1, 1.1, 1]
              }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
            >
              <Sparkles className="h-16 w-16 mx-auto mb-4 text-primary" />
            </motion.div>
            <h3 className="text-lg font-semibold mb-2">No weekly insights yet</h3>
            <p className="text-muted-foreground">
              Keep tracking to see weekly patterns and emotional trends!
            </p>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <div className="space-y-6">
      <AnimatePresence mode="popLayout">
        {insights.map((insight, idx) => (
          <CollapsibleWeekCard key={insight.id} insight={insight} index={idx} />
        ))}
      </AnimatePresence>
    </div>
  );
});

WeeklyView.displayName = 'WeeklyView';
