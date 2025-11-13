'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Mic, MicOff, Loader2, AlertCircle, Volume2, RotateCcw, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import axios from 'axios';

// Type declarations
type PermissionState = 'granted' | 'denied' | 'prompt';

interface VoiceChatProps {
  userId: string;
  sessionId?: string;
  onMessageReceived?: (response: Record<string, unknown>) => void;
  onError?: (error: string) => void;
  className?: string;
  disabled?: boolean;
}

const ListeningWave = () => (
  <div className="relative flex h-10 w-10 items-center justify-center" aria-hidden="true">
    <span className="absolute h-10 w-10 rounded-full border border-primary/20 animate-ping" />
    <span className="absolute h-7 w-7 rounded-full border border-primary/25 animate-ping" style={{ animationDelay: '0.25s' }} />
    <span className="absolute h-4 w-4 rounded-full border border-primary/30 animate-ping" style={{ animationDelay: '0.5s' }} />
    <span className="relative h-2 w-2 rounded-full bg-primary" />
  </div>
);

const ThinkingDots = () => (
  <div className="flex items-center gap-1" aria-hidden="true">
    {Array.from({ length: 3 }).map((_, index) => (
      <span
        key={index}
        className="h-2 w-2 rounded-full bg-primary/80 animate-pulse"
        style={{ animationDelay: `${index * 0.2}s` }}
      />
    ))}
  </div>
);

