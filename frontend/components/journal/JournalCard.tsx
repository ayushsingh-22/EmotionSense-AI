/**
 * Journal Card Component
 * Displays a single journal entry in card format
 */

import React from 'react';
import { Card } from '@/components/ui/card';
import { Calendar, TrendingUp, Heart } from 'lucide-react';
import { JournalEntry } from '@/lib/api';
import { cn } from '@/lib/utils';
import { getEmotionConfig, getEmotionEmoji } from '@/components/insights/emotionConfig';

interface JournalCardProps {
  journal: JournalEntry;
  onClick?: () => void;
}

// Helper function to get emotion-based card background
const getEmotionCardClass = (emotion: string) => {
  const config = getEmotionConfig(emotion);
  return config.bg + ' ' + config.border;
};

// Helper function to get emotion-based left border
const getEmotionBorderClass = (emotion: string) => {
  // Extract color from gradient for border
  const colorMap: Record<string, string> = {
    'anger': 'border-l-red-500',
    'disgust': 'border-l-green-500', 
    'fear': 'border-l-purple-500',
    'joy': 'border-l-yellow-500',
    'neutral': 'border-l-gray-500',
    'sadness': 'border-l-blue-500',
    'surprise': 'border-l-pink-500'
  };
  return colorMap[emotion] || 'border-l-gray-500';
};

export function JournalCard({ journal, onClick }: JournalCardProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    }
  };

  const getMoodGradient = (emotion: string) => {
    const config = getEmotionConfig(emotion);
    return config.gradient.replace('from-', 'from-').replace('via-', 'via-').replace('to-', 'to-');
  };

  const dominantEmotion = journal.emotion_summary?.dominant_emotion || 'neutral';
  const moodScore = journal.emotion_summary?.mood_score || 50;
  const timeSegments = journal.emotion_summary?.time_segments || [];

  // Extract first line as preview (up to 150 chars)
  const previewText = journal.content.split('\n').slice(2, 4).join(' ').substring(0, 150) + '...';

  return (
    <Card
      className={cn(
        'p-6 hover:shadow-lg transition-all duration-300 cursor-pointer',
        'border-l-4 relative overflow-hidden',
        getEmotionBorderClass(dominantEmotion)
      )}
      onClick={onClick}
    >
      {/* Subtle emotion-based background gradient */}
      <div 
        className={cn(
          'absolute inset-0 opacity-5',
          getEmotionCardClass(dominantEmotion)
        )}
      />
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-muted-foreground" />
          <span className="font-medium text-sm text-muted-foreground">
            {formatDate(journal.date)}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <div className={cn(
            'px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1',
            getEmotionConfig(dominantEmotion).bg,
            getEmotionConfig(dominantEmotion).text,
            getEmotionConfig(dominantEmotion).border
          )}>
            <span className="text-sm">{getEmotionEmoji(dominantEmotion)}</span>
            <span className="capitalize font-semibold">{dominantEmotion}</span>
          </div>
        </div>
      </div>

      {/* Mood Score */}
      {moodScore > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Heart className="h-4 w-4" /> Mood Score
            </span>
            <span className="font-semibold text-lg">{moodScore.toFixed(1)}/100</span>
          </div>
          
          <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden relative">
            <div
              className={cn(
                'h-full bg-gradient-to-r transition-all duration-500 rounded-full',
                getMoodGradient(dominantEmotion)
              )}
              style={{ width: `${moodScore}%` }}
            />
            {/* Subtle glow effect */}
            <div 
              className={cn(
                'absolute inset-0 rounded-full',
                getEmotionConfig(dominantEmotion).glow
              )}
              style={{ width: `${moodScore}%` }}
            />
          </div>
        </div>
      )}

      {/* Journal Preview */}
      <div className="mb-4">
        <p className="text-sm text-muted-foreground line-clamp-3">
          {previewText}
        </p>
      </div>

      {/* Time Segments */}
      {timeSegments && timeSegments.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {timeSegments.map((segment, index) => {
            const segmentConfig = getEmotionConfig(segment.emotion);
            return (
              <div
                key={index}
                className={cn(
                  'flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium',
                  segmentConfig.bg,
                  segmentConfig.text,
                  segmentConfig.border
                )}
              >
                <TrendingUp className="h-3 w-3" />
                <span className="capitalize font-medium">{segment.period}:</span>
                <span className="flex items-center gap-1">
                  {getEmotionEmoji(segment.emotion)}
                  <span className="font-semibold">{segment.emotion}</span>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
