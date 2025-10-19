'use client';

import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, VolumeX, RotateCcw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useStore } from '@/store/useStore';
import { analyzeVoice, textToSpeech, regenerateResponse } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { EMOTION_CONFIG } from '@/types';
import type { VoiceAnalysisResult } from '@/types';
import { useToast } from '@/hooks/use-toast';

export default function VoicePage() {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<VoiceAnalysisResult | null>(null);
  const [isPlayingResponse, setIsPlayingResponse] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioPermission, setAudioPermission] = useState<boolean | null>(null);
  
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const recordingInterval = useRef<NodeJS.Timeout | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  
  const { user } = useAuth();
  const { addToHistory, setIsLoading } = useStore();
  const { toast } = useToast();

  // Check audio permission on mount
  useEffect(() => {
    checkAudioPermission();
  }, []);

  const checkAudioPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      setAudioPermission(true);
    } catch (error) {
      console.error('Audio permission denied:', error);
      setAudioPermission(false);
      toast({
        title: 'Microphone Access Required',
        description: 'Please allow microphone access to use voice analysis.',
        variant: 'destructive',
      });
    }
  };

  const startRecording = async () => {
    if (audioPermission === false) {
      await checkAudioPermission();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      mediaRecorder.current = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });
      
      audioChunks.current = [];

      mediaRecorder.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.current.push(event.data);
        }
      };

      mediaRecorder.current.onstop = () => {
        const blob = new Blob(audioChunks.current, { type: 'audio/webm;codecs=opus' });
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.current.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      // Start timer
      recordingInterval.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (error) {
      console.error('Error starting recording:', error);
      toast({
        title: 'Recording Error',
        description: 'Failed to start recording. Please check your microphone.',
        variant: 'destructive',
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current && isRecording) {
      mediaRecorder.current.stop();
      setIsRecording(false);
      
      if (recordingInterval.current) {
        clearInterval(recordingInterval.current);
        recordingInterval.current = null;
      }
    }
  };

  const analyzeAudio = async () => {
    if (!audioBlob || !user) return;

    setIsAnalyzing(true);
    setIsLoading(true);

    try {
      const audioFile = new File([audioBlob], 'recording.webm', {
        type: 'audio/webm;codecs=opus',
      });

      const analysisResult = await analyzeVoice(audioFile);
      setResult(analysisResult);
      addToHistory('voice', analysisResult);

      toast({
        title: 'Analysis Complete',
        description: `Detected emotion: ${analysisResult.combined_emotion.emotion}`,
      });

    } catch (error) {
      console.error('Error analyzing audio:', error);
      toast({
        title: 'Analysis Error',
        description: 'Failed to analyze your voice. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsAnalyzing(false);
      setIsLoading(false);
    }
  };

  const playResponse = async () => {
    if (!result?.ai_response) return;

    try {
      setIsPlayingResponse(true);
      const audioBlob = await textToSpeech(result.ai_response);
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      
      audio.onended = () => {
        setIsPlayingResponse(false);
        URL.revokeObjectURL(audioUrl);
      };
      
      audio.onerror = () => {
        setIsPlayingResponse(false);
        URL.revokeObjectURL(audioUrl);
        toast({
          title: 'Audio Error',
          description: 'Failed to play audio response.',
          variant: 'destructive',
        });
      };

      await audio.play();
    } catch (error) {
      console.error('Error playing response:', error);
      setIsPlayingResponse(false);
      toast({
        title: 'Audio Error',
        description: 'Failed to play audio response.',
        variant: 'destructive',
      });
    }
  };

  const regenerateAIResponse = async () => {
    if (!result) return;

    try {
      setIsLoading(true);
      const { response } = await regenerateResponse(
        result.combined_emotion.emotion,
        result.transcript
      );
      
      setResult(prev => prev ? { ...prev, ai_response: response } : null);
      
      toast({
        title: 'Response Regenerated',
        description: 'Generated a new empathetic response.',
      });
    } catch (error) {
      console.error('Error regenerating response:', error);
      toast({
        title: 'Error',
        description: 'Failed to regenerate response.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetSession = () => {
    setAudioBlob(null);
    setResult(null);
    setRecordingTime(0);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getEmotionColor = (emotion: string) => {
    return EMOTION_CONFIG[emotion as keyof typeof EMOTION_CONFIG]?.color || '#666';
  };

  const getEmotionEmoji = (emotion: string) => {
    return EMOTION_CONFIG[emotion as keyof typeof EMOTION_CONFIG]?.emoji || '😐';
  };

  // Redirect if not authenticated
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Please sign in to access voice analysis.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Voice Emotion Analysis</h1>
        <p className="text-muted-foreground">
          Speak to express your emotions and get empathetic AI responses with voice playback
        </p>
      </div>

      {/* Recording Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Voice Recording</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center space-y-4">
            {/* Recording Button */}
            <div className="relative">
              <Button
                size="lg"
                variant={isRecording ? 'destructive' : 'default'}
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isAnalyzing || audioPermission === false}
                className="h-20 w-20 rounded-full"
              >
                {isRecording ? (
                  <MicOff className="h-8 w-8" />
                ) : (
                  <Mic className="h-8 w-8" />
                )}
              </Button>
              
              {isRecording && (
                <div className="absolute -inset-2 rounded-full border-2 border-red-500 animate-pulse" />
              )}
            </div>

            {/* Recording Status */}
            <div className="text-center">
              {isRecording ? (
                <div className="space-y-2">
                  <p className="text-lg font-medium text-red-600">
                    Recording... {formatTime(recordingTime)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Tap the microphone to stop recording
                  </p>
                </div>
              ) : audioBlob ? (
                <div className="space-y-2">
                  <p className="text-lg font-medium text-green-600">
                    Recording ready ({formatTime(recordingTime)})
                  </p>
                  <div className="flex items-center space-x-2">
                    <Button
                      onClick={analyzeAudio}
                      disabled={isAnalyzing}
                      className="min-w-[120px]"
                    >
                      {isAnalyzing ? 'Analyzing...' : 'Analyze Voice'}
                    </Button>
                    <Button variant="outline" onClick={resetSession}>
                      Record Again
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-lg font-medium">
                    Tap the microphone to start recording
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Express your emotions through voice
                  </p>
                </div>
              )}
            </div>

            {/* Progress bar for recording */}
            {isRecording && (
              <Progress 
                value={Math.min((recordingTime / 30) * 100, 100)} 
                className="w-full max-w-md"
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Analysis Results */}
      {result && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Emotion Results */}
          <Card>
            <CardHeader>
              <CardTitle>Emotion Analysis</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Main Combined Emotion */}
              <div className="text-center p-4 rounded-lg border">
                <div className="text-4xl mb-2">
                  {getEmotionEmoji(result.combined_emotion.emotion)}
                </div>
                <h3 className="text-2xl font-bold mb-1">
                  {result.combined_emotion.emotion}
                </h3>
                <Badge
                  style={{
                    backgroundColor: getEmotionColor(result.combined_emotion.emotion) + '20',
                    color: getEmotionColor(result.combined_emotion.emotion),
                  }}
                >
                  {Math.round(result.combined_emotion.confidence * 100)}% confidence
                </Badge>
              </div>

              {/* Individual Emotion Scores */}
              <div className="space-y-2">
                <h4 className="font-medium">Voice Emotion</h4>
                <div className="flex items-center justify-between">
                  <span className="flex items-center">
                    {getEmotionEmoji(result.voice_emotion.emotion)}{' '}
                    {result.voice_emotion.emotion}
                  </span>
                  <Badge variant="secondary">
                    {Math.round(result.voice_emotion.confidence * 100)}%
                  </Badge>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium">Text Emotion</h4>
                <div className="flex items-center justify-between">
                  <span className="flex items-center">
                    {getEmotionEmoji(result.text_emotion.emotion)}{' '}
                    {result.text_emotion.emotion}
                  </span>
                  <Badge variant="secondary">
                    {Math.round(result.text_emotion.confidence * 100)}%
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* AI Response */}
          <Card>
            <CardHeader>
              <CardTitle>AI Response</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Transcript */}
              <div>
                <h4 className="font-medium mb-2">What you said:</h4>
                <p className="text-sm bg-muted p-3 rounded italic">
                  &quot;{result.transcript}&quot;
                </p>
              </div>

              {/* AI Response */}
              <div>
                <h4 className="font-medium mb-2">Empathetic Response:</h4>
                <p className="text-sm bg-primary/5 p-3 rounded">
                  {result.ai_response}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-2">
                <Button
                  onClick={playResponse}
                  disabled={isPlayingResponse}
                  variant="outline"
                  size="sm"
                >
                  {isPlayingResponse ? (
                    <>
                      <VolumeX className="h-4 w-4 mr-2" />
                      Playing...
                    </>
                  ) : (
                    <>
                      <Volume2 className="h-4 w-4 mr-2" />
                      Play Response
                    </>
                  )}
                </Button>
                <Button
                  onClick={regenerateAIResponse}
                  variant="outline"
                  size="sm"
                  disabled={isAnalyzing}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Regenerate
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* New Session Button */}
      {(result || audioBlob) && (
        <div className="text-center">
          <Button onClick={resetSession} variant="outline" size="lg">
            Start New Voice Session
          </Button>
        </div>
      )}
    </div>
  );
}