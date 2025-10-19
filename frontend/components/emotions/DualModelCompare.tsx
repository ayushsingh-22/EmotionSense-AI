'use client';

import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EMOTION_CONFIG, type ModelResult, type EmotionType } from '@/types';
import { CheckCircle2, XCircle } from 'lucide-react';

interface DualModelCompareProps {
  bilstmResult: ModelResult;
  huggingfaceResult: ModelResult;
}

export function DualModelCompare({ bilstmResult, huggingfaceResult }: DualModelCompareProps) {
  const agree = bilstmResult.emotion === huggingfaceResult.emotion;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="space-y-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Model Comparison</h3>
        <div className="flex items-center gap-2">
          {agree ? (
            <>
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <span className="text-sm text-green-600 dark:text-green-400 font-medium">
                Models Agree
              </span>
            </>
          ) : (
            <>
              <XCircle className="h-5 w-5 text-orange-500" />
              <span className="text-sm text-orange-600 dark:text-orange-400 font-medium">
                Models Disagree
              </span>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* BiLSTM Model */}
        <ModelCard model={bilstmResult} title="BiLSTM Model" />

        {/* HuggingFace Model */}
        <ModelCard model={huggingfaceResult} title="HuggingFace Model" />
      </div>
    </motion.div>
  );
}

function ModelCard({ model, title }: { model: ModelResult; title: string }) {
  const config = EMOTION_CONFIG[model.emotion as EmotionType] || { 
    color: '#6B7280', 
    emoji: '❓', 
    bgColor: 'bg-gray-400' 
  };
  const confidencePercent = Math.round(model.confidence * 100);

  return (
    <Card className="p-4 border-2 hover:shadow-md transition-all">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-sm text-muted-foreground">{title}</h4>
          <Badge variant="secondary">{confidencePercent}%</Badge>
        </div>

        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-2xl"
            style={{ backgroundColor: `${config.color}20` }}
          >
            {config.emoji}
          </div>
          <div className="flex-1">
            <p className="font-semibold capitalize" style={{ color: config.color }}>
              {model.emotion}
            </p>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-1">
              <div
                className="h-2 rounded-full transition-all duration-500"
                style={{
                  width: `${confidencePercent}%`,
                  backgroundColor: config.color,
                }}
              />
            </div>
          </div>
        </div>

        {/* Top 3 scores if available */}
        {model.scores && (
          <div className="pt-2 border-t space-y-1">
            <p className="text-xs text-muted-foreground">Top predictions:</p>
            {Object.entries(model.scores)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 3)
              .map(([emotion, score]) => (
                <div key={emotion} className="flex justify-between text-xs">
                  <span className="capitalize">{emotion}</span>
                  <span className="font-medium">{Math.round(score * 100)}%</span>
                </div>
              ))}
          </div>
        )}
      </div>
    </Card>
  );
}
