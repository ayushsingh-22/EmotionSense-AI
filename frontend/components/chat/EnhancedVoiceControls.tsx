'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Loader2, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Voice state types for clean state management
export type VoiceState = 'idle' | 'listening' | 'processing' | 'responding';

interface VoiceControlsProps {
  onVoiceMessage: (audioBlob: Blob) => Promise<void>;
  userId: string;
  sessionId?: string;
  language?: string;
  className?: string;
  disabled?: boolean;
}

// Waveform animation component for visual feedback during listening
const WaveformAnimation = React.memo(() => {
  return (
    <motion.div 
      className="flex items-center gap-1 h-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <motion.div
          key={i}
          className="w-1 bg-blue-500 rounded-full"
          initial={{ height: 4 }}
          animate={{ 
            height: [4, 16, 8, 20, 6, 12],
            transition: { 
              duration: 1.2,
              repeat: Infinity,
              delay: i * 0.1,
              ease: "easeInOut"
            }
          }}
        />
      ))}
    </motion.div>
  );
});

WaveformAnimation.displayName = 'WaveformAnimation';

// Processing indicator with smooth animations
const ProcessingIndicator = React.memo(() => {
  return (
    <motion.div 
      className="flex items-center gap-2 text-blue-600 dark:text-blue-400"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
    >
      <Loader2 className="h-4 w-4 animate-spin" />
      <span className="text-sm">Processing speech...</span>
    </motion.div>
  );
});

ProcessingIndicator.displayName = 'ProcessingIndicator';

// Responding indicator with typing-like animation
const RespondingIndicator = React.memo(() => {
  const [dots, setDots] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div 
      className="flex items-center gap-2 text-green-600 dark:text-green-400"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
    >
      <div className="flex gap-1">
        {Array.from({ length: 3 }).map((_, i) => (
          <motion.div
            key={i}
            className="w-2 h-2 bg-current rounded-full"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.6, 1, 0.6]
            }}
            transition={{
              duration: 1,
              repeat: Infinity,
              delay: i * 0.2
            }}
          />
        ))}
      </div>
      <span className="text-sm">AI is responding{dots}</span>
    </motion.div>
  );
});

RespondingIndicator.displayName = 'RespondingIndicator';

