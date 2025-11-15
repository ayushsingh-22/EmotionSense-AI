/**
 * WeeklyArcChart - Interactive chart for weekly emotional journey
 */

'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { format, parseISO } from 'date-fns';
import { getEmotionConfig, getEmotionEmoji } from './emotionConfig';
import type { DayPoint } from '@/lib/insightsApi';

interface WeeklyArcChartProps {
  dailyArc: DayPoint[];
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: DayPoint & { dayName: string; color: string };
  }>;
}

const CustomTooltip = ({ active, payload }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const config = getEmotionConfig(data.emotion);
    const emoji = getEmotionEmoji(data.emotion);
    
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`bg-background/95 backdrop-blur-sm border-2 ${config.border} rounded-xl p-3 shadow-xl`}
      >
        <p className="text-sm font-semibold mb-1">
          {format(parseISO(data.date), 'EEEE, MMM d')}
        </p>
        <div className="flex items-center gap-2">
          <span className="text-2xl">{emoji}</span>
          <div>
            <p className="text-xs text-muted-foreground capitalize">{data.emotion}</p>
            <p className={`text-lg font-bold ${config.text}`}>
              {Math.round(data.mood_score)}/100
            </p>
          </div>
        </div>
      </motion.div>
    );
  }
  return null;
};

export const WeeklyArcChart = React.memo(({ dailyArc }: WeeklyArcChartProps) => {
  if (!dailyArc || dailyArc.length === 0) {
    return null;
  }

  const chartData = dailyArc.map((day) => ({
    ...day,
    dayName: format(parseISO(day.date), 'EEE'),
    color: getEmotionConfig(day.emotion).primary,
  }));

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
        Weekly Emotional Arc
      </h4>

      {/* Line Chart - Mood Score Trend */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-gradient-to-br from-background/50 to-background/30 backdrop-blur-sm rounded-2xl p-4 border border-border/50 shadow-lg"
      >
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData}>
            <defs>
              <linearGradient id="moodGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
            <XAxis 
              dataKey="dayName" 
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickLine={false}
            />
            <YAxis 
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickLine={false}
              domain={[0, 100]}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line 
              type="monotone" 
              dataKey="mood_score" 
              stroke="hsl(var(--primary))"
              strokeWidth={3}
              dot={{ r: 6, fill: "hsl(var(--primary))", strokeWidth: 2, stroke: "#fff" }}
              activeDot={{ r: 8, strokeWidth: 3 }}
              fill="url(#moodGradient)"
            />
          </LineChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Bar Chart - Daily Emotions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="bg-gradient-to-br from-background/50 to-background/30 backdrop-blur-sm rounded-2xl p-4 border border-border/50 shadow-lg"
      >
        <ResponsiveContainer width="100%" height={150}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
            <XAxis 
              dataKey="dayName" 
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickLine={false}
            />
            <YAxis 
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickLine={false}
              domain={[0, 100]}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar 
              dataKey="mood_score" 
              radius={[8, 8, 0, 0]}
              maxBarSize={50}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} opacity={0.8} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Daily Emotion Cards */}
      <div className="grid grid-cols-7 gap-2">
        {dailyArc.map((day, idx) => {
          const config = getEmotionConfig(day.emotion);
          const emoji = getEmotionEmoji(day.emotion);
          
          return (
            <motion.div
              key={idx}
              className="text-center"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.05, duration: 0.3 }}
              whileHover={{ scale: 1.05, y: -2 }}
            >
              <div className="text-xs font-medium text-muted-foreground mb-1.5">
                {format(parseISO(day.date), 'EEE')}
              </div>
              <motion.div
                className={`p-3 rounded-xl bg-gradient-to-br ${config.gradient} backdrop-blur-sm border ${config.border} shadow-lg ${config.glow} cursor-pointer`}
                whileHover={{ 
                  boxShadow: `0 8px 20px ${config.primary}40`,
                }}
              >
                <div className="text-2xl text-white drop-shadow-lg">
                  {emoji}
                </div>
              </motion.div>
              <div className={`text-xs font-bold mt-1.5 ${config.text}`}>
                {Math.round(day.mood_score)}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
});

WeeklyArcChart.displayName = 'WeeklyArcChart';
