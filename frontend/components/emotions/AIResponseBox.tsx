'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, Volume2, RefreshCw, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { regenerateResponse, textToSpeech } from '@/lib/api';

interface AIResponseBoxProps {
  response: string;
  emotion?: string;
  context?: string;
}

export function AIResponseBox({ response, emotion, context }: AIResponseBoxProps) {
  const [currentResponse, setCurrentResponse] = useState(response);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(currentResponse);
      setCopied(true);
      toast({
        title: 'Copied!',
        description: 'Response copied to clipboard',
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to copy to clipboard',
        variant: 'destructive',
      });
    }
  };

  const handleSpeak = async () => {
    try {
      setIsSpeaking(true);
      const audioBlob = await textToSpeech(currentResponse);
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      
      audio.onended = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(audioUrl);
      };
      
      audio.onerror = () => {
        setIsSpeaking(false);
        toast({
          title: 'Error',
          description: 'Failed to play audio',
          variant: 'destructive',
        });
      };
      
      await audio.play();
    } catch (error) {
      setIsSpeaking(false);
      toast({
        title: 'Error',
        description: 'Text-to-speech service unavailable',
        variant: 'destructive',
      });
    }
  };

  const handleRegenerate = async () => {
    if (!emotion) return;
    
    try {
      setIsRegenerating(true);
      const result = await regenerateResponse(emotion, context);
      setCurrentResponse(result.response);
      toast({
        title: 'Success',
        description: 'Response regenerated',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to regenerate response',
        variant: 'destructive',
      });
    } finally {
      setIsRegenerating(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.4 }}
    >
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">AI Empathetic Response</h3>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                disabled={copied}
              >
                {copied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSpeak}
                disabled={isSpeaking}
              >
                <Volume2 className={`h-4 w-4 ${isSpeaking ? 'animate-pulse' : ''}`} />
              </Button>
              {emotion && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRegenerate}
                  disabled={isRegenerating}
                >
                  <RefreshCw className={`h-4 w-4 ${isRegenerating ? 'animate-spin' : ''}`} />
                </Button>
              )}
            </div>
          </div>

          <div className="prose dark:prose-invert max-w-none">
            <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
              {currentResponse}
            </p>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
