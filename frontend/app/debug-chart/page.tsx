'use client';

import React from 'react';
import { MinimalistWeeklyChart } from '@/components/insights/MinimalistWeeklyChart';
import { SimplifiedChart } from '@/components/debug/SimplifiedChart';

// Mock data to test the chart
const mockDailyArc = [
  {
    date: '2024-11-18',
    emotion: 'joy',
    mood_score: 75,
    activity_count: 5,
    has_data: true
  },
  {
    date: '2024-11-19',
    emotion: 'neutral',
    mood_score: 60,
    activity_count: 3,
    has_data: true
  },
  {
    date: '2024-11-20',
    emotion: 'sadness',
    mood_score: 40,
    activity_count: 2,
    has_data: true
  },
  {
    date: '2024-11-21',
    emotion: 'joy',
    mood_score: 80,
    activity_count: 4,
    has_data: true
  },
  {
    date: '2024-11-22',
    emotion: 'neutral',
    mood_score: null,
    activity_count: 0,
    has_data: false
  },
  {
    date: '2024-11-23',
    emotion: 'anger',
    mood_score: 30,
    activity_count: 1,
    has_data: true
  },
  {
    date: '2024-11-24',
    emotion: 'surprise',
    mood_score: 70,
    activity_count: 3,
    has_data: true
  }
];

export default function DebugChartPage() {
  console.log('Debug Chart Page rendered');
  console.log('Mock Daily Arc:', mockDailyArc);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-4">Chart Debug Page</h1>
      
      <div className="space-y-8">
        <div className="border border-gray-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Simplified Chart Test</h2>
          <SimplifiedChart dailyArc={mockDailyArc} />
        </div>

        <div className="border border-gray-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">MinimalistWeeklyChart - Original</h2>
          <MinimalistWeeklyChart 
            dailyArc={mockDailyArc}
            weekStart="2024-11-18"
            weekEnd="2024-11-24"
          />
        </div>

        <div className="border border-gray-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Chart with Empty Data</h2>
          <MinimalistWeeklyChart 
            dailyArc={[]}
            weekStart="2024-11-18"
            weekEnd="2024-11-24"
          />
        </div>

        <div className="border border-gray-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Raw Data Structure</h2>
          <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
            {JSON.stringify(mockDailyArc, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}