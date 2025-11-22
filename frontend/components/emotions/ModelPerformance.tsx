'use client';

import { Card } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { AnalysisHistory, TextAnalysisResult } from '@/types';

interface ModelPerformanceProps {
  history: AnalysisHistory[];
}

export function ModelPerformance({ history }: ModelPerformanceProps) {
  // Filter only text analyses that have both model results
  const textAnalyses = history.filter((item) => item.type === 'text');

  let agreements = 0;
  let disagreements = 0;

  textAnalyses.forEach((item) => {
    if (item.type === 'text') {
      const result = item.result as TextAnalysisResult;
      if (result.individual_results?.bilstm && result.individual_results?.huggingface) {
        if (result.individual_results.bilstm.emotion === result.individual_results.huggingface.emotion) {
          agreements++;
        } else {
          disagreements++;
        }
      }
    }
  });

  const data = [
    { name: 'Agreement', value: agreements },
    { name: 'Disagreement', value: disagreements },
  ];

  const total = agreements + disagreements;
  const agreementRate = total > 0 ? Math.round((agreements / total) * 100) : 0;

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Model Agreement</h3>
      {total > 0 ? (
        <>
          <div className="text-center mb-4">
            <p className="text-4xl font-bold text-primary">{agreementRate}%</p>
            <p className="text-sm text-muted-foreground">Agreement Rate</p>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data} margin={{ top: 20, right: 20, left: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke="hsl(var(--primary))" 
                strokeWidth={3}
                dot={{ r: 6, fill: 'hsl(var(--primary))', strokeWidth: 2, stroke: '#fff' }}
                activeDot={{ r: 8, strokeWidth: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Analyses:</span>
              <span className="font-medium">{total}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Agreements:</span>
              <span className="font-medium text-green-600">{agreements}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Disagreements:</span>
              <span className="font-medium text-orange-600">{disagreements}</span>
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <p>No analysis data available</p>
          <p className="text-sm mt-2">Perform text analyses to see model comparison</p>
        </div>
      )}
    </Card>
  );
}
