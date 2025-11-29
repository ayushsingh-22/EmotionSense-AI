/**
 * WeeklyArcChart - Interactive chart for weekly emotional journey
 */

'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, parseISO } from 'date-fns';
import { getEmotionConfig, getEmotionEmoji } from './emotionConfig';
import { ChartErrorBoundary } from './ChartErrorBoundary';
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

interface CustomDotProps {
  cx?: number;
  cy?: number;
  payload?: DayPoint & { dayName: string; color: string; displayMoodScore: number };
}

const CustomDot = ({ cx, cy, payload }: CustomDotProps) => {
  if (!cx || !cy || !payload) return null;
  
  if (payload.has_data) {
    return (
      <circle
        cx={cx}
        cy={cy}
        r={6}
        fill="hsl(var(--primary))"
        strokeWidth={2}
        stroke="#fff"
      />
    );
  } else {
    return (
      <circle
        cx={cx}
        cy={cy}
        r={4}
        fill="#e5e7eb"
        strokeWidth={1}
        stroke="#9ca3af"
        strokeDasharray="3,3"
      />
    );
  }
};

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
              {data.mood_score !== null ? `${Math.round(data.mood_score)}/100` : 'No Data'}
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
    return (
      <div className="space-y-4">
        <h4 className="text-sm font-semibold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
          Weekly Emotional Arc
        </h4>
        <div className="bg-secondary/20 rounded-xl p-4 text-center text-muted-foreground">
          No data available for this week
        </div>
      </div>
    );
  }

  // Validate and sanitize the data
  const chartData = dailyArc
    .filter(day => day && day.date) // Filter out invalid entries
    .map((day) => {
      try {
        return {
          ...day,
          dayName: format(parseISO(day.date), 'EEE'),
          color: day.has_data ? getEmotionConfig(day.emotion).primary : '#e5e7eb',
          displayMoodScore: typeof day.mood_score === 'number' && !isNaN(day.mood_score) ? day.mood_score : 0,
        };
      } catch (error) {
        console.warn('Invalid day data:', day, error);
        return {
          ...day,
          dayName: 'Invalid',
          color: '#e5e7eb',
          displayMoodScore: 0,
        };
      }
    });

  // If no valid data after filtering, return empty state
  if (chartData.length === 0) {
    return (
      <div className="space-y-4">
        <h4 className="text-sm font-semibold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
          Weekly Emotional Arc
        </h4>
        <div className="bg-secondary/20 rounded-xl p-4 text-center text-muted-foreground">
          No valid data available for this week
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
        Weekly Emotional Arc
      </h4>

      {/* Line Chart - Mood Score Trend */}
      <ChartErrorBoundary>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-gradient-to-br from-background/50 to-background/30 backdrop-blur-sm rounded-2xl p-4 border border-border/50 shadow-lg"
        >
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
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
                axisLine={false}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                domain={[0, 100]}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line 
                type="monotone" 
                dataKey="displayMoodScore" 
                stroke="hsl(var(--primary))"
                strokeWidth={3}
                dot={<CustomDot />}
                activeDot={{ r: 8, strokeWidth: 3, fill: "hsl(var(--primary))" }}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>
      </ChartErrorBoundary>

      {/* Line Chart - Daily Emotions */}
      <ChartErrorBoundary>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="bg-gradient-to-br from-background/50 to-background/30 backdrop-blur-sm rounded-2xl p-4 border border-border/50 shadow-lg"
        >
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis 
                dataKey="dayName" 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                domain={[0, 100]}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="displayMoodScore" 
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ r: 4, fill: 'hsl(var(--primary))', strokeWidth: 2, stroke: '#fff' }}
                activeDot={{ r: 6, strokeWidth: 2 }}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>
      </ChartErrorBoundary>

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
                className={`p-3 rounded-xl bg-gradient-to-br ${
                  day.has_data ? config.gradient : 'from-gray-100 to-gray-200'
                } backdrop-blur-sm border ${
                  day.has_data ? config.border : 'border-gray-300'
                } shadow-lg ${day.has_data ? config.glow : ''} cursor-pointer ${
                  day.has_data ? '' : 'opacity-60'
                }`}
                whileHover={day.has_data ? { 
                  boxShadow: `0 8px 20px ${config.primary}40`,
                } : {}}
              >
                <div className={`text-2xl ${day.has_data ? 'text-white' : 'text-gray-400'} drop-shadow-lg`}>
                  {day.has_data ? emoji : '📊'}
                </div>
              </motion.div>
              <div className={`text-xs font-bold mt-1.5 ${
                day.has_data ? config.text : 'text-gray-500'
              }`}>
                {day.mood_score !== null ? Math.round(day.mood_score) : 'N/A'}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
});

WeeklyArcChart.displayName = 'WeeklyArcChart';
