'use client';

import React, { useState, useEffect } from 'react';
import { MinimalistWeeklyChart } from '@/components/insights/MinimalistWeeklyChart';
import { SimplifiedChart } from '@/components/debug/SimplifiedChart';

const REAL_USER_ID = '25bcb75e-8030-499b-a933-3d31a84982a5';

interface DayPoint {
  date: string;
  emotion: string;
  mood_score: number | null;
  activity_count: number;
  has_data: boolean;
}

interface WeeklyInsight {
  week_start: string;
  week_end: string;
  daily_arc: DayPoint[];
  avg_mood_score: number;
}

export default function LiveDataTest() {
  const [weeklyData, setWeeklyData] = useState<WeeklyInsight | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRealData = async () => {
      try {
        const response = await fetch(
          `http://localhost:8080/api/insights/weekly?userId=${REAL_USER_ID}&limit=1`
        );
        const data = await response.json();
        
        if (data.success && data.data.insights.length > 0) {
          setWeeklyData(data.data.insights[0]);
        } else {
          setError('No insights found');
        }
      } catch (err) {
        setError(`Failed to fetch data: ${err}`);
      } finally {
        setLoading(false);
      }
    };

    fetchRealData();
  }, []);

  if (loading) {
    return <div className="p-8">Loading real data...</div>;
  }

  if (error) {
    return <div className="p-8 text-red-600">Error: {error}</div>;
  }

  if (!weeklyData) {
    return <div className="p-8">No data available</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-4">Live Data Test - Real User</h1>
      
      <div className="space-y-8">
        <div className="border border-gray-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">MinimalistWeeklyChart - Real Data</h2>
          <p className="text-sm text-gray-600 mb-4">
            Week: {weeklyData.week_start} to {weeklyData.week_end} | 
            Avg Mood: {weeklyData.avg_mood_score}
          </p>
          <MinimalistWeeklyChart 
            dailyArc={weeklyData.daily_arc}
            weekStart={weeklyData.week_start}
            weekEnd={weeklyData.week_end}
          />
        </div>

        <div className="border border-gray-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">SimplifiedChart - Real Data</h2>
          <SimplifiedChart dailyArc={weeklyData.daily_arc} />
        </div>

        <div className="border border-gray-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Raw Data</h2>
          <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
            {JSON.stringify(weeklyData.daily_arc, null, 2)}
          </pre>
        </div>

        <div className="border border-gray-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Valid Data Points</h2>
          {weeklyData.daily_arc.filter(day => day.has_data && day.mood_score !== null).map(day => (
            <div key={day.date} className="mb-2">
              <strong>{day.date}</strong>: {day.emotion} (mood: {day.mood_score})
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}