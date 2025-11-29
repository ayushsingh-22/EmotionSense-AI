'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, TrendingUp, Filter } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { EMOTION_CONFIG } from '@/types';
import { supabase } from '@/lib/supabase';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { subDays, format } from 'date-fns';

interface EmotionStats {
  emotion: string;
  count: number;
  percentage: number;
  avgConfidence: number;
}

interface AnalyticsData {
  totalSessions: number;
  averageConfidence: number;
  mostFrequentEmotion: string;
  emotionBreakdown: EmotionStats[];
  timelineData: Array<{
    date: string;
    count: number;
    avgConfidence: number;
    dominantEmotion: string;
  }>;
  dateRange: {
    start: Date | null;
    end: Date;
  };
}

type FilterType = 'lifetime' | '30days' | '7days' | 'custom' | 'emotion';

interface EmotionAnalyticsProps {
  userId: string;
}

export function EmotionAnalytics({ userId }: EmotionAnalyticsProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [filterType, setFilterType] = useState<FilterType>('lifetime');
  const [selectedEmotion, setSelectedEmotion] = useState<string>('all');

  const fetchAnalytics = useCallback(async () => {
    if (!userId) return;

    try {
      setIsLoading(true);

      let query = supabase
        .from('messages')
        .select('*')
        .eq('user_id', userId)
        .eq('role', 'user')
        .not('emotion', 'is', null)
        .order('created_at', { ascending: false });

      // Apply date filters
      const now = new Date();
      if (filterType === '7days') {
        const sevenDaysAgo = subDays(now, 7);
        query = query.gte('created_at', sevenDaysAgo.toISOString());
      } else if (filterType === '30days') {
        const thirtyDaysAgo = subDays(now, 30);
        query = query.gte('created_at', thirtyDaysAgo.toISOString());
      }

      // Apply emotion filter
      if (filterType === 'emotion' && selectedEmotion !== 'all') {
        query = query.eq('emotion', selectedEmotion);
      }

      const { data: messages, error } = await query;

      if (error) {
        console.error('Error fetching analytics:', error);
        return;
      }

      if (!messages || messages.length === 0) {
        setData({
          totalSessions: 0,
          averageConfidence: 0,
          mostFrequentEmotion: 'neutral',
          emotionBreakdown: [],
          timelineData: [],
          dateRange: {
            start: null,
            end: now,
          },
        });
        return;
      }

      // Group messages by date for timeline
      const messagesByDate: Record<string, typeof messages> = {};
      messages.forEach((msg) => {
        const dateKey = format(new Date(msg.created_at), 'yyyy-MM-dd');
        if (!messagesByDate[dateKey]) {
          messagesByDate[dateKey] = [];
        }
        messagesByDate[dateKey].push(msg);
      });

      // Create timeline data
      const timelineData = Object.entries(messagesByDate)
        .map(([date, msgs]) => {
          const emotionCounts: { [key: string]: number } = {};
          let totalConfidence = 0;

          msgs.forEach((msg) => {
            const emotion = msg.emotion;
            emotionCounts[emotion] = (emotionCounts[emotion] || 0) + 1;
            totalConfidence += msg.emotion_confidence || 0;
          });

          const dominantEmotion = Object.entries(emotionCounts).sort(([, a], [, b]) => b - a)[0]?.[0] || 'neutral';

          return {
            date,
            count: msgs.length,
            avgConfidence: totalConfidence / msgs.length,
            dominantEmotion,
          };
        })
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // Calculate emotion breakdown
      const emotionCounts: { [key: string]: { count: number; totalConfidence: number } } = {};
      messages.forEach((msg) => {
        const emotion = msg.emotion;
        if (!emotionCounts[emotion]) {
          emotionCounts[emotion] = { count: 0, totalConfidence: 0 };
        }
        emotionCounts[emotion].count++;
        emotionCounts[emotion].totalConfidence += msg.emotion_confidence || 0;
      });

      const emotionBreakdown: EmotionStats[] = Object.entries(emotionCounts)
        .map(([emotion, data]) => ({
          emotion,
          count: data.count,
          percentage: (data.count / messages.length) * 100,
          avgConfidence: data.totalConfidence / data.count,
        }))
        .sort((a, b) => b.count - a.count);

      const averageConfidence =
        messages.reduce((sum, msg) => sum + (msg.emotion_confidence || 0), 0) / messages.length;

      const firstMessageDate = messages.length > 0 ? new Date(messages[messages.length - 1].created_at) : null;

      setData({
        totalSessions: messages.length,
        averageConfidence,
        mostFrequentEmotion: emotionBreakdown[0]?.emotion || 'neutral',
        emotionBreakdown,
        timelineData,
        dateRange: {
          start: firstMessageDate,
          end: now,
        },
      });
    } catch (error) {
      console.error('Error calculating analytics:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userId, filterType, selectedEmotion]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const getEmotionColor = (emotion: string) => {
    return EMOTION_CONFIG[emotion as keyof typeof EMOTION_CONFIG]?.color || '#666';
  };

  const getEmotionEmoji = (emotion: string) => {
    return EMOTION_CONFIG[emotion as keyof typeof EMOTION_CONFIG]?.emoji || '😐';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      {/* Filter Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 p-4 rounded-2xl border-2 border-blue-200 dark:border-blue-800">
        <div className="flex items-center gap-2">
          <Filter className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <span className="font-semibold text-blue-800 dark:text-blue-200">Filter Analytics</span>
        </div>
        <div className="flex flex-wrap gap-3">
          <Select value={filterType} onValueChange={(value) => setFilterType(value as FilterType)}>
            <SelectTrigger className="w-[180px] border-2 rounded-xl">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="lifetime">Lifetime</SelectItem>
              <SelectItem value="30days">Last 30 Days</SelectItem>
              <SelectItem value="7days">Last 7 Days</SelectItem>
              <SelectItem value="emotion">By Emotion</SelectItem>
            </SelectContent>
          </Select>

          {filterType === 'emotion' && (
            <Select value={selectedEmotion} onValueChange={setSelectedEmotion}>
              <SelectTrigger className="w-[150px] border-2 rounded-xl">
                <SelectValue placeholder="All emotions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Emotions</SelectItem>
                <SelectItem value="joy">😀 Joy</SelectItem>
                <SelectItem value="sadness">😭 Sadness</SelectItem>
                <SelectItem value="anger">🤬 Anger</SelectItem>
                <SelectItem value="fear">😨 Fear</SelectItem>
                <SelectItem value="neutral">😐 Neutral</SelectItem>
                <SelectItem value="surprise">😲 Surprise</SelectItem>
                <SelectItem value="disgust">🤢 Disgust</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <motion.div
            className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 mb-4"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          >
            <BarChart3 className="h-8 w-8 text-white" />
          </motion.div>
          <p className="text-muted-foreground">Loading analytics...</p>
        </div>
      ) : !data || data.totalSessions === 0 ? (
        <div className="text-center py-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 mb-4">
            <BarChart3 className="h-8 w-8 text-gray-500 dark:text-gray-400" />
          </div>
          <p className="text-lg font-medium text-muted-foreground mb-2">No emotion data yet</p>
          <p className="text-sm text-muted-foreground">
            Start using the app to see your emotional journey analytics
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Overview Stats */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-4"
          >
            <div className="text-center p-6 rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/30 border-2 border-blue-200 dark:border-blue-800 shadow-lg">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
                className="text-4xl font-bold text-blue-600 dark:text-blue-400 mb-2"
              >
                {data.totalSessions}
              </motion.div>
              <div className="text-sm text-blue-700 dark:text-blue-300 font-medium">Total Analyses</div>
            </div>

            <div className="text-center p-6 rounded-2xl bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/30 dark:to-purple-900/30 border-2 border-purple-200 dark:border-purple-800 shadow-lg">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, delay: 0.3 }}
                className="text-4xl font-bold text-purple-600 dark:text-purple-400 mb-2"
              >
                {Math.round(data.averageConfidence * 100)}%
              </motion.div>
              <div className="text-sm text-purple-700 dark:text-purple-300 font-medium">Avg Confidence</div>
            </div>

            <div className="text-center p-6 rounded-2xl bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/30 dark:to-green-900/30 border-2 border-green-200 dark:border-green-800 shadow-lg">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, delay: 0.4 }}
                className="text-4xl mb-2"
              >
                {getEmotionEmoji(data.mostFrequentEmotion)}
              </motion.div>
              <div className="text-sm text-green-700 dark:text-green-300 font-medium capitalize">
                {data.mostFrequentEmotion}
              </div>
            </div>
          </motion.div>

          {/* Timeline Chart - Emotion Analysis Over Time */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="bg-gradient-to-br from-background/50 to-background/30 backdrop-blur-sm rounded-2xl p-6 border-2 border-gray-200 dark:border-gray-700 shadow-lg"
          >
            <h4 className="text-lg font-semibold mb-6 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Emotion Analysis Timeline
              </span>
            </h4>
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={data.timelineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis
                  dataKey="date"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickLine={false}
                  tickFormatter={(value) => format(new Date(value), 'MMM d')}
                />
                <YAxis
                  yAxisId="left"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickLine={false}
                  label={{ value: 'Messages', angle: -90, position: 'insideLeft', style: { fontSize: 12 } }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="#10b981"
                  fontSize={12}
                  tickLine={false}
                  domain={[0, 1]}
                  tickFormatter={(value) => `${Math.round(value * 100)}%`}
                  label={{ value: 'Confidence', angle: 90, position: 'insideRight', style: { fontSize: 12 } }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(17, 24, 39, 0.95)',
                    border: 'none',
                    borderRadius: '12px',
                    color: '#fff',
                  }}
                  labelFormatter={(value) => format(new Date(value as string), 'MMMM d, yyyy')}
                  formatter={(value: number | string, name: string) => {
                    if (name === 'avgConfidence') {
                      return [`${Math.round((value as number) * 100)}%`, 'Avg Confidence'];
                    }
                    return [value, 'Messages'];
                  }}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="count"
                  stroke="hsl(var(--primary))"
                  strokeWidth={3}
                  dot={{ r: 4, fill: 'hsl(var(--primary))', strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 6, strokeWidth: 3 }}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="avgConfidence"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 5, strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Emotion Breakdown List */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 rounded-2xl p-6 border-2 border-gray-200 dark:border-gray-700 shadow-lg"
          >
            <h4 className="text-lg font-semibold mb-4 text-gray-800 dark:text-white">Emotion Breakdown</h4>
            <div className="space-y-3">
              {data.emotionBreakdown.map((emotion, index) => (
                <motion.div
                  key={emotion.emotion}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 + index * 0.1 }}
                  className="flex items-center justify-between p-4 bg-white dark:bg-gray-900 rounded-xl shadow-sm border-2 border-gray-100 dark:border-gray-700 hover:shadow-md hover:scale-[1.02] transition-all duration-200"
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-3xl">{getEmotionEmoji(emotion.emotion)}</span>
                    <span className="capitalize font-medium text-gray-800 dark:text-gray-200">
                      {emotion.emotion}
                    </span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                      {emotion.count} sessions
                    </div>
                    <Badge
                      className="px-3 py-1 font-semibold text-gray-900 dark:text-white"
                      style={{
                        backgroundColor: getEmotionColor(emotion.emotion) + '20',
                        border: `1px solid ${getEmotionColor(emotion.emotion)}40`,
                      }}
                    >
                      {Math.round(emotion.percentage)}%
                    </Badge>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
