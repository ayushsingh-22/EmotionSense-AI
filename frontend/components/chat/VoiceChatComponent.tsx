'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Mic, MicOff, Square, Loader2, AlertCircle, Volume2, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import axios from 'axios';



interface VoiceChatProps {
  userId: string;
  sessionId?: string;
  language?: string;
  onMessageReceived?: (response: Record<string, unknown>) => void;
  onError?: (error: string) => void;
  className?: string;
  disabled?: boolean;
}

export function VoiceChatComponent({
  userId,
  sessionId,
  language = 'en-US',
  onMessageReceived,
  onError,
  className,
  disabled = false,
}: VoiceChatProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [permission, setPermission] = useState<'granted' | 'denied' | 'prompt'>('prompt');
  const [listeningDuration, setListeningDuration] = useState(0);
  const [audioResponseUrl, setAudioResponseUrl] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  // Set mounted state to prevent hydration issues
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Check for microphone permissions on mount
  useEffect(() => {
    // Only run in browser, not during SSR
    if (typeof window === 'undefined') return;

    // Request microphone permission on component mount
    if (typeof navigator !== 'undefined' && navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'microphone' as PermissionName }).then((result) => {
        setPermission(result.state as 'granted' | 'denied' | 'prompt');

        // Listen for permission changes
        result.addEventListener('change', () => {
          setPermission(result.state as 'granted' | 'denied' | 'prompt');
        });
      }).catch(() => {
        // Permissions API not supported, ignore
      });
    }

    return () => {
      // Cleanup on unmount
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, []);

  // Request microphone access
  const requestMicrophoneAccess = async () => {
    // Check if running in browser
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
      setError('Microphone access is not available');
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      setPermission('granted');
      setError(null);
      return true;
    } catch {
      setPermission('denied');
      setError('Microphone access denied. Please enable it in your browser settings.');
      if (onError) {
        onError('microphone_denied');
      }
      return false;
    }
  };

  // Start listening
  const startListening = async () => {
    if (permission === 'denied') {
      const hasPermission = await requestMicrophoneAccess();
      if (!hasPermission) {
        return;
      }
    }

    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      // Reset audio chunks
      audioChunksRef.current = [];

      // Initialize MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg';
      const mediaRecorder = new MediaRecorder(stream, { mimeType });

      mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          console.log('🎙️ Audio chunk recorded:', event.data.size, 'bytes');
        }
      };

      mediaRecorder.onstop = async () => {
        console.log('🎙️ Recording stopped, processing audio...');
        setIsListening(false);

        // Clear duration counter
        if (durationIntervalRef.current) {
          clearInterval(durationIntervalRef.current);
          durationIntervalRef.current = null;
        }

        // Stop media stream
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach(track => track.stop());
          mediaStreamRef.current = null;
        }

        // Create blob from recorded chunks
        if (audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
          console.log('🎙️ Audio blob created:', audioBlob.size, 'bytes');

          // Send to backend for transcription
          try {
            setIsProcessing(true);
            setError(null);

            const formData = new FormData();
            formData.append('audio', audioBlob, 'recording.webm');

            console.log('🌐 Sending audio to backend for transcription...');
            const response = await axios.post('http://localhost:8080/api/chat/transcribe', formData, {
              headers: {
                'Content-Type': 'multipart/form-data',
              },
            });

            if (response.data.success && response.data.data.text) {
              const transcribedText = response.data.data.text;
              console.log('📝 Transcription received:', transcribedText);
              
              setCurrentTranscript(transcribedText);
              setError(null);

              // Show success toast
              toast({
                title: "Transcription Complete",
                description: `Detected: ${response.data.data.language || 'unknown language'}`,
                duration: 3000,
              });
            } else {
              throw new Error('No transcription returned');
            }
          } catch (err) {
            console.error('❌ Transcription error:', err);
            const error = err as { response?: { data?: { error?: string } }; message?: string };
            const errorMessage = error.response?.data?.error || error.message || 'Failed to transcribe audio';
            setError(`Transcription failed: ${errorMessage}`);
            
            if (onError) {
              onError(errorMessage);
            }

            toast({
              title: "Transcription Failed",
              description: errorMessage,
              variant: "destructive",
              duration: 5000,
            });
          } finally {
            setIsProcessing(false);
          }
        }
      };

      mediaRecorder.onerror = (event: Event) => {
        console.error('❌ MediaRecorder error:', event);
        setError('Recording error occurred');
        setIsListening(false);
      };

      mediaRecorderRef.current = mediaRecorder;

      // Start recording
      mediaRecorder.start(1000); // Collect data every 1 second
      setIsListening(true);
      setError(null);
      setCurrentTranscript('');
      setListeningDuration(0);

      // Start duration counter
      durationIntervalRef.current = setInterval(() => {
        setListeningDuration((prev) => prev + 1);
      }, 1000);

      console.log('🎙️ Recording started with', mimeType);

    } catch (err) {
      console.error('❌ Error starting recording:', err);
      const error = err as { name?: string; message?: string };
      let errorMessage = 'Failed to start recording';

      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        errorMessage = '🚫 Microphone access denied. Please enable microphone permissions in your browser settings.';
        setPermission('denied');
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'No microphone found. Please check your device.';
      } else {
        errorMessage = `Error: ${error.message || 'Unknown error'}`;
      }

      setError(errorMessage);
      
      if (onError) {
        onError(errorMessage);
      }
    }
  };

  // Stop listening
  const stopListening = () => {
    console.log('🛑 Stopping recording...');
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    } else {
      // Cleanup if MediaRecorder already stopped
      setIsListening(false);

      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }

      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
      }
    }
  };

  // Clear transcript
  const clearTranscript = () => {
    setCurrentTranscript('');
    setError(null);

    // Stop recording if in progress
    if (isListening) {
      stopListening();
    }
  };

  // Submit voice message to backend
  const submitVoiceMessage = async () => {
    const transcript = currentTranscript.trim();

    if (!transcript) {
      setError('Please say something before submitting');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      console.log('📤 Submitting voice message to backend...');

      // Create FormData for multipart upload
      const formData = new FormData();

      // For now, we'll send the transcript directly
      // In a production app, you might send the actual audio file
      formData.append('userId', userId);
      formData.append('transcript', transcript);
      formData.append('language', language);

      if (sessionId) {
        formData.append('sessionId', sessionId);
      }

      // Create a minimal audio blob (since Web Speech API doesn't give us audio)
      // In production, you'd use getUserMedia() to capture actual audio
      const audioBlob = new Blob([], { type: 'audio/wav' });
      formData.append('audio', audioBlob, 'voice-message.wav');

      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/api/chat/voice`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          timeout: 30000,
        }
      );

      if (response.data.success) {
        console.log('✅ Voice message processed successfully');

        // Play audio response if available
        if (response.data.data.audio?.url) {
          setAudioResponseUrl(response.data.data.audio.url);
          playAudioResponse(response.data.data.audio.url);
        }

        // Notify parent component
        if (onMessageReceived) {
          onMessageReceived(response.data.data);
        }

        // Clear transcript after successful submission
        clearTranscript();

        toast({
          title: 'Message sent',
          description: 'Your voice message has been processed',
        });
      } else {
        throw new Error(response.data.error || 'Failed to process voice message');
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to process voice message';
      setError(errorMessage);

      if (onError) {
        onError(errorMessage);
      }

      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Play audio response
  const playAudioResponse = (audioUrl: string) => {
    try {
      if (!audioElementRef.current) {
        audioElementRef.current = new Audio();
      }

      audioElementRef.current.src = audioUrl;
      audioElementRef.current.onplay = () => setIsPlayingAudio(true);
      audioElementRef.current.onended = () => setIsPlayingAudio(false);
      audioElementRef.current.onerror = () => {
        console.error('Error playing audio');
        setIsPlayingAudio(false);
      };

      audioElementRef.current.play().catch((err) => {
        console.error('Error playing audio:', err);
        setIsPlayingAudio(false);
      });
    } catch (err) {
      console.error('Error setting up audio playback:', err);
    }
  };

  // Stop audio playback
  const stopAudioPlayback = () => {
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.currentTime = 0;
      setIsPlayingAudio(false);
    }
  };

  // Format duration for display
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Prevent hydration mismatch by not rendering until client-side
  if (!isMounted) {
    return (
      <Card className={cn('p-6 space-y-4', className)}>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn('p-6 space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Voice Chat</h3>
        {isListening && (
          <span className="text-xs font-medium px-2 py-1 bg-red-100 text-red-700 rounded-full">
            Recording... {formatDuration(listeningDuration)}
          </span>
        )}
      </div>

      {/* Transcript Display */}
      <div className="min-h-20 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
        {error && error.includes('blocked by browser') ? (
          // Show manual input when voice is blocked
          <textarea
            value={currentTranscript}
            onChange={(e) => {
              setCurrentTranscript(e.target.value);
            }}
            placeholder="Type your message here..."
            className="w-full min-h-[60px] p-2 bg-white dark:bg-gray-800 rounded border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            rows={3}
          />
        ) : currentTranscript ? (
          <p className="text-gray-900 dark:text-gray-100 whitespace-pre-wrap break-words">
            {currentTranscript}
          </p>
        ) : (
          <p className="text-gray-400 italic">
            {isListening ? 'Listening... speak now' : 'Click the microphone to start speaking'}
          </p>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
          <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 space-y-1">
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            {error.includes('blocked by browser') && (
              <div className="text-xs text-red-600 dark:text-red-400 space-y-1 mt-2">
                <p className="font-semibold">How to enable Web Speech API:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li><strong>Brave:</strong> Settings → Shields → Advanced Controls → Enable Web Speech API</li>
                  <li><strong>Other browsers:</strong> Check privacy settings or use Chrome/Edge</li>
                  <li><strong>Alternative:</strong> Type your message in the text box above</li>
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Permission Status */}
      {permission === 'denied' && (
        <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
          <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
          <p className="text-sm text-yellow-700 dark:text-yellow-300">
            Microphone permission denied. Click the microphone button to request access.
          </p>
        </div>
      )}

      {/* Audio Response Player */}
      {audioResponseUrl && (
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
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
              <Square className="h-5 w-5" />
              Send
            </>
          )}
        </Button>
      </div>

      {/* Status Info */}
      <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
        <p>• Language: {language}</p>
        <p>• Status: {isListening ? 'Recording' : 'Ready'}</p>
        {currentTranscript && <p>• Length: {currentTranscript.length} characters</p>}
      </div>
    </Card>
  );
}

export default VoiceChatComponent;
