'use client';

import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, parseISO } from 'date-fns';

interface SimplifiedChartProps {
  dailyArc: Array<{
    date: string;
    emotion: string;
    mood_score: number | null;
    activity_count: number;
    has_data: boolean;
  }>;
}

export const SimplifiedChart = ({ dailyArc }: SimplifiedChartProps) => {
  console.log('SimplifiedChart rendered with data:', dailyArc);

  if (!dailyArc || dailyArc.length === 0) {
    console.log('No data provided to chart');
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
        No data available
      </div>
    );
  }

  // Prepare chart data
  const chartData = dailyArc.map((day) => {
    try {
      return {
        ...day,
        dayName: format(parseISO(day.date), 'EEE'),
        displayMoodScore: day.has_data && typeof day.mood_score === 'number' ? day.mood_score : null,
      };
    } catch (error) {
      console.error('Error formatting day data:', day, error);
      return null;
    }
  }).filter(Boolean);

  console.log('Chart data prepared:', chartData);

  return (
    <div className="w-full h-96 bg-blue-50 border-2 border-blue-200 p-4">
      <h3 className="text-lg font-semibold mb-2">Simplified Chart Debug</h3>
      <p className="text-sm text-gray-600 mb-4">
        Data points: {chartData.length}, Valid scores: {chartData.filter(d => d.displayMoodScore !== null).length}
      </p>
      
      <div className="w-full h-64 bg-white border border-gray-300">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="dayName" />
            <YAxis domain={[0, 100]} />
            <Tooltip 
              formatter={(value) => [value ? `${value}/100` : 'No data', 'Mood Score']}
              labelFormatter={(label) => `Day: ${label}`}
            />
            <Line 
              type="monotone" 
              dataKey="displayMoodScore" 
              stroke="#8884d8" 
              strokeWidth={2}
              connectNulls={false}
              dot={{ fill: '#8884d8', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};