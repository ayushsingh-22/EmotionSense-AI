'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
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
import { AuthGuard } from '@/components/auth/AuthGuard';

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

  const checkAudioPermission = useCallback(async () => {
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
  }, [toast]);

  // Check audio permission on mount
  useEffect(() => {
    checkAudioPermission();
  }, [checkAudioPermission]);

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

  const stopRecording = async () => {
    if (!mediaRecorder.current || !isRecording) {
      return;
    }

    try {
      return new Promise<void>((resolve, reject) => {
        const recorder = mediaRecorder.current!;
        
        // Set up the stop handler
        recorder.onstop = async () => {
          try {
            const blob = new Blob(audioChunks.current, { type: 'audio/webm;codecs=opus' });
            setAudioBlob(blob);
            
            // Clean up media stream
            if (recorder.stream) {
              recorder.stream.getTracks().forEach(track => track.stop());
            }
            
            setIsRecording(false);
            
            if (recordingInterval.current) {
              clearInterval(recordingInterval.current);
              recordingInterval.current = null;
            }
            
            resolve();
          } catch (error) {
            console.error('Error in onstop handler:', error);
            reject(error);
          }
        };

        recorder.onerror = (event) => {
          console.error('MediaRecorder error during stop:', event);
          setIsRecording(false);
          reject(new Error('Recording stop failed'));
        };

        // Stop the recorder if it's not already inactive
        if (recorder.state !== 'inactive') {
          recorder.stop();
        } else {
          setIsRecording(false);
          resolve();
        }
      });
    } catch (error) {
      console.error('Error stopping recording:', error);
      setIsRecording(false);
      if (recordingInterval.current) {
        clearInterval(recordingInterval.current);
        recordingInterval.current = null;
      }
      throw error;
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

  return (
    <AuthGuard requireAuth={true}>
      <div className="max-w-4xl mx-auto space-y-8 p-6">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 mb-4">
          <Mic className="h-8 w-8 text-white" />
        </div>
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">
            Voice Emotion Analysis
          </h1>
          <p className="text-lg text-muted-foreground">
            Speak to express your emotions and get empathetic AI responses with voice playback
          </p>
        </div>
      </div>

      {/* Recording Controls */}
      <Card className="backdrop-blur-sm bg-white/80 border-white/20 shadow-xl">
        <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-t-lg">
          <CardTitle className="flex items-center text-lg">
            <div className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 mr-3">
              <Mic className="h-4 w-4 text-white" />
            </div>
            Voice Recording
          </CardTitle>
        </CardHeader>
        <CardContent className="p-8">
          <div className="flex flex-col items-center space-y-6">
            {/* Recording Button */}
            <div className="relative">
              <Button
                size="lg"
                variant={isRecording ? 'destructive' : 'default'}
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isAnalyzing || audioPermission === false}
                className={`h-24 w-24 rounded-full text-white font-semibold transition-all duration-300 ${
                  isRecording 
                    ? 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 shadow-lg shadow-red-200' 
                    : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-lg shadow-purple-200'
                }`}
              >
                {isRecording ? (
                  <MicOff className="h-10 w-10" />
                ) : (
                  <Mic className="h-10 w-10" />
                )}
              </Button>
              
              {isRecording && (
                <div className="absolute -inset-3 rounded-full border-3 border-red-400 animate-ping" />
              )}
            </div>

            {/* Recording Status */}
            <div className="text-center">
              {isRecording ? (
                <div className="space-y-3">
                  <div className="inline-flex items-center justify-center px-4 py-2 bg-gradient-to-r from-red-50 to-red-100 rounded-full border border-red-200">
                    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse mr-2"></div>
                    <p className="text-lg font-semibold text-red-700">
                      Recording... {formatTime(recordingTime)}
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Tap the microphone to stop recording
                  </p>
                </div>
              ) : audioBlob ? (
                <div className="space-y-4">
                  <div className="inline-flex items-center justify-center px-4 py-2 bg-gradient-to-r from-green-50 to-green-100 rounded-full border border-green-200">
                    <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                    <p className="text-lg font-semibold text-green-700">
                      Recording ready ({formatTime(recordingTime)})
                    </p>
                  </div>
                  <div className="flex items-center justify-center space-x-3">
                    <Button
                      onClick={analyzeAudio}
                      disabled={isAnalyzing}
                      className="min-w-[140px] bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
                    >
                      {isAnalyzing ? 'Analyzing...' : 'Analyze Voice'}
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={resetSession}
                      className="border-gray-300 hover:bg-gray-50"
                    >
                      Record Again
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xl font-semibold text-gray-800">
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
              <div className="w-full max-w-md">
                <Progress 
                  value={Math.min((recordingTime / 30) * 100, 100)} 
                  className="h-2 bg-red-100"
                />
                <p className="text-xs text-center text-red-600 mt-1">
                  {Math.max(0, 30 - recordingTime)}s remaining
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Analysis Results */}
      {result && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Emotion Results */}
          <Card className="backdrop-blur-sm bg-white/80 border-white/20 shadow-xl">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-lg">
              <CardTitle className="flex items-center text-lg">
                <div className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 mr-3">
                  <span className="text-white font-bold text-sm">😊</span>
                </div>
                Emotion Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 p-6">
              {/* Main Combined Emotion */}
              <div className="text-center p-6 rounded-xl bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 border border-indigo-200">
                <div className="text-6xl mb-3 animate-bounce">
                  {getEmotionEmoji(result.combined_emotion.emotion)}
                </div>
                <h3 className="text-2xl font-bold mb-2 capitalize text-indigo-800">
                  {result.combined_emotion.emotion}
                </h3>
                <Badge
                  className="px-4 py-2 text-sm font-semibold"
                  style={{
                    backgroundColor: getEmotionColor(result.combined_emotion.emotion) + '20',
                    color: getEmotionColor(result.combined_emotion.emotion),
                    border: `1px solid ${getEmotionColor(result.combined_emotion.emotion)}40`,
                  }}
                >
                  {Math.round(result.combined_emotion.confidence * 100)}% confidence
                </Badge>
              </div>

              {/* Individual Emotion Scores */}
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-gradient-to-r from-green-50 to-green-100 border border-green-200">
                  <h4 className="font-semibold text-green-800 mb-2">Voice Emotion</h4>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center text-green-700 font-medium">
                      <span className="text-xl mr-2">{getEmotionEmoji(result.voice_emotion.emotion)}</span>
                      {result.voice_emotion.emotion}
                    </span>
                    <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-300">
                      {Math.round(result.voice_emotion.confidence * 100)}%
                    </Badge>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200">
                  <h4 className="font-semibold text-blue-800 mb-2">Text Emotion</h4>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center text-blue-700 font-medium">
                      <span className="text-xl mr-2">{getEmotionEmoji(result.text_emotion.emotion)}</span>
                      {result.text_emotion.emotion}
                    </span>
                    <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-blue-300">
                      {Math.round(result.text_emotion.confidence * 100)}%
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* AI Response */}
          <Card className="backdrop-blur-sm bg-white/80 border-white/20 shadow-xl">
            <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-t-lg">
              <CardTitle className="flex items-center text-lg">
                <div className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 mr-3">
                  <Volume2 className="h-4 w-4 text-white" />
                </div>
                AI Response
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 p-6">
              {/* Transcript */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-gray-50 to-gray-100 border border-gray-200">
                <h4 className="font-semibold text-gray-800 mb-3 flex items-center">
                  <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                  What you said:
                </h4>
                <p className="text-sm bg-white p-4 rounded-lg italic text-gray-700 border border-gray-200 shadow-sm">
                  &quot;{result.transcript}&quot;
                </p>
              </div>

              {/* AI Response */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200">
                <h4 className="font-semibold text-purple-800 mb-3 flex items-center">
                  <span className="w-2 h-2 bg-purple-500 rounded-full mr-2"></span>
                  Empathetic Response:
                </h4>
                <p className="text-sm bg-white p-4 rounded-lg text-gray-700 border border-purple-200 shadow-sm leading-relaxed">
                  {result.ai_response}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-center space-x-3">
                <Button
                  onClick={playResponse}
                  disabled={isPlayingResponse}
                  variant="outline"
                  size="sm"
                  className={`min-w-[140px] ${
                    isPlayingResponse 
                      ? 'bg-gradient-to-r from-orange-50 to-orange-100 border-orange-300 text-orange-700' 
                      : 'bg-gradient-to-r from-green-50 to-green-100 border-green-300 text-green-700 hover:from-green-100 hover:to-green-150'
                  }`}
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
                  className="bg-gradient-to-r from-blue-50 to-blue-100 border-blue-300 text-blue-700 hover:from-blue-100 hover:to-blue-150"
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
          <Button 
            onClick={resetSession} 
            variant="outline" 
            size="lg"
            className="bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-300 text-indigo-700 hover:from-indigo-100 hover:to-purple-100 px-8 py-3 text-lg font-semibold"
          >
            <Mic className="h-5 w-5 mr-2" />
            Start New Voice Session
          </Button>
        </div>
      )}
    </div>
    </AuthGuard>
  );
}