export function EnhancedVoiceControls({
  onVoiceMessage,
  className,
  disabled = false
}: VoiceControlsProps) {
  // Core voice state management
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);

  // Refs for media handling
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup function for all media resources
  const cleanup = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    
    audioChunksRef.current = [];
    setRecordingDuration(0);
  }, []);

  // Effect for cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  // Start recording function with error handling
  const startRecording = useCallback(async () => {
    console.log('startRecording called, current voiceState:', voiceState, 'disabled:', disabled);
    
    if (disabled || voiceState !== 'idle') {
      console.log('Cannot start recording - disabled or not idle');
      return;
    }

    try {
      console.log('Starting recording...');
      setError(null);
      setVoiceState('listening');
      
      // Request microphone permission and start recording
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      });
      
      console.log('Got media stream, setting up MediaRecorder...');
      mediaStreamRef.current = stream;
      audioChunksRef.current = [];

      // Setup MediaRecorder with optimal settings
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg';
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      // Handle recorded data
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      // Handle recording completion
      mediaRecorder.onstop = async () => {
        console.log('MediaRecorder stopped, processing audio...');
        
        if (audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
          setVoiceState('processing');
          
          try {
            await onVoiceMessage(audioBlob);
            setVoiceState('responding');
            
            // Auto-reset to idle after a short delay (response handling should manage this)
            setTimeout(() => {
              console.log('Auto-resetting voice state to idle');
              setVoiceState('idle');
            }, 10000); // Fallback reset after 10 seconds
            
          } catch (error) {
            console.error('Voice message processing failed:', error);
            setError(error instanceof Error ? error.message : 'Failed to process voice message');
            setVoiceState('idle');
          }
        } else {
          console.log('No audio data recorded, resetting to idle');
          setVoiceState('idle');
        }
      };

      // Start recording
      mediaRecorder.start();
      console.log('MediaRecorder started successfully');

      // Start duration counter
      durationIntervalRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

    } catch (error) {
      console.error('Failed to start recording:', error);
      setError('Failed to access microphone. Please check permissions.');
      setVoiceState('idle');
      cleanup();
    }
  }, [disabled, voiceState, onVoiceMessage, cleanup]);

  // Stop recording function with improved error handling
  const stopRecording = useCallback(() => {
    console.log('stopRecording called, current voiceState:', voiceState);
    
    // Allow stopping if we're in listening state OR if there's an active media recorder
    const canStop = voiceState === 'listening' || 
                   (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording');
    
    if (!canStop) {
      console.log('Cannot stop recording - not in listening state and no active recorder');
      return;
    }

    try {
      console.log('Attempting to stop recording...');
      
      // Stop the media recorder if it's recording
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        console.log('Stopping MediaRecorder...');
        mediaRecorderRef.current.stop();
      }

      // Clear the duration interval
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }

      // Stop all media tracks
      if (mediaStreamRef.current) {
        console.log('Stopping media tracks...');
        mediaStreamRef.current.getTracks().forEach(track => {
          track.stop();
          console.log('Stopped track:', track.kind);
        });
      }

      // Reset state
      setRecordingDuration(0);
      console.log('Recording stopped successfully');
      
    } catch (error) {
      console.error('Error stopping recording:', error);
      setError('Failed to stop recording');
      setVoiceState('idle');
      cleanup();
    }
  }, [voiceState, cleanup]);

  // Reset voice state to idle (called from parent when response is complete)
  const resetToIdle = useCallback(() => {
    setVoiceState('idle');
    setError(null);
    cleanup();
  }, [cleanup]);

  // Expose reset function to parent component
  useEffect(() => {
    if (onVoiceMessage) {
      // Type assertion to add resetToIdle method
      const fn = onVoiceMessage as typeof onVoiceMessage & { resetToIdle?: () => void };
      fn.resetToIdle = resetToIdle;
    }
  }, [resetToIdle, onVoiceMessage]);

  // Handle record button click with improved logging
  const handleRecordToggle = useCallback(() => {
    console.log('handleRecordToggle called, current voiceState:', voiceState);
    console.log('isRecording:', voiceState === 'listening');
    
    if (voiceState === 'listening') {
      console.log('Attempting to stop recording...');
      stopRecording();
    } else if (voiceState === 'idle') {
      console.log('Attempting to start recording...');
      startRecording();
    } else {
      console.log('Cannot toggle recording - voice state is:', voiceState);
    }
  }, [voiceState, startRecording, stopRecording]);

  // Determine button state and appearance
  const isRecording = voiceState === 'listening';
  const isActive = voiceState !== 'idle';
  const showDuration = isRecording && recordingDuration > 0;

  return (
    <motion.div
      className={cn(
        "relative flex flex-col items-center justify-center p-4 space-y-4",
        "bg-gradient-to-b from-background to-secondary/20 rounded-2xl",
        "border border-border/50 shadow-lg backdrop-blur-sm",
        { 'opacity-50 cursor-not-allowed': disabled },
        className
      )}
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      {/* State indicator with smooth transitions */}
      <AnimatePresence mode="wait">
        {voiceState === 'listening' && (
          <motion.div
            key="listening"
            className="flex flex-col items-center gap-2"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
          >
            <WaveformAnimation />
            {showDuration && (
              <motion.div 
                className="text-xs text-muted-foreground"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                Recording: {recordingDuration}s
              </motion.div>
            )}
          </motion.div>
        )}
        
        {voiceState === 'processing' && (
          <ProcessingIndicator key="processing" />
        )}
        
        {voiceState === 'responding' && (
          <RespondingIndicator key="responding" />
        )}
        
        {voiceState === 'idle' && (
          <motion.div
            key="idle"
            className="text-sm text-muted-foreground text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            Tap microphone to start talking
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main record button with dynamic styling - Gemini Live style */}
      <motion.div
        className="relative"
        whileHover={{ scale: disabled ? 1 : 1.05 }}
        whileTap={{ scale: disabled ? 1 : 0.95 }}
      >
        <Button
          onClick={handleRecordToggle}
          disabled={disabled || voiceState === 'processing'}
          size="lg"
          className={cn(
            "h-20 w-20 rounded-full transition-all duration-300",
            "shadow-lg hover:shadow-xl border-4",
            isRecording
              ? "bg-red-500 hover:bg-red-600 text-white border-red-300 shadow-red-200"
              : "bg-blue-500 hover:bg-blue-600 text-white border-blue-300 shadow-blue-200",
            isActive && voiceState !== 'listening' && "bg-gray-400 cursor-not-allowed border-gray-300",
            // Enhanced visual feedback for different states
            voiceState === 'processing' && "animate-pulse bg-yellow-500 border-yellow-300",
            voiceState === 'responding' && "bg-green-500 border-green-300"
          )}
        >
          <motion.div
            animate={{ 
              rotate: isRecording ? 0 : 0,
              scale: isRecording ? 1.1 : 1 
            }}
            transition={{ duration: 0.3 }}
          >
            {voiceState === 'processing' ? (
              <Loader2 className="h-8 w-8 animate-spin" />
            ) : voiceState === 'responding' ? (
              <Volume2 className="h-8 w-8" />
            ) : isRecording ? (
              <motion.div
                className="flex items-center justify-center"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                <MicOff className="h-8 w-8" />
              </motion.div>
            ) : (
              <Mic className="h-8 w-8" />
            )}
          </motion.div>
        </Button>

        {/* Recording indicator ring - enhanced for better visibility */}
        {isRecording && (
          <>
            <motion.div
              className="absolute inset-0 rounded-full border-4 border-red-400"
              initial={{ scale: 1, opacity: 1 }}
              animate={{ 
                scale: [1, 1.3, 1],
                opacity: [1, 0.3, 1]
              }}
              transition={{ 
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
            <motion.div
              className="absolute inset-0 rounded-full border-2 border-red-300"
              initial={{ scale: 1, opacity: 0.8 }}
              animate={{ 
                scale: [1, 1.5, 1],
                opacity: [0.8, 0, 0.8]
              }}
              transition={{ 
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 0.5
              }}
            />
          </>
        )}

        {/* Processing ring animation */}
        {voiceState === 'processing' && (
          <motion.div
            className="absolute inset-0 rounded-full border-4 border-yellow-400"
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          />
        )}
      </motion.div>

      {/* Simplified action text - removed redundant buttons */}
      <motion.div
        className="text-center space-y-1 min-h-[3rem] flex flex-col justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        {/* Dynamic instruction text based on state */}
        <p className={cn(
          "text-sm font-medium transition-colors duration-300",
          isRecording && "text-red-600 dark:text-red-400",
          voiceState === 'processing' && "text-yellow-600 dark:text-yellow-400",
          voiceState === 'responding' && "text-green-600 dark:text-green-400",
          voiceState === 'idle' && "text-gray-600 dark:text-gray-400"
        )}>
          {isRecording && "Tap to stop recording"}
          {voiceState === 'processing' && "Processing your voice..."}
          {voiceState === 'responding' && "AI is responding..."}
          {voiceState === 'idle' && "Tap to start recording"}
        </p>
        
        {/* Duration display for recording */}
        {showDuration && (
          <motion.p 
            className="text-xs text-muted-foreground font-mono"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, '0')}
          </motion.p>
        )}
      </motion.div>

      {/* Error display */}
      <AnimatePresence>
        {error && (
          <motion.div
            className="text-sm text-red-600 dark:text-red-400 text-center max-w-xs"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Export hook for voice state management
export function useVoiceState() {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  
  const startListening = useCallback(() => setVoiceState('listening'), []);
  const startProcessing = useCallback(() => setVoiceState('processing'), []);
  const startResponding = useCallback(() => setVoiceState('responding'), []);
  const resetToIdle = useCallback(() => setVoiceState('idle'), []);
  
  return {
    voiceState,
    startListening,
    startProcessing,
    startResponding,
    resetToIdle,
    isActive: voiceState !== 'idle'
  };
}