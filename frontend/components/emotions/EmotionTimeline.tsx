'use client';

import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { EMOTION_CONFIG, type AnalysisHistory, type EmotionType, type TextAnalysisResult, type VoiceAnalysisResult, type MultiModalResult } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { FileText, Mic, Layers } from 'lucide-react';

interface EmotionTimelineProps {
  history: AnalysisHistory[];
  maxItems?: number;
}

export function EmotionTimeline({ history, maxItems = 10 }: EmotionTimelineProps) {
  const displayHistory = history.slice(0, maxItems);

  const getIcon = (type: string) => {
    switch (type) {
      case 'text':
        return FileText;
      case 'voice':
        return Mic;
      case 'multimodal':
        return Layers;
      default:
        return FileText;
    }
  };

  const getEmotion = (item: AnalysisHistory) => {
    if (item.type === 'text') {
      return (item.result as TextAnalysisResult).emotion;
    }
    if (item.type === 'voice') {
      return (item.result as VoiceAnalysisResult).combined_emotion?.emotion;
    }
    if (item.type === 'multimodal') {
      return (item.result as MultiModalResult).weighted_emotion?.emotion;
    }
    return 'neutral';
  };

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
      <ScrollArea className="h-[400px] pr-4">
        <div className="space-y-4">
          {displayHistory.map((item, index) => {
            const Icon = getIcon(item.type);
            const emotion = getEmotion(item);
            const config = EMOTION_CONFIG[emotion as EmotionType] || { 
              color: '#6B7280', 
              emoji: '❓', 
              bgColor: 'bg-gray-400' 
            };
            const timestamp = new Date(item.timestamp);

            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className="flex gap-4 items-start"
              >
                {/* Timeline line */}
                <div className="relative flex flex-col items-center">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white"
                    style={{ backgroundColor: config.color }}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  {index < displayHistory.length - 1 && (
                    <div className="w-0.5 h-16 bg-border mt-2" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 pb-4">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-medium capitalize">{item.type} Analysis</p>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(timestamp, { addSuffix: true })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{config.emoji}</span>
                    <span className="font-semibold capitalize" style={{ color: config.color }}>
                      {emotion}
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </ScrollArea>
    </Card>
  );
}
