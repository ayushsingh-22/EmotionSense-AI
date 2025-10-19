'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { VoiceRecorder } from '@/components/voice/VoiceRecorder';
import { EmotionCard } from '@/components/emotions/EmotionCard';
import { AIResponseBox } from '@/components/emotions/AIResponseBox';
import { useStore } from '@/store/useStore';
import { analyzeMultiModal } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle2 } from 'lucide-react';
import type { MultiModalResult } from '@/types';

export default function MultiModalPage() {
  const [text, setText] = useState('');
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [result, setResult] = useState<MultiModalResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  const { toast } = useToast();
  const addToHistory = useStore((state) => state.addToHistory);

  const handleRecordingComplete = (blob: Blob) => {
    setAudioBlob(blob);
    toast({
      title: 'Recording saved',
      description: 'Audio ready for multi-modal analysis',
    });
  };

  const handleAnalyze = async () => {
    if (!text.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter some text',
        variant: 'destructive',
      });
      return;
    }

    if (!audioBlob) {
      toast({
        title: 'Error',
        description: 'Please record audio first',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsAnalyzing(true);
      const audioFile = new File([audioBlob], 'recording.webm', { type: 'audio/webm' });
      const analysisResult = await analyzeMultiModal(text, audioFile);
      setResult(analysisResult);
      addToHistory('multimodal', analysisResult);
      
      toast({
        title: 'Success',
        description: 'Multi-modal analysis complete',
      });
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to analyze. Please try again.',
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
        <h1 className="text-3xl font-bold tracking-tight">Multi-Modal Analysis</h1>
        <p className="text-muted-foreground mt-2">
          Combine text and voice for comprehensive emotion detection
        </p>
      </div>

      {/* Input Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Text Input */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            Text Input
            {text.trim() && <CheckCircle2 className="h-5 w-5 text-green-500" />}
          </h3>
          <Textarea
            placeholder="Type your text here..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            className="resize-none"
          />
        </Card>

        {/* Voice Input */}
        <div>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            Voice Input
            {audioBlob && <CheckCircle2 className="h-5 w-5 text-green-500" />}
          </h3>
          <VoiceRecorder onRecordingComplete={handleRecordingComplete} />
        </div>
      </div>

      {/* Analyze Button */}
      <div className="flex justify-center">
        <Button
          onClick={handleAnalyze}
          disabled={isAnalyzing || !text.trim() || !audioBlob}
          size="lg"
          className="px-12"
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Analyzing...
            </>
          ) : (
            'Analyze Multi-Modal'
          )}
        </Button>
      </div>

      {/* Results */}
      {isAnalyzing && <Skeleton className="h-96 w-full" />}

      {result && !isAnalyzing && (
        <div className="space-y-6">
          {/* Emotion Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h3 className="text-sm font-medium mb-3 text-center">Text Emotion</h3>
              <EmotionCard
                emotion={result.text_emotion.emotion}
                confidence={result.text_emotion.confidence}
                animated={false}
              />
            </div>
            <div>
              <h3 className="text-sm font-medium mb-3 text-center">Voice Emotion</h3>
              <EmotionCard
                emotion={result.voice_emotion.emotion}
                confidence={result.voice_emotion.confidence}
                animated={false}
              />
            </div>
            <div>
              <h3 className="text-sm font-medium mb-3 text-center">Weighted Result</h3>
              <EmotionCard
                emotion={result.weighted_emotion.emotion}
                confidence={result.weighted_emotion.confidence}
              />
            </div>
          </div>

          {/* AI Response */}
          <AIResponseBox
            response={result.ai_response}
            emotion={result.weighted_emotion.emotion}
          />
        </div>
      )}
    </div>
  );
}
