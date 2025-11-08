'use client'

import React, { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, Square, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type VoiceState = 'idle' | 'listening' | 'processing' | 'responding'

interface SimpleVoiceRecorderProps {
  onVoiceMessage: (audioBlob: Blob) => Promise<void>
  disabled?: boolean
  className?: string
}

export const SimpleVoiceRecorder: React.FC<SimpleVoiceRecorderProps> = ({
  onVoiceMessage,
  disabled = false,
  className
}) => {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle')
  const [duration, setDuration] = useState(0)
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Cleanup function
  const cleanup = useCallback(() => {
    console.log('🧹 Cleaning up voice recorder...')
    
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current)
      durationIntervalRef.current = null
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop()
        console.log('🔇 Audio track stopped')
      })
      streamRef.current = null
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }

    audioChunksRef.current = []
    setDuration(0)
    console.log('🧹 Cleanup completed')
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return cleanup
  }, [cleanup])

  // Start recording
  const startRecording = useCallback(async () => {
    if (voiceState !== 'idle' || disabled) {
      console.log('❌ Cannot start recording - state:', voiceState, 'disabled:', disabled)
      return
    }

    try {
      console.log('🎤 Starting voice recording...')
      setVoiceState('listening')
      
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      })

      streamRef.current = stream
      audioChunksRef.current = []

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      })

      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
          console.log('📦 Audio chunk received:', event.data.size, 'bytes')
        }
      }

      mediaRecorder.onstop = async () => {
        console.log('🎤 MediaRecorder stopped, processing audio...')
        
        if (audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, { 
            type: mediaRecorder.mimeType 
          })
          
          console.log('📤 Sending audio blob:', audioBlob.size, 'bytes')
          setVoiceState('processing')
          
          try {
            await onVoiceMessage(audioBlob)
            setVoiceState('responding')
            
            // Reset after a delay
            setTimeout(() => {
              setVoiceState('idle')
            }, 3000)
          } catch (error) {
            console.error('❌ Voice message processing failed:', error)
            setVoiceState('idle')
          }
        } else {
          console.log('⚠️ No audio data recorded')
          setVoiceState('idle')
        }
        
        cleanup()
      }

      mediaRecorder.onerror = (event) => {
        console.error('❌ MediaRecorder error:', event)
        setVoiceState('idle')
        cleanup()
      }

      mediaRecorder.start(1000) // Collect data every second
      
      // Start duration counter
      const startTime = Date.now()
      durationIntervalRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTime) / 1000))
      }, 1000)

      console.log('✅ Recording started successfully')
      
    } catch (error) {
      console.error('❌ Failed to start recording:', error)
      setVoiceState('idle')
      cleanup()
    }
  }, [voiceState, disabled, onVoiceMessage, cleanup])

  // Stop recording
  const stopRecording = useCallback(() => {
    console.log('🛑 Stop recording requested - current state:', voiceState)
    
    if (voiceState !== 'listening') {
      console.log('⚠️ Not in listening state, ignoring stop request')
      return
    }

    console.log('🛑 Stopping recording...')
    
    // Stop the media recorder
    if (mediaRecorderRef.current) {
      if (mediaRecorderRef.current.state === 'recording') {
        console.log('🛑 Stopping MediaRecorder...')
        mediaRecorderRef.current.stop()
      } else {
        console.log('⚠️ MediaRecorder not in recording state:', mediaRecorderRef.current.state)
      }
    }

    // Stop duration counter immediately
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current)
      durationIntervalRef.current = null
    }

    console.log('🛑 Stop recording process initiated')
  }, [voiceState])

  // Toggle recording
  const toggleRecording = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    console.log('🎯 Toggle recording clicked - voiceState:', voiceState, 'disabled:', disabled)
    
    if (voiceState === 'listening') {
      stopRecording()
    } else if (voiceState === 'idle') {
      startRecording()
    } else {
      console.log('⚠️ Cannot toggle in current state:', voiceState)
    }
  }, [voiceState, disabled, startRecording, stopRecording])

  // Get button appearance based on state
  const getButtonConfig = () => {
    if (voiceState === 'processing') {
      return {
        icon: Loader2,
        color: 'bg-yellow-500 hover:bg-yellow-600 border-yellow-300',
        iconClass: 'animate-spin'
      }
    } else if (voiceState === 'listening') {
      return {
        icon: Square,
        color: 'bg-red-500 hover:bg-red-600 border-red-300',
        iconClass: ''
      }
    } else {
      return {
        icon: Mic,
        color: 'bg-blue-500 hover:bg-blue-600 border-blue-300',
        iconClass: ''
      }
    }
  }

  const buttonConfig = getButtonConfig()
  const IconComponent = buttonConfig.icon

  return (
    <div className={cn("flex flex-col items-center gap-4 p-4", className)}>
      {/* Voice state indicator */}
      <AnimatePresence mode="wait">
        {voiceState === 'listening' && (
          <motion.div
            key="listening"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-2 text-blue-600 dark:text-blue-400"
          >
            <div className="flex items-center gap-1">
              {Array.from({ length: 4 }).map((_, i) => (
                <motion.div
                  key={i}
                  className="w-1 bg-current rounded-full"
                  animate={{
                    height: [8, 20, 12, 16, 8],
                  }}
                  transition={{
                    duration: 1.2,
                    repeat: Infinity,
                    delay: i * 0.1,
                    ease: "easeInOut"
                  }}
                />
              ))}
            </div>
            <span className="text-sm font-medium">
              Recording {duration > 0 && `${duration}s`}
            </span>
          </motion.div>
        )}
        
        {voiceState === 'processing' && (
          <motion.div
            key="processing"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400"
          >
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm font-medium">Processing...</span>
          </motion.div>
        )}
        
        {voiceState === 'responding' && (
          <motion.div
            key="responding"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-2 text-green-600 dark:text-green-400"
          >
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
              className="w-2 h-2 bg-current rounded-full"
            />
            <span className="text-sm font-medium">AI responding...</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main recording button */}
      <motion.div 
        className="relative"
        whileHover={{ scale: disabled ? 1 : 1.05 }}
        whileTap={{ scale: disabled ? 1 : 0.95 }}
      >
        <Button
          onClick={toggleRecording}
          disabled={disabled || voiceState === 'processing'}
          className={cn(
            "w-16 h-16 rounded-full border-4 transition-all duration-200",
            "shadow-lg hover:shadow-xl",
            buttonConfig.color,
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          <IconComponent className={cn("h-6 w-6 text-white", buttonConfig.iconClass)} />
        </Button>

        {/* Pulsing ring for recording state */}
        {voiceState === 'listening' && (
          <>
            <motion.div
              className="absolute inset-0 rounded-full border-4 border-red-400"
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
      </motion.div>

      {/* Instruction text */}
      <motion.p
        className={cn(
          "text-sm text-center transition-colors duration-200",
          voiceState === 'listening' ? "text-red-600 dark:text-red-400" : "text-gray-600 dark:text-gray-400"
        )}
        animate={{ opacity: 1 }}
        initial={{ opacity: 0 }}
      >
        {voiceState === 'listening' ? "Tap to stop recording" : "Tap to start recording"}
      </motion.p>
    </div>
  )
}

export default SimpleVoiceRecorder