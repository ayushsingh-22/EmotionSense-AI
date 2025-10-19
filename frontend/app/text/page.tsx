'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { EmotionCard } from '@/components/emotions/EmotionCard';
import { EmotionBarChart } from '@/components/emotions/EmotionBarChart';
import { useStore } from '@/store/useStore';
import { analyzeText } from '@/lib/api';
import type { EmotionType } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import type { TextAnalysisResult } from '@/types';

export default function TextAnalysisPage() {
  const [text, setText] = useState('');
  const [result, setResult] = useState<TextAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  const { toast } = useToast();
  const addToHistory = useStore((state) => state.addToHistory);

  const handleAnalyze = async () => {
    if (!text.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter some text to analyze',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsAnalyzing(true);
      const analysisResult = await analyzeText(text);
      setResult(analysisResult);
      addToHistory('text', analysisResult);
      
      toast({
        title: 'Success',
        description: 'Text analyzed successfully',
      });
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to analyze text. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Text Analysis</h1>
        <p className="text-muted-foreground mt-2">
          Analyze emotions from text using dual AI models
        </p>
      </div>

      {/* Input Card */}
      <Card className="p-6">
        <div className="space-y-4">
          <div>
            <label htmlFor="text-input" className="text-sm font-medium mb-2 block">
              Enter your text
            </label>
            <Textarea
              id="text-input"
              placeholder="Type or paste your text here... (e.g., 'I'm feeling really excited about this new opportunity!')"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
              className="resize-none"
            />
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">
              {text.length} characters
            </span>
            <Button
              onClick={handleAnalyze}
              disabled={isAnalyzing || !text.trim()}
              size="lg"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                'Analyze Text'
              )}
            </Button>
          </div>
        </div>
      </Card>

      {/* Results */}
      {isAnalyzing && (
        <div className="space-y-6">
          <Skeleton className="h-64 w-full" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
          </div>
        </div>
      )}

      {result && !isAnalyzing && (
        <div className="space-y-6">
          {/* Main Emotion */}
          <div className="flex justify-center">
            <div className="w-full max-w-md">
              <EmotionCard
                emotion={result.emotion as EmotionType}
                confidence={result.confidence}
              />
            </div>
          </div>

          {/* Analysis Details */}
          <div className="bg-card p-6 rounded-lg border">
            <h3 className="text-lg font-semibold mb-4">Analysis Details</h3>
            <div className="space-y-3 text-sm">
              <div>
                <span className="font-medium">Original Text:</span>
                <p className="text-muted-foreground mt-1">{result.originalText}</p>
              </div>
              <div>
                <span className="font-medium">Processed Text:</span>
                <p className="text-muted-foreground mt-1">{result.processedText}</p>
              </div>
              <div>
                <span className="font-medium">Models Used:</span>
                <p className="text-muted-foreground mt-1">{result.models_used?.join(', ') || 'BiLSTM + HuggingFace'}</p>
              </div>
              <div>
                <span className="font-medium">Combination Strategy:</span>
                <p className="text-muted-foreground mt-1">{result.combination_strategy}</p>
              </div>
            </div>
          </div>

          {/* Emotion Distribution */}
          <EmotionBarChart emotionScores={result.scores} />

          {/* Individual Model Results */}
          {result.individual_results && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {result.individual_results.bilstm && (
                <div className="bg-card p-4 rounded-lg border">
                  <h4 className="font-medium mb-2">BiLSTM Model</h4>
                  <EmotionCard
                    emotion={result.individual_results.bilstm.emotion as EmotionType}
                    confidence={result.individual_results.bilstm.confidence}
                  />
                </div>
              )}
              {result.individual_results.huggingface && (
                <div className="bg-card p-4 rounded-lg border">
                  <h4 className="font-medium mb-2">HuggingFace Model</h4>
                  <EmotionCard
                    emotion={result.individual_results.huggingface.emotion as EmotionType}
                    confidence={result.individual_results.huggingface.confidence}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {!result && !isAnalyzing && (
        <Card className="p-12 text-center">
          <div className="max-w-md mx-auto space-y-4">
            <p className="text-muted-foreground">
              Enter text above and click &quot;Analyze Text&quot; to see emotion detection results
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
