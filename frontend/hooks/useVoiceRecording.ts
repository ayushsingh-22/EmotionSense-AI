'use client'

import { useState, useRef, useCallback } from 'react'

interface UseVoiceRecordingOptions {
  onRecordingComplete?: (audioBlob: Blob) => void
  onError?: (error: string) => void
  maxDuration?: number // in milliseconds
}

interface UseVoiceRecordingReturn {
  isRecording: boolean
  isSupported: boolean
  startRecording: () => Promise<void>
  stopRecording: () => Promise<Blob | null>
  duration: number
}

export const useVoiceRecording = ({
  onRecordingComplete,
  onError,
  maxDuration = 300000 // 5 minutes default
}: UseVoiceRecordingOptions = {}): UseVoiceRecordingReturn => {
  const [isRecording, setIsRecording] = useState(false)
  const [duration, setDuration] = useState(0)
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const maxDurationTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Check if browser supports MediaRecorder
  const isSupported = typeof window !== 'undefined' && 
    'MediaRecorder' in window && 
    'navigator' in window && 
    'mediaDevices' in navigator

  const cleanup = useCallback(() => {
    // Clear duration interval
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current)
      durationIntervalRef.current = null
    }

    // Clear max duration timeout
    if (maxDurationTimeoutRef.current) {
      clearTimeout(maxDurationTimeoutRef.current)
      maxDurationTimeoutRef.current = null
    }

    // Stop all tracks in the stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }

    // Reset state
    setIsRecording(false)
    setDuration(0)
    audioChunksRef.current = []
  }, [])

  const startRecording = useCallback(async () => {
    if (!isSupported) {
      onError?.('Voice recording is not supported in this browser')
      return
    }

    if (isRecording) {
      return // Already recording
    }

    try {
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100
        }
      })

      streamRef.current = stream

      // Create MediaRecorder with optimal settings
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4'

      const mediaRecorder = new MediaRecorder(stream, { 
        mimeType,
        audioBitsPerSecond: 128000 
      })

      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      // Set up event handlers
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        if (audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, { type: mimeType })
          onRecordingComplete?.(audioBlob)
        }
        cleanup()
      }

      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event)
        onError?.('Recording failed. Please try again.')
        cleanup()
      }

      // Start recording
      mediaRecorder.start(100) // Collect data every 100ms
      setIsRecording(true)

      // Start duration timer
      const startTime = Date.now()
      durationIntervalRef.current = setInterval(() => {
        setDuration(Date.now() - startTime)
      }, 100)

      // Set maximum duration timeout
      maxDurationTimeoutRef.current = setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.stop()
          onError?.(`Recording stopped automatically after ${maxDuration / 1000} seconds`)
        }
      }, maxDuration)

    } catch (error) {
      console.error('Failed to start recording:', error)
      
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          onError?.('Microphone permission denied. Please allow microphone access.')
        } else if (error.name === 'NotFoundError') {
          onError?.('No microphone found. Please connect a microphone.')
        } else if (error.name === 'NotSupportedError') {
          onError?.('Voice recording is not supported in this browser.')
        } else {
          onError?.('Failed to start recording. Please try again.')
        }
      } else {
        onError?.('An unexpected error occurred while starting recording.')
      }
      
      cleanup()
    }
  }, [isSupported, isRecording, onRecordingComplete, onError, maxDuration, cleanup])

  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    if (!isRecording || !mediaRecorderRef.current) {
      return null
    }

    return new Promise((resolve) => {
      const mediaRecorder = mediaRecorderRef.current!
      
      // Set up one-time stop handler
      const handleStop = () => {
        mediaRecorder.removeEventListener('stop', handleStop)
        
        if (audioChunksRef.current.length > 0) {
          const mimeType = mediaRecorder.mimeType
          const audioBlob = new Blob(audioChunksRef.current, { type: mimeType })
          resolve(audioBlob)
        } else {
          resolve(null)
        }
      }

      mediaRecorder.addEventListener('stop', handleStop)
      
      // Stop recording
      if (mediaRecorder.state === 'recording') {
        mediaRecorder.stop()
      } else {
        // If not recording, resolve immediately
        resolve(null)
      }
    })
  }, [isRecording])

  return {
    isRecording,
    isSupported,
    startRecording,
    stopRecording,
    duration
  }
}

export default useVoiceRecording