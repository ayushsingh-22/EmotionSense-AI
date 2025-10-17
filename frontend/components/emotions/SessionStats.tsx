'use client';

import { Card } from '@/components/ui/card';
import { EMOTION_CONFIG, type AnalysisHistory, type EmotionType } from '@/types';
import { Activity, TrendingUp } from 'lucide-react';

interface SessionStatsProps {
  history: AnalysisHistory[];
}

export function SessionStats({ history }: SessionStatsProps) {
  const totalAnalyses = history.length;

  // Get top emotion
  const emotionCounts: Record<string, number> = {};
  history.forEach((item) => {
    let emotion = 'neutral';
    if ('main_emotion' in item.result) {
      emotion = item.result.main_emotion.emotion;
    } else if ('combined_emotion' in item.result) {
      emotion = item.result.combined_emotion.emotion;
    } else if ('weighted_emotion' in item.result) {
      emotion = item.result.weighted_emotion.emotion;
    }
    emotionCounts[emotion] = (emotionCounts[emotion] || 0) + 1;
  });

  const topEmotion = Object.entries(emotionCounts).sort(([, a], [, b]) => b - a)[0];
  const topEmotionName = topEmotion?.[0] || 'neutral';
  const topEmotionConfig = EMOTION_CONFIG[topEmotionName as EmotionType] || { 
    color: '#6B7280', 
    emoji: '❓', 
    bgColor: 'bg-gray-400' 
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Total Analyses */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Total Analyses</p>
            <p className="text-3xl font-bold mt-1">{totalAnalyses}</p>
          </div>
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Activity className="h-6 w-6 text-primary" />
          </div>
        </div>
      </Card>

      {/* Top Emotion */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Most Common</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-2xl">{topEmotionConfig.emoji}</span>
              <p
                className="text-2xl font-bold capitalize"
                style={{ color: topEmotionConfig.color }}
              >
                {topEmotionName}
              </p>
            </div>
          </div>
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <TrendingUp className="h-6 w-6 text-primary" />
          </div>
        </div>
      </Card>
    </div>
  );
}
