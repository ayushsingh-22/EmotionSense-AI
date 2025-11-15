'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Loader2, AlertCircle, Volume2, RotateCcw, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import axios from 'axios';

// Type declarations
type PermissionState = 'granted' | 'denied' | 'prompt';

interface VoiceChatProps {
  userId: string;
  sessionId?: string;
  language?: string;
  onMessageReceived?: (response: Record<string, unknown>) => void;
  onError?: (error: string) => void;
  className?: string;
  disabled?: boolean;
}

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
    <div
      className={cn(
        'space-y-3 rounded-3xl border-2 border-primary/20 bg-background/80 p-5 shadow-2xl backdrop-blur-lg',
        'hover:border-primary/40 transition-all duration-300',
        { 'opacity-50 cursor-not-allowed': disabled },
        className
      )}
    >
      {/* Error Display */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-destructive/10 border border-destructive/30 rounded-2xl">
          <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
          <span className="text-xs text-destructive font-medium">{error}</span>
        </div>
      )}

      {/* Main Input Area */}
      <div className="flex items-end gap-3">
        {/* Status/Transcript Display */}
        <div className="relative flex-1 min-h-[52px] max-h-[140px] rounded-2xl border-2 border-border/40 bg-background/90 px-5 py-4 transition-all focus-within:border-primary/60 focus-within:ring-4 focus-within:ring-primary/20 dark:bg-background/95 shadow-inner overflow-y-auto">
          {isListening ? (
            <div className="flex items-center gap-3">
              <div className="relative flex h-8 w-8 items-center justify-center flex-shrink-0">
                <span className="absolute h-8 w-8 rounded-full bg-gradient-to-r from-primary/20 to-purple-500/20 animate-ping" />
                <span className="relative h-3 w-3 rounded-full bg-gradient-to-r from-primary to-purple-600" />
              </div>
              <div className="flex items-center gap-2 flex-1">
                <div className="flex items-center justify-center gap-0.5 h-6">
                  {[...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className="w-0.5 bg-gradient-to-t from-primary to-purple-600 rounded-full"
                      style={{
                        height: '100%',
                        animation: `wave 1s ease-in-out infinite`,
                        animationDelay: `${i * 0.1}s`,
                      }}
                    />
                  ))}
                </div>
                <span className="text-xs font-semibold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                  Listening{listeningDuration > 0 ? ` (${listeningDuration}s)` : ''}
                </span>
              </div>
            </div>
          ) : isProcessing ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                {Array.from({ length: 3 }).map((_, index) => (
                  <span
                    key={index}
                    className="h-2 w-2 rounded-full bg-gradient-to-r from-primary to-purple-600 animate-pulse"
                    style={{ animationDelay: `${index * 0.2}s` }}
                  />
                ))}
              </div>
              <span className="text-xs font-semibold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                Processing...
              </span>
            </div>
          ) : currentTranscript ? (
            <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
              {currentTranscript}
            </p>
          ) : (
            <div className="flex items-center gap-3 text-muted-foreground/60">
              <Mic className="h-5 w-5" />
              <span className="text-base">Tap the mic to start recording...</span>
            </div>
          )}
        </div>

        {/* Microphone Button */}
        <Button
          onClick={isListening ? stopListening : startListening}
          disabled={isButtonDisabled}
          className={cn(
            'h-12 w-12 flex-shrink-0 rounded-2xl p-0 shadow-lg transition-all duration-300',
            'flex items-center justify-center',
            !isListening && 'bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 hover:from-blue-600 hover:via-indigo-600 hover:to-purple-700 text-white',
            isListening && 'bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white',
            'disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed disabled:shadow-none',
            !isButtonDisabled && 'hover:scale-110 hover:shadow-2xl active:scale-95',
            'border-2 border-white/20'
          )}
          title={isListening ? "Stop recording" : "Start recording"}
        >
          {isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </Button>

        {/* Submit/Action Button */}
        {currentTranscript && !isListening && (
          <Button
            onClick={submitVoiceMessage}
            disabled={disabled || isProcessing || !currentTranscript.trim()}
            className={cn(
              'h-12 w-12 flex-shrink-0 rounded-2xl p-0 shadow-lg transition-all duration-300',
              'flex items-center justify-center',
              'bg-gradient-to-br from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white',
              'disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed disabled:shadow-none',
              !disabled && !isProcessing && 'hover:scale-110 hover:shadow-2xl hover:shadow-green-500/40 active:scale-95',
              'border-2 border-white/20'
            )}
            title="Send voice message"
          >
            {isProcessing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          </Button>
        )}

        {/* Clear Button */}
        {currentTranscript && !isListening && !isProcessing && (
          <Button
            onClick={clearTranscript}
            disabled={disabled}
            variant="outline"
            className={cn(
              'h-12 w-12 flex-shrink-0 rounded-2xl p-0 shadow-md transition-all duration-300',
              'flex items-center justify-center border-2',
              'hover:bg-accent/50 hover:scale-110 active:scale-95'
            )}
            title="Clear transcript"
          >
            <RotateCcw className="h-5 w-5" />
          </Button>
        )}
      </div>

      {/* Audio Response Player */}
      {audioResponseUrl && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-2 border-green-500/30 rounded-2xl">
          <span className="text-xs font-semibold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
            {isPlayingAudio ? '🔊 Playing response...' : '✅ Response ready'}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={isPlayingAudio ? stopAudioPlayback : () => playAudioResponse(audioResponseUrl)}
            className="h-8 w-8 p-0 rounded-xl hover:bg-green-500/20 transition-all"
          >
            <Volume2 className="h-4 w-4 text-green-600" />
          </Button>
        </div>
      )}

      <div className="px-2 text-xs text-muted-foreground/70 font-medium">🎙️ Voice input for hands-free interaction</div>
      
      <style jsx>{`
        @keyframes wave {
          0%, 100% { transform: scaleY(0.3); }
          50% { transform: scaleY(1); }
        }
      `}</style>
    </div>
  );
});

// Set display name for debugging
VoiceChatComponent.displayName = 'VoiceChatComponent';

export { VoiceChatComponent };