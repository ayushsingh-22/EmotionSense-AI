/**
 * Journal Detail Component
 * Displays full journal entry with emotion summary
 */

import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { JournalEntry } from '@/lib/api';
import { Calendar, ArrowLeft, Heart, TrendingUp, Sparkles } from 'lucide-react';
import { JournalEmotionSummary } from './JournalEmotionSummary';
import { cn } from '@/lib/utils';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';

interface JournalDetailProps {
  journal: JournalEntry;
  onBack?: () => void;
}

const emotionEmoji: Record<string, string> = {
  anger: '🤬',
  disgust: '🤢',
  fear: '😨',
  joy: '😀',
  neutral: '😐',
  sadness: '😭',
  surprise: '😲',
};

export function JournalDetail({ journal, onBack }: JournalDetailProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getMoodGradient = (score?: number) => {
    if (!score) return 'from-gray-500 to-gray-500';
    if (score >= 70) return 'from-green-500 to-emerald-500';
    if (score >= 50) return 'from-blue-500 to-cyan-500';
    if (score >= 30) return 'from-yellow-500 to-orange-500';
    return 'from-red-500 to-pink-500';
  };

  // Use top-level emotion fields (consistent with backend)
  const dominantEmotion = journal.emotion || journal.emotion_summary?.dominant_emotion || 'neutral';
  const displayEmoji = journal.emotion_emoji || emotionEmoji[dominantEmotion] || '😐';
  const moodScore = journal.emotion_summary?.mood_score || 50;
  const emotionCounts = journal.emotion_summary?.emotion_counts || {};
  const timeSegments = journal.emotion_summary?.time_segments || [];

  return (
    <div className="space-y-6">
      {/* Back Button */}
      {onBack && (
        <Button
          variant="ghost"
          onClick={onBack}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Journals
        </Button>
      )}

      {/* Main Journal Card */}
      <Card className="p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 pb-6 border-b">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-full bg-primary/10">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Daily Journal</h1>
              <div className="flex items-center gap-2 text-muted-foreground mt-1">
                <Calendar className="h-4 w-4" />
                <span className="text-sm">{formatDate(journal.date)}</span>
              </div>
            </div>
          </div>

          <div className="text-right">
            <div className="text-4xl mb-2">
              {displayEmoji}
            </div>
            <p className="text-sm font-medium capitalize">
              {dominantEmotion}
            </p>
          </div>
        </div>

        {/* Mood Score */}
        {moodScore > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Heart className="h-5 w-5 text-pink-500" />
                Mood Score
              </h3>
              <span className="text-3xl font-bold">{moodScore.toFixed(1)}/100</span>
            </div>

            <div className="w-full h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full bg-gradient-to-r transition-all duration-500',
                  getMoodGradient(moodScore)
                )}
                style={{ width: `${moodScore}%` }}
              />
            </div>
          </div>
        )}

        {/* Journal Content - MAIN DISPLAY */}
        <div className="mb-8">
          <div className="prose dark:prose-invert max-w-none text-base leading-[1.8] tracking-normal [&>strong]:font-bold [&>strong]:text-foreground [&>p]:mb-4 [&>ul]:list-disc [&>ul]:pl-5 [&>ul]:mb-4 [&>li]:mb-2">
            <ReactMarkdown 
              remarkPlugins={[remarkGfm, remarkBreaks]}
              components={{
                p: ({node, ...props}) => <p style={{ lineHeight: '1.8' }} {...props} />
              }}
            >
              {journal.content}
            </ReactMarkdown>
          </div>
        </div>

        {/* Time Progression */}
        {timeSegments && timeSegments.length > 0 && (
          <div className="mb-8">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-500" />
              Emotional Journey
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {timeSegments.map((segment: any, index: number) => (
                <Card key={index} className="p-4 bg-accent/30">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground uppercase mb-2">
                      {segment.period}
                    </p>
                    <div className="text-3xl mb-2">
                      {emotionEmoji[segment.emotion] || '😐'}
                    </div>
                    <p className="font-medium capitalize">{segment.emotion}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {segment.count} {segment.count === 1 ? 'moment' : 'moments'}
                    </p>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Emotion Summary */}
      {Object.keys(emotionCounts).length > 0 && (
        <JournalEmotionSummary
          emotionCounts={emotionCounts}
          dominantEmotion={dominantEmotion}
        />
      )}
    </div>
  );
}
