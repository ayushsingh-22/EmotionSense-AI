'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { EMOTION_CONFIG, type EmotionType } from '@/types';
import { Activity, TrendingUp, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export function SessionStats() {
  const { user } = useAuth();
  const [totalAnalyses, setTotalAnalyses] = useState(0);
  const [topEmotion, setTopEmotion] = useState<{ name: string; count: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchLifetimeStats = async () => {
      if (!user) return;

      try {
        setIsLoading(true);

        // Fetch all user messages from messages table
        const { data: messages, error } = await supabase
          .from('messages')
          .select('emotion')
          .eq('user_id', user.id)
          .eq('role', 'user')
          .not('emotion', 'is', null);

        if (error) {
          console.error('Error fetching stats:', error);
          return;
        }

        setTotalAnalyses(messages?.length || 0);

        // Calculate emotion counts
        if (messages && messages.length > 0) {
          const emotionCounts: Record<string, number> = {};
          messages.forEach((msg) => {
            const emotion = msg.emotion;
            if (emotion) {
              emotionCounts[emotion] = (emotionCounts[emotion] || 0) + 1;
            }
          });

          const topEmotionEntry = Object.entries(emotionCounts).sort(([, a], [, b]) => b - a)[0];
          if (topEmotionEntry) {
            setTopEmotion({ name: topEmotionEntry[0], count: topEmotionEntry[1] });
          }
        }
      } catch (error) {
        console.error('Error calculating lifetime stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLifetimeStats();
  }, [user]);

  const topEmotionName = topEmotion?.name || 'neutral';
  const topEmotionConfig = EMOTION_CONFIG[topEmotionName as EmotionType] || {
    color: '#6B7280',
    emoji: '❓',
    bgColor: 'bg-gray-400',
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <div key={i} className="p-6 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse">
            <div className="h-8 bg-gray-300 dark:bg-gray-700 rounded w-1/3 mb-2"></div>
            <div className="h-6 bg-gray-300 dark:bg-gray-700 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Total Analyses */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="p-6 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-2 border-blue-200 dark:border-blue-800 shadow-lg hover:shadow-xl transition-all duration-300"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-2 flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Total Analyses (Lifetime)
            </p>
            <motion.p
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
              className="text-4xl font-bold text-blue-600 dark:text-blue-400"
            >
              {totalAnalyses}
            </motion.p>
          </div>
          <motion.div
            className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg"
            whileHover={{ rotate: 360, scale: 1.1 }}
            transition={{ duration: 0.6 }}
          >
            <Activity className="h-8 w-8 text-white" />
          </motion.div>
        </div>
      </motion.div>

      {/* Most Common Emotion */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="p-6 rounded-2xl bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 border-2 border-purple-200 dark:border-purple-800 shadow-lg hover:shadow-xl transition-all duration-300"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-purple-700 dark:text-purple-300 mb-2 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Most Common Emotion
            </p>
            <div className="flex items-center gap-3 mt-2">
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, delay: 0.3 }}
                className="text-4xl"
              >
                {topEmotionConfig.emoji}
              </motion.span>
              <motion.p
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="text-3xl font-bold capitalize"
                style={{ color: topEmotionConfig.color }}
              >
                {topEmotionName}
              </motion.p>
            </div>
            {topEmotion && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-xs text-purple-600 dark:text-purple-400 mt-2"
              >
                {topEmotion.count} occurrences
              </motion.p>
            )}
          </div>
          <motion.div
            className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg"
            style={{ backgroundColor: topEmotionConfig.color }}
            whileHover={{ rotate: 360, scale: 1.1 }}
            transition={{ duration: 0.6 }}
          >
            <Sparkles className="h-8 w-8 text-white" />
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
