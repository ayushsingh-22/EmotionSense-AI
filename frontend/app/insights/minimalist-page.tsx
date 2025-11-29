'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, TrendingUp, Activity } from 'lucide-react';
import { 
  getDailyInsights, 
  getWeeklyInsights, 
  getUserStats,
  type DailyInsight,
  type WeeklyInsight,
  type UserStats
} from '@/lib/insightsApi';
import { format, parseISO } from 'date-fns';
import { MinimalistWeeklyChart } from '@/components/insights/MinimalistWeeklyChart';
import { getEmotionEmoji } from '@/components/insights/emotionConfig';

export default function MinimalistInsightsPage() {
  const { user } = useAuth();
  const [dailyInsights, setDailyInsights] = useState<DailyInsight[]>([]);
  const [weeklyInsights, setWeeklyInsights] = useState<WeeklyInsight[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    if (!user?.id) return;
    
    setIsLoading(true);
    try {
      const [daily, weekly, userStats] = await Promise.all([
        getDailyInsights(user.id),
        getWeeklyInsights(user.id, 4),
        getUserStats(user.id)
      ]);

      setDailyInsights(daily);
      setWeeklyInsights(weekly);
      setStats(userStats);
    } catch (error) {
      console.error('Error loading insights:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Please sign in to view your insights.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl space-y-8">
      {/* Clean Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Insights</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your emotional journey at a glance
        </p>
      </div>

      {/* Minimal Stats */}
      {!isLoading && stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border border-border">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-primary/10">
                  <Calendar className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Tracked Days</p>
                  <p className="text-2xl font-bold">{stats.trackedDays || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-primary/10">
                  <Activity className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Emotions</p>
                  <p className="text-2xl font-bold">{stats.totalEmotions || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-primary/10">
                  <TrendingUp className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Since</p>
                  <p className="text-2xl font-bold">
                    {stats.firstChatDate 
                      ? format(parseISO(stats.firstChatDate), 'MMM d')
                      : '—'
                    }
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Today's Snapshot */}
      {!isLoading && dailyInsights.length > 0 && (
        <Card className="border border-border">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Today</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(() => {
              const today = dailyInsights[0];
              const emoji = getEmotionEmoji(today.emotion);
              
              return (
                <>
                  <div className="flex items-start gap-4">
                    <span className="text-4xl">{emoji}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-medium capitalize">{today.emotion}</p>
                        <span className="text-xs text-muted-foreground">
                          {today.emotion_summary.message_count} {today.emotion_summary.message_count === 1 ? 'message' : 'messages'}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {today.content || 'No journal entry yet'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Mood</p>
                      <p className="text-2xl font-bold text-primary">
                        {today.emotion_summary.mood_score}
                      </p>
                    </div>
                  </div>

                  {/* Time Segments */}
                  {today.emotion_summary.time_segments && today.emotion_summary.time_segments.length > 0 && (
                    <div className="grid grid-cols-3 gap-3 pt-3 border-t border-border">
                      {today.emotion_summary.time_segments.map((segment) => {
                        const segmentEmoji = getEmotionEmoji(segment.emotion);
                        return (
                          <div key={segment.period} className="text-center">
                            <p className="text-[10px] uppercase text-muted-foreground mb-1">
                              {segment.period}
                            </p>
                            <p className="text-2xl">{segmentEmoji}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {segment.count} {segment.count === 1 ? 'moment' : 'moments'}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {/* Weekly Trends */}
      {!isLoading && weeklyInsights.map((week, idx) => (
        <Card key={idx} className="border border-border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold">
                {idx === 0 ? 'This Week' : `${idx === 1 ? 'Last Week' : format(parseISO(week.week_start), 'MMM d')} - ${format(parseISO(week.week_end), 'MMM d')}`}
              </CardTitle>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Avg Mood</p>
                <p className="text-xl font-bold text-primary">{week.avg_mood_score}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Reflection Text */}
            {week.reflection_text && (
              <div className="bg-muted/30 rounded-lg p-4 border-l-4 border-primary">
                <p className="text-sm text-foreground/90 italic">
                  &quot;{week.reflection_text}&quot;
                </p>
              </div>
            )}

            {/* Weekly Chart */}
            <MinimalistWeeklyChart 
              dailyArc={week.daily_arc}
              weekStart={week.week_start}
              weekEnd={week.week_end}
            />

            {/* Week Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-border">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Peak Day</p>
                <p className="text-sm font-medium">
                  {week.peak_mood_day?.has_data 
                    ? format(parseISO(week.peak_mood_day.date), 'EEE')
                    : '—'
                  }
                </p>
                {week.peak_mood_day?.mood_score !== null && week.peak_mood_day?.has_data && (
                  <p className="text-xs text-primary font-semibold">
                    {Math.round(week.peak_mood_day.mood_score)}
                  </p>
                )}
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">Low Day</p>
                <p className="text-sm font-medium">
                  {week.low_mood_day?.has_data 
                    ? format(parseISO(week.low_mood_day.date), 'EEE')
                    : '—'
                  }
                </p>
                {week.low_mood_day?.mood_score !== null && week.low_mood_day?.has_data && (
                  <p className="text-xs text-muted-foreground font-semibold">
                    {Math.round(week.low_mood_day.mood_score)}
                  </p>
                )}
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">Active Days</p>
                <p className="text-sm font-medium">{week.active_days}/7</p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">Stability</p>
                <p className="text-sm font-medium">
                  {week.mood_variance < 10 ? 'High' : week.mood_variance < 20 ? 'Medium' : 'Low'}
                </p>
                <p className="text-xs text-muted-foreground">±{week.mood_variance}</p>
              </div>
            </div>

            {/* Top Emotions */}
            {week.emotion_summary && Object.keys(week.emotion_summary).length > 0 && (
              <div className="pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground mb-3">Top Emotions</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(week.emotion_summary)
                    .sort(([,a], [,b]) => b - a)
                    .slice(0, 5)
                    .map(([emotion, count]) => {
                      const emoji = getEmotionEmoji(emotion);
                      return (
                        <div 
                          key={emotion}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/50 border border-border"
                        >
                          <span className="text-sm">{emoji}</span>
                          <span className="text-xs font-medium capitalize">{emotion}</span>
                          <span className="text-xs text-muted-foreground">×{count}</span>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center space-y-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="text-sm text-muted-foreground">Loading insights...</p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && dailyInsights.length === 0 && weeklyInsights.length === 0 && (
        <Card className="border border-border">
          <CardContent className="p-12 text-center">
            <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <p className="text-sm text-muted-foreground">
              No insights yet. Start chatting to track your emotions!
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
