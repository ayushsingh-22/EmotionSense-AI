'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Mic, MicOff, Loader2, AlertCircle, Volume2, RotateCcw, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import axios from 'axios';

// Type declarations
type PermissionState = 'granted' | 'denied' | 'prompt';

type TranslationInfo = {
  inputTranslated: boolean;
  outputTranslated: boolean;
  languageName: string;
};

interface VoiceChatProps {
  userId: string;
  sessionId?: string;
  language?: string;
  onMessageReceived?: (response: Record<string, unknown>) => void;
  onError?: (error: string) => void;
  className?: string;
  disabled?: boolean;
}

const VoiceChatComponent: React.FC<VoiceChatProps> = ({
  userId,
  sessionId,
  language = 'en-US',
  onMessageReceived,
  onError,
  className,
  disabled = false,
}) => {
  // Error handling helper
  const handleError = (error: unknown) => {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    setError(errorMessage);
    if (onError) {
      onError(errorMessage);
    }
    toast({
      title: "Error",
      description: errorMessage,
      variant: "destructive",
    });
  };
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
  const [detectedLanguage, setDetectedLanguage] = useState<string | null>(null);
  const [translationInfo, setTranslationInfo] = useState<TranslationInfo | null>(null);

  // Response type definitions
  interface ChatResponse {
    success: boolean;
    data: {
      detectedLanguage?: string;
      audioUrl?: string;
      translationInfo?: {
        inputTranslated: boolean;
        outputTranslated: boolean;
        languageName: string;
      };
      error?: string;
    };
  }

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
  const stopAudioPlayback = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setIsPlayingAudio(false);
    }
  };

  const playAudioResponse = async (url: string) => {
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
      handleError(error);
      setIsPlayingAudio(false);
    }
  };

  // Microphone access functions
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

  // Recording control functions
  const startListening = async () => {
    if (disabled) return;
    
    // Clear previous recording data
    audioChunksRef.current = [];
    setCurrentTranscript('');
    setError(null);
    
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
  };

  const stopListening = () => {
    try {
      if (mediaRecorderRef.current?.state !== 'inactive') {
        mediaRecorderRef.current?.stop();
        console.log('🎙️ Recording stopped');
      }

      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }

      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
      }

      // Create a temporary transcript from the audio chunks
      setCurrentTranscript('Recording completed. Click send to process.');
      setIsListening(false);
      console.log('🎙️ Audio chunks collected:', audioChunksRef.current.length);
    } catch (error) {
      console.error('Error stopping recording:', error);
      setError('Failed to stop recording');
      setIsListening(false);
    }
  };

  const clearTranscript = () => {
    setCurrentTranscript('');
    setError(null);
    if (isListening) {
      stopListening();
    }
  };

  // Voice message submission
  const submitVoiceMessage = async () => {
    if (disabled || isProcessing || audioChunksRef.current.length === 0) {
      console.log('Cannot submit: disabled:', disabled, 'processing:', isProcessing, 'chunks:', audioChunksRef.current.length);
      return;
    }
    
    setIsProcessing(true);
    setError(null);

    try {
      // Create FormData for multipart upload
      setCurrentTranscript('Processing voice message...');
      
      // Prepare audio data
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg';
      const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
      
      // Create FormData for chat message with voice
      const formData = new FormData();
      formData.append('userId', userId);
      if (sessionId) formData.append('sessionId', sessionId);
      formData.append('audio', audioBlob, 'voice-message.webm');
      formData.append('type', 'voice');

      // Add language detection parameters
      if (detectedLanguage) {
      }

      // Send to voice CHAT endpoint (not just analysis)
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
        
        // Update transcript from response
        if (data.userMessage?.text) {
          setCurrentTranscript(data.userMessage.text);
        }
        
        // Get detected language from the response
        const detectedLang = data.language?.detected || data.userMessage?.detectedLanguage;
        if (detectedLang) {
          setDetectedLanguage(detectedLang);
          console.log('🌍 Detected language:', detectedLang);
        }
        
        // Update translation info if available
        if (data.language) {
          setTranslationInfo({
            inputTranslated: data.language.inputTranslated || false,
            outputTranslated: data.language.outputTranslated || false,
            languageName: data.language.name || 'Unknown'
          });
        }

        // Play audio response if available (backend already generated it!)
        if (data.audio?.url) {
          console.log(`🎵 Playing voice response in ${data.language?.name || 'detected language'}`);
          setAudioResponseUrl(data.audio.url);
          await playAudioResponse(data.audio.url);
        }

        // Notify parent component
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
        // Handle Axios specific errors
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
  };

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
          <span className="text-sm font-medium">
            {isListening ? `🎙️ Recording (${listeningDuration}s)` : '🎤 Ready to Record'}
          </span>
          {error && (
            <div className="flex items-center gap-1 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}
        </div>

        {/* Transcript Display */}
        {currentTranscript && (
          <div className="p-3 bg-secondary rounded-lg">
            <p className="text-sm">{currentTranscript}</p>
          </div>
        )}

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
            disabled={disabled || isProcessing}
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

        {/* Translation Info */}
        {translationInfo && translationInfo.inputTranslated && (
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-blue-900 dark:text-blue-100">
                🌐 Multilingual Mode Active
              </span>
            </div>
            <div className="text-xs text-blue-700 dark:text-blue-300 mt-1 space-y-0.5">
              <p>• Detected: {translationInfo.languageName}</p>
              <p>• Input: Translated to English for processing</p>
              {translationInfo.outputTranslated && (
                <p>• Output: Translated back to {translationInfo.languageName}</p>
              )}
              <p>• Voice: Audio response in {translationInfo.languageName}</p>
            </div>
          </div>
        )}

        {/* Status Info */}
        <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
          <p>• Default Language: {language}</p>
          {detectedLanguage && <p>• Detected: {detectedLanguage}</p>}
          <p>• Status: {isListening ? 'Recording' : 'Ready'}</p>
          {currentTranscript && <p>• Length: {currentTranscript.length} characters</p>}
        </div>
      </div>
    </Card>
  );
};

export { VoiceChatComponent };