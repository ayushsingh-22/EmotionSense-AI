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
import { Loader2, FileText, Brain } from 'lucide-react';
import type { TextAnalysisResult } from '@/types';
import { AuthGuard } from '@/components/auth/AuthGuard';

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
    <AuthGuard requireAuth={true}>
      <div className="space-y-8 p-6">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 mb-4">
          <FileText className="h-8 w-8 text-white" />
        </div>
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent mb-2">
            Text Analysis
          </h1>
          <p className="text-lg text-muted-foreground">
            Analyze emotions from text using dual AI models
          </p>
        </div>
      </div>

      {/* Input Card */}
      <Card className="backdrop-blur-sm bg-white/80 border-white/20 shadow-xl">
        <div className="p-8 space-y-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600">
              <Brain className="h-4 w-4 text-white" />
            </div>
            <label htmlFor="text-input" className="text-lg font-semibold text-gray-800">
              Enter your text for emotion analysis
            </label>
          </div>
          <Textarea
            id="text-input"
            placeholder="Type or paste your text here... (e.g., 'I'm feeling really excited about this new opportunity!')"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            className="resize-none border-2 border-emerald-200 focus:border-emerald-500 bg-gradient-to-br from-white to-emerald-50"
          />
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground bg-gradient-to-r from-gray-100 to-gray-200 px-3 py-1 rounded-full">
              {text.length} characters
            </span>
            <Button
              onClick={handleAnalyze}
              disabled={isAnalyzing || !text.trim()}
              size="lg"
              className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white px-8 py-3 text-lg font-semibold"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Brain className="mr-2 h-5 w-5" />
                  Analyze Text
                </>
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
          <Card className="backdrop-blur-sm bg-white/80 border-white/20 shadow-xl">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-t-lg border-b border-blue-200">
              <h3 className="text-xl font-semibold text-blue-800 flex items-center">
                <div className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 mr-3">
                  <FileText className="h-4 w-4 text-white" />
                </div>
                Analysis Details
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="p-4 rounded-xl bg-gradient-to-r from-gray-50 to-gray-100 border border-gray-200">
                <span className="font-semibold text-gray-800 block mb-2">Original Text:</span>
                <p className="text-gray-700 bg-white p-3 rounded-lg border border-gray-200 italic">{result.originalText}</p>
              </div>
              <div className="p-4 rounded-xl bg-gradient-to-r from-green-50 to-green-100 border border-green-200">
                <span className="font-semibold text-green-800 block mb-2">Processed Text:</span>
                <p className="text-green-700 bg-white p-3 rounded-lg border border-green-200">{result.processedText}</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-gradient-to-r from-purple-50 to-purple-100 border border-purple-200">
                  <span className="font-semibold text-purple-800 block mb-2">Models Used:</span>
                  <p className="text-purple-700 bg-white p-3 rounded-lg border border-purple-200">{result.models_used?.join(', ') || 'BiLSTM + HuggingFace'}</p>
                </div>
                <div className="p-4 rounded-xl bg-gradient-to-r from-orange-50 to-orange-100 border border-orange-200">
                  <span className="font-semibold text-orange-800 block mb-2">Combination Strategy:</span>
                  <p className="text-orange-700 bg-white p-3 rounded-lg border border-orange-200">{result.combination_strategy}</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Emotion Distribution */}
          <EmotionBarChart emotionScores={result.scores} />

          {/* Individual Model Results */}
          {result.individual_results && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {result.individual_results.bilstm && (
                <Card className="backdrop-blur-sm bg-white/80 border-white/20 shadow-xl">
                  <div className="bg-gradient-to-r from-cyan-50 to-cyan-100 p-4 rounded-t-lg border-b border-cyan-200">
                    <h4 className="font-semibold text-cyan-800 flex items-center">
                      <div className="w-3 h-3 bg-cyan-600 rounded-full mr-2"></div>
                      BiLSTM Model
                    </h4>
                  </div>
                  <div className="p-4">
                    <EmotionCard
                      emotion={result.individual_results.bilstm.emotion as EmotionType}
                      confidence={result.individual_results.bilstm.confidence}
                    />
                  </div>
                </Card>
              )}
              {result.individual_results.huggingface && (
                <Card className="backdrop-blur-sm bg-white/80 border-white/20 shadow-xl">
                  <div className="bg-gradient-to-r from-amber-50 to-amber-100 p-4 rounded-t-lg border-b border-amber-200">
                    <h4 className="font-semibold text-amber-800 flex items-center">
                      <div className="w-3 h-3 bg-amber-600 rounded-full mr-2"></div>
                      HuggingFace Model
                    </h4>
                  </div>
                  <div className="p-4">
                    <EmotionCard
                      emotion={result.individual_results.huggingface.emotion as EmotionType}
                      confidence={result.individual_results.huggingface.confidence}
                    />
                  </div>
                </Card>
              )}
            </div>
          )}
        </div>
      )}

      {!result && !isAnalyzing && (
        <Card className="backdrop-blur-sm bg-white/80 border-white/20 shadow-xl">
          <div className="p-12 text-center">
            <div className="max-w-md mx-auto space-y-6">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-r from-gray-100 to-gray-200 mb-4">
                <FileText className="h-10 w-10 text-gray-500" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">Ready for Analysis</h3>
                <p className="text-muted-foreground">
                  Enter text above and click &quot;Analyze Text&quot; to see emotion detection results
                </p>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
    </AuthGuard>
  );
}
