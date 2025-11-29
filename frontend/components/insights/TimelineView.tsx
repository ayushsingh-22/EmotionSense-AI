/**
 * TimelineView - Interactive infinite-scroll timeline with detail panel
 */

'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, parseISO } from 'date-fns';
import { Sparkles, X, TrendingUp, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { getEmotionConfig, getEmotionEmoji } from './emotionConfig';
import type { KeyMoment } from '@/lib/insightsApi';

interface TimelineViewProps {
  moments: KeyMoment[];
  isLoading: boolean;
}

interface DetailPanelProps {
  moment: KeyMoment;
  onClose: () => void;
}

const MiniSparkline = React.memo(({ confidence }: { confidence: number }) => {
  const points = React.useMemo(() => {
    const variation = 0.1;
    return Array.from({ length: 8 }, () => {
      const baseValue = confidence;
      const randomOffset = (Math.random() - 0.5) * variation;
      return Math.max(0, Math.min(1, baseValue + randomOffset));
    });
  }, [confidence]);

  const pathData = points
    .map((point, i) => {
      const x = (i / (points.length - 1)) * 100;
      const y = 100 - point * 100;
      return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
    })
    .join(' ');

  return (
    <svg className="w-full h-8" viewBox="0 0 100 100" preserveAspectRatio="none">
      <motion.path
        d={pathData}
        stroke="hsl(var(--primary))"
        strokeWidth="3"
        fill="none"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1, ease: "easeInOut" }}
      />
    </svg>
  );
});

MiniSparkline.displayName = 'MiniSparkline';

const DetailPanel = React.memo(({ moment, onClose }: DetailPanelProps) => {
  const config = getEmotionConfig(moment.emotion);
  const emoji = getEmotionEmoji(moment.emotion);

  return (
    <motion.div
      initial={{ opacity: 0, x: 300 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 300 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="fixed right-0 top-0 h-full w-full md:w-96 bg-background/95 backdrop-blur-xl border-l-2 border-border shadow-2xl z-50 overflow-y-auto"
    >
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <h3 className="text-lg font-bold">Moment Details</h3>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="rounded-full hover:bg-destructive/10"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Emotion Badge with Gradient */}
        <motion.div
          className={`relative bg-gradient-to-br ${config.gradient} p-6 rounded-2xl overflow-hidden`}
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1 }}
        >
          <motion.div
            className="absolute inset-0 bg-white/10"
            animate={{
              opacity: 0.2,
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
            }}
          />
          <div className="relative z-10 text-center text-white">
            <motion.div
              className="text-6xl mb-3"
              animate={{
                rotate: 10,
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                repeatType: "reverse",
                repeatDelay: 2,
              }}
            >
              {emoji}
            </motion.div>
            <h4 className="text-2xl font-bold capitalize mb-1 drop-shadow-lg">
              {moment.emotion}
            </h4>
            <p className="text-white/90 text-sm">
              {Math.round(moment.confidence * 100)}% confidence
            </p>
          </div>
        </motion.div>

        {/* Confidence Sparkline */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase">
              Emotion Intensity
            </span>
            <TrendingUp className="h-4 w-4 text-primary" />
          </div>
          <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl p-3 border border-primary/20">
            <MiniSparkline confidence={moment.confidence} />
          </div>
        </div>

        {/* Context */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Context
          </h4>
          <div className="bg-gradient-to-br from-background to-muted/30 rounded-xl p-4 border border-border">
            <p className="text-sm leading-relaxed">{moment.context}</p>
          </div>
        </div>

        {/* Timestamp */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-2">
            <Clock className="h-4 w-4" />
            When
          </h4>
          <div className="bg-gradient-to-br from-background to-muted/30 rounded-xl p-4 border border-border">
            <p className="text-sm font-medium">
              {format(parseISO(moment.timestamp), 'EEEE, MMMM d, yyyy')}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {format(parseISO(moment.timestamp), 'h:mm a')}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
});

DetailPanel.displayName = 'DetailPanel';

const TimelineMomentCard = React.memo(({ 
  moment, 
  index, 
  onClick 
}: { 
  moment: KeyMoment; 
  index: number;
  onClick: () => void;
}) => {
  const config = getEmotionConfig(moment.emotion);
  const emoji = getEmotionEmoji(moment.emotion);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.4 }}
      whileHover={{ scale: 1.02, x: 8 }}
      onClick={onClick}
      className="cursor-pointer"
    >
      <Card className="overflow-hidden border-2 border-border/50 hover:border-primary/50 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-background to-background/50 backdrop-blur-sm">
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            {/* Emotion Avatar with Glow */}
            <motion.div
              className={`relative p-4 rounded-2xl bg-gradient-to-br ${config.gradient} text-white shrink-0 border-2 ${config.border} shadow-lg`}
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
              <span className="text-3xl">{emoji}</span>
              
              {/* Intensity bar */}
              <motion.div
                className="absolute bottom-0 left-0 right-0 h-1 bg-white/30 rounded-b-xl overflow-hidden"
              >
                <motion.div
                  className="h-full bg-white"
                  initial={{ width: 0 }}
                  animate={{ width: `${moment.confidence * 100}%` }}
                  transition={{ delay: 0.5, duration: 0.8 }}
                />
              </motion.div>
            </motion.div>

            {/* Content */}
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className={`capitalize ${config.text} border-current`}>
                  {moment.emotion}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {Math.round(moment.confidence * 100)}% confidence
                </span>
              </div>
              
              <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                {moment.context}
              </p>
              
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>{format(parseISO(moment.timestamp), 'MMM d, yyyy • h:mm a')}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
});

TimelineMomentCard.displayName = 'TimelineMomentCard';

export const TimelineView = React.memo(({ moments, isLoading }: TimelineViewProps) => {
  const [selectedMoment, setSelectedMoment] = useState<KeyMoment | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                <Skeleton className="h-16 w-16 rounded-2xl shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-4 w-48" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (moments.length === 0) {
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
              transition={{ duration: 2, repeat: Infinity, repeatType: "reverse", repeatDelay: 1 }}
            >
              <Sparkles className="h-16 w-16 mx-auto mb-4 text-primary" />
            </motion.div>
            <h3 className="text-lg font-semibold mb-2">No key moments yet</h3>
            <p className="text-muted-foreground">
              Your emotional journey starts here! Keep chatting to create memorable moments.
            </p>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <>
      <div className="space-y-4 relative">
        {/* Vertical Timeline Line */}
        <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary via-primary/50 to-transparent hidden md:block" />
        
        <AnimatePresence mode="popLayout">
          {moments.map((moment, idx) => (
            <TimelineMomentCard
              key={idx}
              moment={moment}
              index={idx}
              onClick={() => setSelectedMoment(moment)}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Detail Panel */}
      <AnimatePresence>
        {selectedMoment && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
              onClick={() => setSelectedMoment(null)}
            />
            
            {/* Panel */}
            <DetailPanel moment={selectedMoment} onClose={() => setSelectedMoment(null)} />
          </>
        )}
      </AnimatePresence>
    </>
  );
});

TimelineView.displayName = 'TimelineView';
