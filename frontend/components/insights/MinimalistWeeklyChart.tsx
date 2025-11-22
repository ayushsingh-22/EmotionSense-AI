/**
 * MinimalistWeeklyChart - Clean, elegant chart for weekly emotional trends
 * Simplified UI with single unified view, minimal visual noise
 */

'use client';

import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { format, parseISO } from 'date-fns';
import { getEmotionConfig, getEmotionEmoji } from './emotionConfig';
import { ChartErrorBoundary } from './ChartErrorBoundary';
import type { DayPoint } from '@/lib/insightsApi';

interface MinimalistWeeklyChartProps {
  dailyArc: DayPoint[];
  weekStart?: string;
  weekEnd?: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: DayPoint & { dayName: string };
  }>;
}

interface CustomDotProps {
  cx?: number;
  cy?: number;
  payload?: DayPoint & { dayName: string };
}

const MinimalistDot = ({ cx, cy, payload }: CustomDotProps) => {
  if (!cx || !cy || !payload || !payload.has_data) return null;
  
  return (
    <circle
      cx={cx}
      cy={cy}
      r={4}
      fill="hsl(var(--primary))"
      stroke="hsl(var(--background))"
      strokeWidth={2}
      className="transition-all duration-200 hover:r-6"
    />
  );
};

const MinimalistTooltip = ({ active, payload }: CustomTooltipProps) => {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0].payload;
  
  if (!data.has_data) {
    return (
      <div className="bg-background border border-border rounded-lg px-3 py-2 shadow-lg">
        <p className="text-xs font-medium text-muted-foreground">
          {format(parseISO(data.date), 'EEE, MMM d')}
        </p>
        <p className="text-xs text-muted-foreground mt-1">No data</p>
      </div>
    );
  }

  const config = getEmotionConfig(data.emotion);
  const emoji = getEmotionEmoji(data.emotion);
  
  return (
    <div className="bg-background border border-border rounded-lg px-3 py-2.5 shadow-lg">
      <p className="text-xs font-medium text-foreground mb-1.5">
        {format(parseISO(data.date), 'EEEE, MMM d')}
      </p>
      <div className="flex items-center gap-2">
        <span className="text-xl">{emoji}</span>
        <div>
          <p className="text-xs text-muted-foreground capitalize">{data.emotion}</p>
          <p className="text-sm font-semibold" style={{ color: config.primary }}>
            {Math.round(data.mood_score || 0)}/100
          </p>
        </div>
      </div>
    </div>
  );
};

export const MinimalistWeeklyChart = React.memo(({ dailyArc, weekStart, weekEnd }: MinimalistWeeklyChartProps) => {
  if (!dailyArc || dailyArc.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        No data available for this week
      </div>
    );
  }

  // Prepare chart data
  const chartData = dailyArc
    .filter(day => day && day.date)
    .map((day) => {
      try {
        return {
          ...day,
          dayName: format(parseISO(day.date), 'EEE'),
          displayMoodScore: day.has_data && typeof day.mood_score === 'number' ? day.mood_score : null,
        };
      } catch (error) {
        console.warn('Invalid day data:', day, error);
        return null;
      }
    })
    .filter((day): day is NonNullable<typeof day> => day !== null);

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        Invalid data for this week
      </div>
    );
  }

  // Calculate average mood for reference line
  const validScores = chartData
    .filter(day => day.has_data && day.mood_score !== null)
    .map(day => day.mood_score!);
  const avgMood = validScores.length > 0 
    ? Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length)
    : 50;

  // Check if there are any valid mood scores to display
  const hasValidData = validScores.length > 0;

  return (
    <ChartErrorBoundary>
      <div className="space-y-4">
        {/* Chart Header */}
        {(weekStart || weekEnd) && (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Mood Trend</span>
            <span>
              {weekStart && weekEnd && 
                `${format(parseISO(weekStart), 'MMM d')} - ${format(parseISO(weekEnd), 'MMM d')}`
              }
            </span>
          </div>
        )}

        {/* Line Chart */}
        <div className="rounded-lg border border-border bg-card/50 p-4">
          {!hasValidData ? (
            <div className="flex flex-col items-center justify-center h-60 text-center">
              <div className="text-6xl mb-4">📊</div>
              <h3 className="text-sm font-medium text-foreground mb-2">No mood data yet</h3>
              <p className="text-xs text-muted-foreground max-w-sm">
                Your emotional journey will appear here once you start chatting with the AI.
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
            <LineChart 
              data={chartData} 
              margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
            >
              <defs>
                <linearGradient id="minimalistGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.1}/>
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                </linearGradient>
              </defs>
              
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke="hsl(var(--border))" 
                opacity={0.5}
                vertical={false}
              />
              
              <XAxis 
                dataKey="dayName" 
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                dy={8}
              />
              
              <YAxis 
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                domain={[0, 100]}
                ticks={[0, 25, 50, 75, 100]}
              />
              
              {/* Average mood reference line */}
              {validScores.length > 0 && (
                <ReferenceLine 
                  y={avgMood} 
                  stroke="hsl(var(--muted-foreground))" 
                  strokeDasharray="5 5"
                  strokeOpacity={0.4}
                  label={{ 
                    value: `Avg: ${avgMood}`, 
                    position: 'right',
                    fill: 'hsl(var(--muted-foreground))',
                    fontSize: 10,
                  }}
                />
              )}
              
              <Tooltip content={<MinimalistTooltip />} cursor={{ stroke: 'hsl(var(--border))' }} />
              
              <Line 
                type="monotone" 
                dataKey="displayMoodScore" 
                stroke="hsl(var(--primary))"
                strokeWidth={3}
                dot={<MinimalistDot />}
                activeDot={{ r: 6, strokeWidth: 2, fill: "hsl(var(--primary))" }}
                connectNulls={true}
                fill="url(#minimalistGradient)"
              />
            </LineChart>
          </ResponsiveContainer>
          )}
        </div>

        {/* Daily Summary Strip */}
        <div className="grid grid-cols-7 gap-1.5">
          {chartData.map((day, idx) => {
            const config = getEmotionConfig(day.emotion);
            const emoji = getEmotionEmoji(day.emotion);
            
            return (
              <div
                key={idx}
                className="group flex flex-col items-center gap-1 p-2 rounded-md hover:bg-accent/50 transition-colors cursor-default"
              >
                <span className="text-[10px] font-medium text-muted-foreground uppercase">
                  {format(parseISO(day.date), 'EEE')}
                </span>
                
                {day.has_data ? (
                  <>
                    <span className="text-lg group-hover:scale-110 transition-transform">
                      {emoji}
                    </span>
                    <span 
                      className="text-xs font-semibold"
                      style={{ color: config.primary }}
                    >
                      {Math.round(day.mood_score!)}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-lg text-muted-foreground/30">—</span>
                    <span className="text-xs text-muted-foreground/50">N/A</span>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </ChartErrorBoundary>
  );
});

MinimalistWeeklyChart.displayName = 'MinimalistWeeklyChart';
