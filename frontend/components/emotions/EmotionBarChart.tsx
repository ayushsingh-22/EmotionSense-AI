'use client';

import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { EMOTION_CONFIG, type EmotionType } from '@/types';

interface EmotionBarChartProps {
  emotionScores: Record<string, number>;
}

export function EmotionBarChart({ emotionScores }: EmotionBarChartProps) {
  const data = Object.entries(emotionScores)
    .map(([emotion, score]) => {
      // Get config for the emotion, with fallback for unknown emotions
      const config = EMOTION_CONFIG[emotion as EmotionType] || { 
        color: '#6B7280', 
        emoji: '❓', 
        bgColor: 'bg-gray-400' 
      };
      
      return {
        emotion,
        score: Math.round(score * 100),
        color: config.color,
      };
    })
    .sort((a, b) => b.score - a.score);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
    >
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Emotion Distribution</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} layout="vertical" margin={{ left: 60, right: 30 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis type="number" domain={[0, 100]} />
            <YAxis
              type="category"
              dataKey="emotion"
              tick={{ fontSize: 12 }}
              className="capitalize"
            />
            <Tooltip
              formatter={(value: number) => `${value}%`}
              contentStyle={{
                backgroundColor: 'hsl(var(--background))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
            />
            <Bar dataKey="score" radius={[0, 8, 8, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </motion.div>
  );
}
