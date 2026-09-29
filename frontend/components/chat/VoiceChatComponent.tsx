'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Loader2, AlertCircle, Volume2, RotateCcw, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { sendVoiceMessageStream, type VoiceAudioChunk } from '@/lib/api';

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
  /**
   * Same gate text chat uses: returns an existing/new session id, or null if
   * blocked (e.g. no emergency contact on file yet). Voice chat must not
   * start recording or submit without going through this.
   */
  ensureSessionReady?: () => Promise<string | null>;
}

// Memoized component for better performance
const VoiceChatComponent = React.memo<VoiceChatProps>(({
  userId,
  sessionId,
  onMessageReceived,
  onError,
  className,
  disabled = false,
  ensureSessionReady,
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
  // AI reply text as it streams in via SSE, shown live before the audio is ready.
  const [streamingResponse, setStreamingResponse] = useState('');
  // Continuous "voice mode": once enabled, the mic auto-restarts after each
  // AI response finishes speaking, so the user never has to tap again.
  const [continuousMode, setContinuousMode] = useState(false);

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
  // Silence-detection (VAD) refs — analyse mic input while recording so we
  // can auto-stop a turn instead of requiring a manual tap.
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const vadRafRef = useRef<number | null>(null);
  const silenceStartRef = useRef<number | null>(null);
  const hasSpokenRef = useRef(false);
  const continuousModeRef = useRef(false);
  // Sentence-level TTS chunks arrive out of order relative to playback speed
  // (network/TTS latency varies per chunk), so we buffer by index and only
  // ever play them back-to-back in order, starting well before the full
  // response/final audio is ready.
  const chunkQueueRef = useRef<Map<number, VoiceAudioChunk>>(new Map());
  const nextChunkIndexRef = useRef(0);
  const isPlayingChunkRef = useRef(false);
  // Barge-in: a separate mic stream/analyser opened only while AI audio is
  // playing, so the user can start talking over the response and have it
  // stop immediately — like ChatGPT voice mode's interrupt behavior. Kept
  // fully separate from the recording VAD above since the two run at
  // different times (never concurrently) but must not interfere with each
  // other's refs.
  const bargeInStreamRef = useRef<MediaStream | null>(null);
  const bargeInContextRef = useRef<AudioContext | null>(null);
  const bargeInAnalyserRef = useRef<AnalyserNode | null>(null);
  const bargeInRafRef = useRef<number | null>(null);

  useEffect(() => {
    continuousModeRef.current = continuousMode;
  }, [continuousMode]);

  // Silence thresholds. RMS is on a 0-1 scale from the analyser's time-domain
  // data; SILENCE_DURATION_MS is how long the user must be quiet before we
  // treat their turn as finished (mirrors ChatGPT voice mode's auto-send).
  const SILENCE_RMS_THRESHOLD = 0.02;
  const SILENCE_DURATION_MS = 1200;
  const MIN_SPEECH_DURATION_MS = 400;
  // Barge-in fires on the first loud-enough frame — no debounce — so the AI
  // stops talking as soon as the user starts, mirroring ChatGPT voice mode.
  // Threshold is a bit higher than the recording VAD's to avoid the AI's own
  // audio (picked up faintly via speakers/echo) from self-triggering a stop.
  const BARGE_IN_RMS_THRESHOLD = 0.05;

  const stopVoiceActivityDetection = useCallback(() => {
    if (vadRafRef.current !== null) {
      cancelAnimationFrame(vadRafRef.current);
      vadRafRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    silenceStartRef.current = null;
    hasSpokenRef.current = false;
  }, []);

  // Forward ref so the barge-in monitor (defined before stopAudioPlayback
  // and startListening exist) can call them once they're defined below.
  const stopAudioPlaybackRef = useRef<() => void>(() => {});

  const stopBargeInMonitor = useCallback(() => {
    if (bargeInRafRef.current !== null) {
      cancelAnimationFrame(bargeInRafRef.current);
      bargeInRafRef.current = null;
    }
    if (bargeInContextRef.current) {
      bargeInContextRef.current.close().catch(() => {});
      bargeInContextRef.current = null;
    }
    bargeInAnalyserRef.current = null;
    if (bargeInStreamRef.current) {
      bargeInStreamRef.current.getTracks().forEach(track => track.stop());
      bargeInStreamRef.current = null;
    }
  }, []);

  const startBargeInMonitor = useCallback(async () => {
    // Don't fight the recording VAD for the mic, don't open a second stream
    // if one's already monitoring (e.g. between back-to-back chunks), and
    // don't bother if this browser doesn't support AudioContext (barge-in
    // is a nice-to-have, not a hard requirement).
    if (mediaStreamRef.current || bargeInStreamRef.current) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      bargeInStreamRef.current = stream;

      const AudioContextCtor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioContext = new AudioContextCtor();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);

      bargeInContextRef.current = audioContext;
      bargeInAnalyserRef.current = analyser;

      const data = new Float32Array(analyser.fftSize);

      const tick = () => {
        if (!bargeInAnalyserRef.current) return;
        bargeInAnalyserRef.current.getFloatTimeDomainData(data);

        let sumSquares = 0;
        for (let i = 0; i < data.length; i++) sumSquares += data[i] * data[i];
        const rms = Math.sqrt(sumSquares / data.length);

        if (rms > BARGE_IN_RMS_THRESHOLD) {
          // User started talking over the AI — stop playback immediately
          // and start a fresh recording turn, exactly like tapping the mic.
          stopBargeInMonitor();
          stopAudioPlaybackRef.current();
          startListeningRef.current();
          return;
        }

        bargeInRafRef.current = requestAnimationFrame(tick);
      };

      bargeInRafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      // Barge-in is a UX enhancement, not a hard requirement.
      console.error('Failed to start barge-in monitor:', err);
    }
  }, [stopBargeInMonitor]);

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
    stopVoiceActivityDetection();
    stopBargeInMonitor();
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

  // Fires only once all queued audio (every sentence chunk, or the single
  // fallback clip) has finished playing and the backend has confirmed no
  // more chunks are coming — not after each individual chunk.
  const onAllAudioFinished = useCallback(() => {
    if (continuousModeRef.current) {
      startListeningRef.current();
    }
  }, []);

  // Audio playback functions
  const stopAudioPlayback = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setIsPlayingAudio(false);
    }
    chunkQueueRef.current.clear();
    nextChunkIndexRef.current = 0;
    isPlayingChunkRef.current = false;
    streamDoneRef.current = false;
    stopBargeInMonitor();
  }, [stopBargeInMonitor]);

  useEffect(() => {
    stopAudioPlaybackRef.current = stopAudioPlayback;
  }, [stopAudioPlayback]);

  const playAudioResponse = useCallback(async (url: string) => {
    try {
      stopAudioPlayback(); // Stop any existing playback

      const audio = new Audio(url);
      audio.preload = 'auto'; // Preload audio data
      audioRef.current = audio;

      audio.onended = () => {
        setIsPlayingAudio(false);
        audioRef.current = null;
        onAllAudioFinished();
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
      void startBargeInMonitor();
    } catch (error) {
      handleError(error, 'Failed to play audio response');
      setIsPlayingAudio(false);
    }
  }, [stopAudioPlayback, handleError, onAllAudioFinished, startBargeInMonitor]);

  // Streaming-TTS chunk queue: plays sentence audio clips strictly in order
  // as soon as each becomes available, instead of waiting for the whole
  // response to finish. `streamDoneRef` tracks whether the backend has told
  // us no more chunks are coming, so we know when the *last* chunk's
  // onended should count as "AI finished speaking" for continuous mode.
  const streamDoneRef = useRef(false);
  const totalChunkCountRef = useRef<number | null>(null);

  const playNextQueuedChunk = useCallback(() => {
    const nextIndex = nextChunkIndexRef.current;
    const chunk = chunkQueueRef.current.get(nextIndex);

    if (!chunk) {
      isPlayingChunkRef.current = false;
      // No more chunks buffered right now. If the stream has finished and
      // this was the last expected chunk, the conversation turn is over.
      if (streamDoneRef.current && totalChunkCountRef.current !== null && nextIndex >= totalChunkCountRef.current) {
        setIsPlayingAudio(false);
        onAllAudioFinished();
      }
      return;
    }

    chunkQueueRef.current.delete(nextIndex);
    isPlayingChunkRef.current = true;
    setIsPlayingAudio(true);
    void startBargeInMonitor();

    const audio = new Audio(chunk.url);
    audio.preload = 'auto';
    audioRef.current = audio;

    audio.onended = () => {
      audioRef.current = null;
      nextChunkIndexRef.current = nextIndex + 1;
      playNextQueuedChunk();
    };

    audio.onerror = (e) => {
      console.error('Audio chunk playback error:', e);
      audioRef.current = null;
      nextChunkIndexRef.current = nextIndex + 1;
      playNextQueuedChunk();
    };

    audio.play().catch((error) => {
      console.error('Failed to play audio chunk:', error);
      audioRef.current = null;
      nextChunkIndexRef.current = nextIndex + 1;
      playNextQueuedChunk();
    });
  }, [onAllAudioFinished, startBargeInMonitor]);

  const enqueueAudioChunk = useCallback((chunk: VoiceAudioChunk) => {
    chunkQueueRef.current.set(chunk.index, chunk);
    if (!isPlayingChunkRef.current) {
      playNextQueuedChunk();
    }
  }, [playNextQueuedChunk]);

  const isButtonDisabled = useMemo(() =>
    disabled || isProcessing,
    [disabled, isProcessing]
  );

  // Forward refs so callbacks defined earlier in the file (VAD loop, audio
  // onended handler) can call functions that are declared further down.
  const stopListeningRef = useRef<() => void>(() => {});
  const startListeningRef = useRef<() => void>(() => {});

  const startVoiceActivityDetection = useCallback((stream: MediaStream) => {
    try {
      const AudioContextCtor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioContext = new AudioContextCtor();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      silenceStartRef.current = null;
      hasSpokenRef.current = false;

      const data = new Float32Array(analyser.fftSize);
      const startedAt = Date.now();

      const tick = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getFloatTimeDomainData(data);

        let sumSquares = 0;
        for (let i = 0; i < data.length; i++) sumSquares += data[i] * data[i];
        const rms = Math.sqrt(sumSquares / data.length);

        const now = Date.now();
        if (rms > SILENCE_RMS_THRESHOLD) {
          hasSpokenRef.current = true;
          silenceStartRef.current = null;
        } else if (hasSpokenRef.current && now - startedAt > MIN_SPEECH_DURATION_MS) {
          if (silenceStartRef.current === null) {
            silenceStartRef.current = now;
          } else if (now - silenceStartRef.current > SILENCE_DURATION_MS) {
            stopListeningRef.current();
            return;
          }
        }

        vadRafRef.current = requestAnimationFrame(tick);
      };

      vadRafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      // VAD is a UX enhancement, not a hard requirement — if AudioContext
      // fails (unsupported browser, etc.) fall back to manual tap-to-stop.
      console.error('Failed to start voice activity detection:', err);
    }
  }, []);

  // Recording control functions - memoized for performance
  const startListening = useCallback(async () => {
    if (disabled) return;

    if (ensureSessionReady) {
      const ready = await ensureSessionReady();
      if (!ready) {
        // Blocked (e.g. no emergency contact on file) — ChatContext already
        // surfaces the required prompt; don't start recording.
        onError?.('emergency_contact_required');
        return;
      }
    }

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

      startVoiceActivityDetection(stream);
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
  }, [disabled, permission, onError, ensureSessionReady, startVoiceActivityDetection]);

  useEffect(() => {
    startListeningRef.current = () => { void startListening(); };
  }, [startListening]);

  // Voice message submission - memoized
  const submitVoiceMessage = useCallback(async () => {
    if (disabled || isProcessing || audioChunksRef.current.length === 0) {
      console.log('Cannot submit: disabled:', disabled, 'processing:', isProcessing, 'chunks:', audioChunksRef.current.length);
      return;
    }
    
    setIsProcessing(true);
    setError(null);

    try {
      // Re-confirm right before sending — authoritative, avoids racing the
      // sessionId prop update from a startListening-time check.
      let resolvedSessionId = sessionId;
      if (ensureSessionReady) {
        const ready = await ensureSessionReady();
        if (!ready) {
          setIsProcessing(false);
          setCurrentTranscript('');
          onError?.('emergency_contact_required');
          return;
        }
        resolvedSessionId = ready;
      }

      setCurrentTranscript('Processing voice message...');
      setStreamingResponse('');
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg';
      const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });

      let accumulatedText = '';

      // Reset chunk-playback state for this new turn.
      chunkQueueRef.current.clear();
      nextChunkIndexRef.current = 0;
      isPlayingChunkRef.current = false;
      streamDoneRef.current = false;
      totalChunkCountRef.current = null;

      await sendVoiceMessageStream(audioBlob, userId, resolvedSessionId, {
        onTranscript: (text) => {
          setCurrentTranscript(text);
        },
        onToken: (text) => {
          accumulatedText += text;
          setStreamingResponse(accumulatedText);
        },
        onAudioChunk: (chunk) => {
          // Sentence audio ready — queue it for in-order playback right
          // away, rather than waiting for the full response.
          enqueueAudioChunk(chunk);
        },
        onDone: async (data) => {
          const chunks = data.audioChunks;
          if (Array.isArray(chunks) && chunks.length > 0) {
            // Chunked audio already streaming/queued via onAudioChunk — just
            // record how many chunks to expect so playNextQueuedChunk knows
            // when the last one has finished.
            totalChunkCountRef.current = chunks.length;
            streamDoneRef.current = true;
            if (!isPlayingChunkRef.current) {
              playNextQueuedChunk();
            }
          } else if (data.audio?.url) {
            // No chunked audio (e.g. all per-sentence TTS calls failed) —
            // fall back to the single full-response clip.
            setAudioResponseUrl(data.audio.url);
            await playAudioResponse(data.audio.url);
          } else {
            streamDoneRef.current = true;
            totalChunkCountRef.current = 0;
          }

          if (onMessageReceived) {
            onMessageReceived(data as unknown as Record<string, unknown>);
          }
        },
        onError: (message) => {
          throw new Error(message);
        },
      });
    } catch (err) {
      console.error('Error submitting voice message:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to submit voice message';

      setError(errorMessage);
      if (onError) onError(errorMessage);

      toast({
        title: "Voice Message Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setStreamingResponse('');
      setIsProcessing(false);
    }
  }, [disabled, isProcessing, userId, sessionId, onMessageReceived, onError, playAudioResponse, ensureSessionReady, enqueueAudioChunk, playNextQueuedChunk]);

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

          stopVoiceActivityDetection();
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
  }, [submitVoiceMessage, stopVoiceActivityDetection]);

  useEffect(() => {
    stopListeningRef.current = () => { void stopListening(); };
  }, [stopListening]);

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

      {/* Continuous Voice Mode Toggle */}
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-medium text-muted-foreground">
          Continuous voice mode
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => setContinuousMode((prev) => !prev)}
          className={cn(
            'h-7 rounded-full px-3 text-xs font-semibold transition-all',
            continuousMode
              ? 'bg-gradient-to-r from-primary to-purple-600 text-white border-transparent'
              : 'bg-background'
          )}
          title="When on, the mic reopens automatically after each response so you can talk hands-free"
        >
          {continuousMode ? 'On' : 'Off'}
        </Button>
      </div>

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
            <div className="space-y-1.5">
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
                  {streamingResponse ? 'Responding...' : 'Processing...'}
                </span>
              </div>
              {streamingResponse && (
                <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
                  {streamingResponse}
                </p>
              )}
            </div>
          ) : currentTranscript ? (
            <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
              {currentTranscript}
            </p>
          ) : (
            <div className="flex items-center gap-3 text-muted-foreground/60">
              <Mic className="h-5 w-5" />
              <span className="text-base">
                {continuousMode
                  ? 'Tap the mic to start — it will keep listening automatically'
                  : 'Tap the mic to start recording...'}
              </span>
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