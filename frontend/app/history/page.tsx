'use client';

import { useStore } from '@/store/useStore';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { EMOTION_CONFIG, type AnalysisHistory, type EmotionType } from '@/types';
import { format } from 'date-fns';
import { FileText, Mic, Layers, Trash2 } from 'lucide-react';

export default function HistoryPage() {
  const { history, clearHistory } = useStore();

  const getIcon = (type: string) => {
    switch (type) {
      case 'text':
        return FileText;
      case 'voice':
        return Mic;
      case 'multimodal':
        return Layers;
      default:
        return FileText;
    }
  };

  const getEmotion = (item: AnalysisHistory): EmotionType => {
    if ('main_emotion' in item.result) {
      return item.result.main_emotion.emotion;
    }
    if ('combined_emotion' in item.result) {
      return item.result.combined_emotion.emotion;
    }
    if ('weighted_emotion' in item.result) {
      return item.result.weighted_emotion.emotion;
    }
    return 'neutral';
  };

  const getConfidence = (item: AnalysisHistory): number => {
    if ('main_emotion' in item.result) {
      return item.result.main_emotion.confidence;
    }
    if ('combined_emotion' in item.result) {
      return item.result.combined_emotion.confidence;
    }
    if ('weighted_emotion' in item.result) {
      return item.result.weighted_emotion.confidence;
    }
    return 0;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analysis History</h1>
          <p className="text-muted-foreground mt-2">
            View your past emotion analyses
          </p>
        </div>
        {history.length > 0 && (
          <Button variant="destructive" onClick={clearHistory}>
            <Trash2 className="mr-2 h-4 w-4" />
            Clear History
          </Button>
        )}
      </div>

      {/* History List */}
      {history.length > 0 ? (
        <div className="space-y-4">
          {history.map((item) => {
            const Icon = getIcon(item.type);
            const emotion = getEmotion(item);
            const confidence = getConfidence(item);
            const config = EMOTION_CONFIG[emotion];

            return (
              <Card key={item.id} className="p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${config.color}20` }}
                  >
                    <Icon className="h-6 w-6" style={{ color: config.color }} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="secondary" className="capitalize">
                        {item.type}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(item.timestamp), 'PPpp')}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{config.emoji}</span>
                        <div>
                          <p
                            className="font-semibold capitalize"
                            style={{ color: config.color }}
                          >
                            {emotion}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {Math.round(confidence * 100)}% confidence
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* AI Response Preview */}
                    {'ai_response' in item.result && (
                      <>
                        <Separator className="my-3" />
                        <div className="text-sm text-muted-foreground line-clamp-2">
                          {item.result.ai_response}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="p-12 text-center">
          <div className="max-w-md mx-auto space-y-4">
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto">
              <Layers className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold">No History Yet</h3>
            <p className="text-muted-foreground">
              Your analysis history will appear here after you perform analyses
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
