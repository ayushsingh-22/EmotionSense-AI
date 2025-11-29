'use client';

import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
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
          <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
            <defs>
              <linearGradient id="emotionGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey="emotion" 
              tick={{ fontSize: 12 }}
              className="capitalize"
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
            <Tooltip
              formatter={(value: number) => `${value}%`}
              contentStyle={{
                backgroundColor: 'hsl(var(--background))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
            />
            <Line 
              type="monotone"
              dataKey="score" 
              stroke="hsl(var(--primary))"
              strokeWidth={3}
              dot={{ r: 5, fill: 'hsl(var(--primary))', strokeWidth: 2, stroke: '#fff' }}
              activeDot={{ r: 7, strokeWidth: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </Card>
    </motion.div>
  );
}
