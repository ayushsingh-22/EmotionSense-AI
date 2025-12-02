/**
 * WeeklyMoodJourney - Premium 30-day mood timeline graph
 * Shows mood scores over time with gradient fills and peak/low badges
 */

'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { format, parseISO } from 'date-fns';
import { TrendingUp, TrendingDown } from 'lucide-react';
import type { WeeklyInsight } from '@/lib/insightsApi';

interface WeeklyMoodJourneyProps {
  weeklyInsights: WeeklyInsight[];
}

interface DataPoint {
  date: string;
  moodScore: number; // Always a number, null converted to 0
  emotion: string;
  hasData: boolean;
}

export const WeeklyMoodJourney = React.memo(({ weeklyInsights }: WeeklyMoodJourneyProps) => {
  // Aggregate all daily_arc data from weekly insights to create 30-day timeline
  const timelineData = useMemo(() => {
    const dataMap = new Map<string, DataPoint>();
    
    weeklyInsights.forEach((week) => {
      week.daily_arc?.forEach((day) => {
        if (!dataMap.has(day.date)) {
          // Convert null mood scores to 0 for visualization
          dataMap.set(day.date, {
            date: day.date,
            moodScore: day.mood_score ?? 0, // Use 0 instead of null
            emotion: day.emotion,
            hasData: day.has_data
          });
        }
      });
    });
    
    // Convert to array and sort by date
    return Array.from(dataMap.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30); // Last 30 days
  }, [weeklyInsights]);

  // Find peak and low mood days (only from days with actual data)
  const { peakDay, lowDay } = useMemo(() => {
    const validDays = timelineData.filter(d => d.hasData && d.moodScore > 0);
    
    if (validDays.length === 0) {
      return { peakDay: null, lowDay: null };
    }
    
    const peak = validDays.reduce((max, day) => 
      (day.moodScore || 0) > (max.moodScore || 0) ? day : max
    );
    
    const low = validDays.reduce((min, day) => 
      (day.moodScore || 100) < (min.moodScore || 100) ? day : min
    );
    
    return { peakDay: peak, lowDay: low };
  }, [timelineData]);

  // Generate SVG path for the mood line (include all points, even 0)
  const { linePath, areaPath, validPoints } = useMemo(() => {
    const width = 100;
    const height = 100;
    const padding = 10;
    
    // Include ALL data points (even those with 0 mood score)
    const allData = timelineData;
    
    if (allData.length === 0) {
      return { linePath: '', areaPath: '', validPoints: [] };
    }
    
    const xScale = (index: number) => 
      padding + ((index / (allData.length - 1 || 1)) * (width - 2 * padding));
    
    const yScale = (score: number) => 
      height - padding - ((score / 100) * (height - 2 * padding));
    
    const points = allData.map((d, i) => ({
      x: xScale(i),
      y: yScale(d.moodScore), // Will use 0 for days without data
      data: d
    }));
    
    const line = points.map((p, i) => 
      i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`
    ).join(' ');
    
    const area = `${line} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;
    
    return { linePath: line, areaPath: area, validPoints: points };
  }, [timelineData]);

  if (timelineData.length === 0) {
    return null;
  }

  return (
    <motion.div
      className="space-y-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
          Your Mood Journey - Last 30 Days
        </h3>
        <div className="flex items-center gap-4">
          {peakDay && (
            <motion.div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/30"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
            >
              <TrendingUp className="h-3.5 w-3.5 text-green-600" />
              <span className="text-xs font-semibold text-green-700">Peak: {peakDay.moodScore}</span>
            </motion.div>
          )}
          {lowDay && (
            <motion.div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-orange-500/10 to-amber-500/10 border border-orange-500/30"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
            >
              <TrendingDown className="h-3.5 w-3.5 text-orange-600" />
              <span className="text-xs font-semibold text-orange-700">Low: {lowDay.moodScore}</span>
            </motion.div>
          )}
        </div>
      </div>

     
    </motion.div>
  );
});

WeeklyMoodJourney.displayName = 'WeeklyMoodJourney';