// Memoized component for better performance
const VoiceChatComponent = React.memo<VoiceChatProps>(({
  userId,
  sessionId,
  onMessageReceived,
  onError,
  className,
  disabled = false,
}) => {
  // State
  const [isMounted, setIsMounted] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [permission, setPermission] = useState<PermissionState>('prompt');
  const [listeningDuration, setListeningDuration] = useState(0);
  const [audioResponseUrl, setAudioResponseUrl] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  const handleError = useCallback((err: unknown, fallbackMessage: string) => {
    console.error(fallbackMessage, err);
    const message = err instanceof Error ? err.message : fallbackMessage;
    setError(message);
    onError?.(message);
    return message;
  }, [onError]);

  // Response type definitions - moved inline to avoid unused interface error

  // Type guard for response data (removed — not used)
  
  // Refs
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup function
  const cleanup = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
  };

  // Effects
  useEffect(() => {
    setIsMounted(true);
    checkMicrophonePermission();
    return cleanup;
  }, []);

  // Check microphone permission on mount
  const checkMicrophonePermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      setPermission('granted');
    } catch (error) {
      setPermission('denied');
      console.error('Microphone permission check failed:', error);
    }
  };

  // Audio playback functions
  const stopAudioPlayback = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setIsPlayingAudio(false);
    }
  }, []);

  const playAudioResponse = useCallback(async (url: string) => {
    try {
      stopAudioPlayback(); // Stop any existing playback

      const audio = new Audio(url);
      audio.preload = 'auto'; // Preload audio data
      audioRef.current = audio;
      
      audio.onended = () => {
        setIsPlayingAudio(false);
        audioRef.current = null;
      };

      audio.onerror = (e) => {
        console.error('Audio playback error:', e);
        setIsPlayingAudio(false);
        audioRef.current = null;
        toast({
          title: "Audio Playback Failed",
          description: "Could not play the audio response. Please try again.",
          variant: "destructive",
        });
      };

      setIsPlayingAudio(true);
      await audio.play();
    } catch (error) {
      handleError(error, 'Failed to play audio response');
      setIsPlayingAudio(false);
    }
  }, [stopAudioPlayback, handleError]);

  const isButtonDisabled = useMemo(() => 
    disabled || isProcessing, 
    [disabled, isProcessing]
  );

  // Recording control functions - memoized for performance
  const startListening = useCallback(async () => {
    if (disabled) return;
    
    // Clear previous recording data
    audioChunksRef.current = [];
    setCurrentTranscript('');
    setError(null);
    
    // Request microphone access if needed
    const requestMicrophoneAccess = async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        setPermission('granted');
        setError(null);
        return true;
      } catch (err: unknown) {
        setPermission('denied');
        const errorMessage = 'Microphone access denied. Please enable it in your browser settings.';
        setError(errorMessage);
        if (onError) onError('microphone_denied');
        console.error('Microphone access error:', err);
        return false;
      }
    };
    
    if (permission === 'denied') {
      const hasPermission = await requestMicrophoneAccess();
      if (!hasPermission) return;
    }
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      audioChunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg';
      const mediaRecorder = new MediaRecorder(stream, { mimeType });

      mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          console.log('🎙️ Audio chunk recorded:', event.data.size, 'bytes');
        }
      };
      
      mediaRecorder.onerror = (event: Event) => {
        console.error('MediaRecorder error:', event);
        setError('Recording error occurred');
        setIsListening(false);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000);
      setIsListening(true);
      setError(null);
      setCurrentTranscript('');
      setListeningDuration(0);

      durationIntervalRef.current = setInterval(() => {
        setListeningDuration((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Error starting recording:', error);
      const err = error as { name?: string; message?: string };
      let errorMessage = 'Failed to start recording';

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMessage = '🚫 Microphone access denied';
        setPermission('denied');
      } else if (err.name === 'NotFoundError') {
        errorMessage = 'No microphone found';
      }

      setError(errorMessage);
      if (onError) onError(errorMessage);
    }
  }, [disabled, permission, onError]);

  // Voice message submission - memoized
  const submitVoiceMessage = useCallback(async () => {
    if (disabled || isProcessing || audioChunksRef.current.length === 0) {
      console.log('Cannot submit: disabled:', disabled, 'processing:', isProcessing, 'chunks:', audioChunksRef.current.length);
      return;
    }
    
    setIsProcessing(true);
    setError(null);

    try {
      setCurrentTranscript('Processing voice message...');
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg';
      const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });

      const formData = new FormData();
      formData.append('userId', userId);
      if (sessionId) formData.append('sessionId', sessionId);
      formData.append('audio', audioBlob, 'voice-message.webm');
      formData.append('type', 'voice');

      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/api/chat/voice`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 120000
        }
      );

      if (response.data.success) {
        const data = response.data.data;

        if (data.userMessage?.text) {
          setCurrentTranscript(data.userMessage.text);
        }

        if (data.audio?.url) {
          setAudioResponseUrl(data.audio.url);
          await playAudioResponse(data.audio.url);
        }

        if (onMessageReceived) {
          onMessageReceived(data);
        }

      } else {
        throw new Error(response.data.error || 'Failed to process voice message');
      }
    } catch (err) {
      console.error('Error submitting voice message:', err);
      let errorMessage = 'Failed to submit voice message';
      
      if (axios.isAxiosError(err)) {
        const statusCode = err.response?.status;
        const responseError = err.response?.data?.error;

        console.log(`API Error - Status: ${statusCode}, Message: ${responseError || err.message}`);

        if (statusCode === 404) {
          errorMessage = 'Voice chat endpoint not available. Please check server configuration.';
        } else if (statusCode === 413) {
          errorMessage = 'Audio file too large. Please record a shorter message.';
        } else if (statusCode === 415) {
          errorMessage = 'Unsupported audio format. Please try again.';
        } else if (statusCode === 400 && responseError?.includes('message')) {
          errorMessage = 'Failed to process voice message. Please try speaking clearly and try again.';
        } else {
          errorMessage = responseError || err.message;
        }
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }

      setError(errorMessage);
      if (onError) onError(errorMessage);

      toast({
        title: "Voice Message Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  }, [disabled, isProcessing, userId, sessionId, onMessageReceived, onError, playAudioResponse]);

  const stopListening = useCallback(async () => {
    try {
      if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
        setIsListening(false);
        return;
      }

      // Create a promise that resolves when recording is properly stopped
      return new Promise<void>((resolve, reject) => {
        const mediaRecorder = mediaRecorderRef.current!;
        
        const cleanup = () => {
          if (durationIntervalRef.current) {
            clearInterval(durationIntervalRef.current);
            durationIntervalRef.current = null;
          }

          if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
          }
        };

        // Set up the stop handler
        mediaRecorder.onstop = async () => {
          try {
            cleanup();
            if (audioChunksRef.current.length > 0) {
              setCurrentTranscript('Processing voice message...');
              setIsListening(false);
              setIsProcessing(true);
              
              // Automatically submit voice message (includes transcription, emotion analysis, LLM response, and TTS)
              await submitVoiceMessage();
            } else {
              setCurrentTranscript('No audio recorded');
              setIsListening(false);
            }
            
            console.log('🎙️ Recording stopped and processed');
            resolve();
          } catch (error) {
            console.error('Error processing stopped recording:', error);
            setError('Failed to process recording');
            setIsListening(false);
            setIsProcessing(false);
            reject(error);
          }
        };

        mediaRecorder.onerror = (event) => {
          console.error('MediaRecorder error during stop:', event);
          cleanup();
          setError('Recording error occurred');
          setIsListening(false);
          reject(new Error('MediaRecorder stop failed'));
        };

        // Stop the recorder
        if (mediaRecorder.state !== 'inactive') {
          mediaRecorder.stop();
        } else {
          cleanup();
          setIsListening(false);
          resolve();
        }
      });
    } catch (error) {
      console.error('Error stopping recording:', error);
      setError('Failed to stop recording');
      setIsListening(false);
      setIsProcessing(false);
      throw error;
    }
  }, [submitVoiceMessage]);

  const clearTranscript = useCallback(() => {
    setCurrentTranscript('');
    setError(null);
    if (isListening) {
      stopListening();
    }
  }, [isListening, stopListening]);

  // Don't render anything until mounted (avoid hydration issues)
  if (!isMounted) return null;

  return (
    <Card
      className={cn(
        'flex flex-col space-y-4 p-4 relative min-w-[300px]',
        { 'opacity-50 cursor-not-allowed': disabled },
        className
      )}
    >
      {/* Main Content */}
      <div className="flex flex-col space-y-4">
        {/* Status Display */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isListening ? (
              <>
                <ListeningWave />
                <span className="text-sm font-medium text-primary">
                  Listening{listeningDuration > 0 ? ` (${listeningDuration}s)` : ''}
                </span>
              </>
            ) : isProcessing ? (
              <>
                <ThinkingDots />
                <span className="text-sm font-medium text-muted-foreground">
                  Thinking through your message...
                </span>
              </>
            ) : (
              <span className="text-sm text-muted-foreground">
                Tap the mic when you are ready.
              </span>
            )}
          </div>
          {error && (
            <div className="flex items-center gap-1 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}
        </div>

        {/* Audio Response Player */}
        {audioResponseUrl && (
          <div className="p-3 bg-secondary rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                {isPlayingAudio ? '🔊 Playing response...' : '✅ Response ready'}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={isPlayingAudio ? stopAudioPlayback : () => playAudioResponse(audioResponseUrl)}
                className="h-8 w-8 p-0"
              >
                <Volume2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Control Buttons */}
        <div className="flex gap-2 flex-wrap">
          {/* Microphone Button */}
          <Button
            onClick={isListening ? stopListening : startListening}
            disabled={isButtonDisabled}
            variant={isListening ? 'destructive' : 'default'}
            size="lg"
            className="flex-1 gap-2"
          >
            {isListening ? (
              <>
                <MicOff className="h-5 w-5" />
                Stop Recording
              </>
            ) : (
              <>
                <Mic className="h-5 w-5" />
                Start Recording
              </>
            )}
          </Button>

          {/* Clear Button */}
          {currentTranscript && (
            <Button
              onClick={clearTranscript}
              disabled={disabled || isProcessing || isListening}
              variant="outline"
              size="lg"
              className="gap-2"
            >
              <RotateCcw className="h-5 w-5" />
              Clear
            </Button>
          )}

          {/* Submit Button */}
          <Button
            onClick={submitVoiceMessage}
            disabled={disabled || isProcessing || !currentTranscript.trim() || isListening}
            variant="outline"
            size="lg"
            className="gap-2"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Send className="h-5 w-5" />
                Send
              </>
            )}
          </Button>
        </div>

      </div>
    </Card>
  );
});

// Set display name for debugging
VoiceChatComponent.displayName = 'VoiceChatComponent';

export { VoiceChatComponent };