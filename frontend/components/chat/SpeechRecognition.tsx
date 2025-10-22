'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Square } from 'lucide-react';
import { cn } from '@/lib/utils';

// TypeScript interfaces for Speech Recognition API
interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent {
  error: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null;
  onend: ((this: SpeechRecognition, ev: Event) => void) | null;
  onstart: ((this: SpeechRecognition, ev: Event) => void) | null;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognition;
}

declare global {
  interface Window {
    SpeechRecognition: SpeechRecognitionConstructor;
    webkitSpeechRecognition: SpeechRecognitionConstructor;
  }
}

interface SpeechRecognitionProps {
  onTranscript: (text: string) => void;
  onError?: (error: string) => void;
  className?: string;
  disabled?: boolean;
}

export function SpeechRecognition({ 
  onTranscript, 
  onError, 
  className, 
  disabled = false 
}: SpeechRecognitionProps) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const retryCountRef = useRef(0);

  useEffect(() => {
    // Only run in browser, not during SSR
    if (typeof window === 'undefined') return;

    // Check if speech recognition is supported
    const SpeechRecognition = window.SpeechRecognition || 
                             window.webkitSpeechRecognition;
    
    setIsSupported(!!SpeechRecognition);

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      
      // Configure recognition for better stability
      recognition.continuous = false; // Stop after each sentence (more stable)
      recognition.interimResults = true; // Show interim results in real-time
      recognition.lang = 'en-US';
      recognition.maxAlternatives = 1;

      // Handle results
      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' ';
          } else {
            interimTranscript += transcript;
          }
        }

        // Update current transcript for real-time display (show both interim and final)
        const fullTranscript = finalTranscript + interimTranscript;
        
        // Always update display for real-time feedback
        if (fullTranscript.trim().length > 0) {
          setCurrentTranscript(fullTranscript.trim());
          
          // Send transcript to parent component ONLY when final results are available
          if (finalTranscript.trim()) {
            onTranscript(finalTranscript.trim());
          }
        }
      };

      // Handle errors with better error handling
      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error:', event.error);
        
        // Handle specific network errors
        if (event.error === 'network') {
          console.log('Network error detected - this is usually temporary');
          // Don't stop listening on network errors, the service will auto-restart
          // Just log it and let the user continue
          return;
        }
        
        // Handle aborted error - this is not really an error, just a signal that recognition was stopped
        if (event.error === 'aborted') {
          console.log('Speech recognition was aborted - this is normal if user stopped it');
          // Don't show error to user, just stop listening
          setIsListening(false);
          return;
        }
        
        setIsListening(false);
        
        // For other errors, reset retry count and show message immediately
        retryCountRef.current = 0;
        const errorMessage = getErrorMessage(event.error);
        onError?.(errorMessage);
      };

      // Handle speech end - let it end naturally when user stops speaking
      recognition.onend = () => {
        console.log('Speech recognition ended naturally');
        setIsListening(false);
      };

      // Handle speech start
      recognition.onstart = () => {
        setCurrentTranscript('');
        retryCountRef.current = 0; // Reset retry count on successful start
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [onTranscript, onError, isListening]);

  const getErrorMessage = (error: string): string => {
    switch (error) {
      case 'no-speech':
        return 'No speech detected. Try speaking closer to the microphone.';
      case 'audio-capture':
        return 'Microphone access failed. Please check your device settings.';
      case 'not-allowed':
        return 'Microphone permission denied. Please enable microphone access in your browser settings.';
      case 'network':
        return 'Network error. Speech recognition requires an internet connection. Please check your connection and try again.';
      case 'aborted':
        return 'Speech recognition stopped.';
      case 'service-not-allowed':
        return 'Speech recognition service not available. Please try again later.';
      default:
        return `Speech recognition error: ${error}. Please try again.`;
    }
  };

  const startListening = async () => {
    if (!isSupported || !recognitionRef.current || disabled) return;

    // Reset retry count when manually starting
    retryCountRef.current = 0;

    try {
      // Check if we're online
      if (!navigator.onLine) {
        onError?.('You are offline. Speech recognition requires an internet connection.');
        return;
      }

      // Request microphone permission first
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (permError) {
        console.error('Microphone permission error:', permError);
        if (permError instanceof DOMException && permError.name === 'NotAllowedError') {
          onError?.('Microphone permission denied. Please enable microphone access in your browser settings and try again.');
          return;
        }
        throw permError;
      }
      
      // Start recognition with additional error handling
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
          setIsListening(true);
          console.log('Speech recognition started successfully');
        } catch (startError) {
          console.error('Recognition start error:', startError);
          
          // Check if it's already started
          if (startError instanceof DOMException && startError.name === 'InvalidStateError') {
            console.log('Recognition already running, stopping first...');
            recognitionRef.current.stop();
            
            // Retry after a short delay
            setTimeout(() => {
              if (recognitionRef.current) {
                try {
                  recognitionRef.current.start();
                  setIsListening(true);
                } catch (retryErr) {
                  console.error('Retry start failed:', retryErr);
                  setIsListening(false);
                  onError?.('Failed to start speech recognition. Please try again.');
                }
              }
            }, 500);
          } else {
            throw startError;
          }
        }
      }

    } catch (error) {
      console.error('Failed to start speech recognition:', error);
      setIsListening(false);
      
      if (error instanceof DOMException) {
        if (error.name === 'NotAllowedError') {
          onError?.('Microphone permission denied. Please allow microphone access in your browser settings and try again.');
        } else if (error.name === 'NotFoundError') {
          onError?.('No microphone found. Please connect a microphone and try again.');
        } else if (error.name === 'InvalidStateError') {
          onError?.('Speech recognition is already running. Please wait a moment and try again.');
        } else {
          onError?.(`Microphone error: ${error.message}`);
        }
      } else {
        onError?.('Failed to start speech recognition. Please try again.');
      }
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      setCurrentTranscript(''); // Clear transcript when stopping
      // Reset retry count when manually stopping
      retryCountRef.current = 0;
    }
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  if (!isSupported) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled
        className={cn('gap-2 opacity-50', className)}
        title="Speech recognition is not supported in this browser"
      >
        <MicOff className="h-4 w-4" />
        <span className="sr-only">Speech recognition not supported</span>
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <Button
        type="button"
        variant={isListening ? "destructive" : "outline"}
        size="sm"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          toggleListening();
        }}
        disabled={disabled}
        className={cn(
          'gap-2 transition-all duration-300 relative overflow-hidden',
          isListening && 'bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 shadow-lg animate-pulse',
          !isListening && 'hover:bg-accent/50 hover:scale-105',
          className
        )}
        title={isListening ? 'Stop listening' : 'Start voice input'}
      >
        {isListening ? (
          <>
            <div className="absolute inset-0 bg-gradient-to-r from-red-400/20 to-pink-500/20 animate-ping"></div>
            <Square className="h-4 w-4 relative z-10" />
            <span className="relative z-10">Stop</span>
          </>
        ) : (
          <>
            <Mic className="h-4 w-4" />
            Speak
          </>
        )}
      </Button>
      
      {isListening && currentTranscript && (
        <div className="flex items-center gap-2">
          <div className="flex space-x-1">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-2 h-2 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
          <div className="text-sm text-muted-foreground bg-accent/50 px-3 py-2 rounded-lg max-w-xs truncate border border-accent shadow-sm">
            {currentTranscript}
          </div>
        </div>
      )}
    </div>
  );
}