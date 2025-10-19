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
    // Check if speech recognition is supported
    const SpeechRecognition = window.SpeechRecognition || 
                             window.webkitSpeechRecognition;
    
    setIsSupported(!!SpeechRecognition);

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      
      // Configure recognition for better network stability
      recognition.continuous = false; // Changed to false to reduce network issues
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      recognition.maxAlternatives = 1;

      // Handle results
      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        // Update current transcript for real-time display
        const fullTranscript = finalTranscript + interimTranscript;
        setCurrentTranscript(fullTranscript);
        
        // Send transcript to parent component
        if (fullTranscript.trim()) {
          onTranscript(fullTranscript.trim());
        }
      };

      // Handle errors with retry logic
      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        
        // Handle specific network errors with limited retry
        if (event.error === 'network' && retryCountRef.current < 2) {
          console.log(`Network error detected, attempting retry ${retryCountRef.current + 1}/2...`);
          retryCountRef.current += 1;
          
          // Don't immediately show error for network issues - try to restart
          setTimeout(() => {
            if (recognitionRef.current && retryCountRef.current <= 2) {
              console.log('Retrying speech recognition...');
              try {
                recognitionRef.current.start();
                setIsListening(true);
              } catch (retryError) {
                console.error('Retry failed:', retryError);
                retryCountRef.current = 0;
                onError?.('Speech recognition network error. Please check your internet connection and try again.');
              }
            }
          }, 1000);
        } else if (event.error === 'network') {
          // Too many network failures
          retryCountRef.current = 0;
          onError?.('Speech recognition is having network connectivity issues. Please check your internet connection and try again later.');
        } else {
          // For other errors, reset retry count and show message immediately
          retryCountRef.current = 0;
          const errorMessage = getErrorMessage(event.error);
          onError?.(errorMessage);
        }
      };

      // Handle speech end with auto-restart for continuous listening
      recognition.onend = () => {
        if (isListening) {
          // Auto-restart if we were still listening (since continuous = false)
          setTimeout(() => {
            if (isListening && recognitionRef.current) {
              try {
                recognitionRef.current.start();
              } catch (error) {
                console.error('Auto-restart failed:', error);
                setIsListening(false);
              }
            }
          }, 100);
        } else {
          setIsListening(false);
        }
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
  }, [onTranscript, onError]);

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
      await navigator.mediaDevices.getUserMedia({ audio: true });
      
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
                recognitionRef.current.start();
                setIsListening(true);
              }
            }, 500);
          } else {
            throw startError;
          }
        }
      }

    } catch (error) {
      console.error('Failed to start speech recognition:', error);
      
      if (error instanceof DOMException) {
        if (error.name === 'NotAllowedError') {
          onError?.('Microphone permission denied. Please allow microphone access and try again.');
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