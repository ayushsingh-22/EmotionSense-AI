/**
 * Journal Emotion Summary Component
 * Displays emotion distribution chart
 */

import React from 'react';
import { Card } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';
import { getEmotionConfig, getEmotionEmoji } from '@/components/insights/emotionConfig';
import { cn } from '@/lib/utils';

interface JournalEmotionSummaryProps {
  emotionCounts: Record<string, number>;
  dominantEmotion: string;
}

export function JournalEmotionSummary({
  emotionCounts,
  dominantEmotion,
}: JournalEmotionSummaryProps) {
  const totalEmotions = Object.values(emotionCounts).reduce((a, b) => a + b, 0);

  const sortedEmotions = Object.entries(emotionCounts).sort(
    ([, a], [, b]) => b - a
  );

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-indigo-500" />
        Emotion Distribution
      </h3>

      <div className="space-y-3">
        {sortedEmotions.map(([emotion, count]) => {
          const percentage = ((count / totalEmotions) * 100).toFixed(1);
          const normalizedEmotion = (emotion || 'neutral').toLowerCase().trim();
          const normalizedDominant = (dominantEmotion || 'neutral').toLowerCase().trim();
          const isDominant = normalizedEmotion === normalizedDominant;
          const emotionConfig = getEmotionConfig(normalizedEmotion);

          return (
            <div key={emotion} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-base">{getEmotionEmoji(normalizedEmotion)}</span>
                  <span
                    className={cn(
                      'capitalize',
                      isDominant ? 'font-bold' : 'font-medium',
                      emotionConfig.text
                    )}
                  >
                    {normalizedEmotion}
                    {isDominant && (
                      <span className="ml-2 text-xs opacity-70">
                        (dominant)
                      </span>
                    )}
                  </span>
                </div>
                <span className="text-muted-foreground font-medium">
                  {count} ({percentage}%)
                </span>
              </div>

              <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden relative">
                <div
                  className={cn(
                    'h-full transition-all duration-500 rounded-full',
                    `bg-gradient-to-r ${emotionConfig.gradient}`
                  )}
                  style={{ width: `${percentage}%` }}
                />
                {/* Subtle glow effect for dominant emotion */}
                {isDominant && (
                  <div 
                    className={cn(
                      'absolute inset-0 rounded-full',
                      emotionConfig.glow
                    )}
                    style={{ width: `${percentage}%` }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 pt-4 border-t">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Total Emotions Recorded</span>
          <span className="font-semibold">{totalEmotions}</span>
        </div>
      </div>
    </Card>
  );
}
