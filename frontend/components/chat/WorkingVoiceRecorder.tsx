"use client"

import React, { useState, useRef, useEffect, useCallback } from "react"
import { motion } from "framer-motion"
import { Mic, Square, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface VoiceRecorderProps {
  onVoiceMessage: (audio: Blob) => Promise<void>
  disabled?: boolean
  className?: string
}

export const WorkingVoiceRecorder: React.FC<VoiceRecorderProps> = ({
  onVoiceMessage,
  disabled = false,
  className
}) => {
  const [status, setStatus] = useState<"idle" | "recording" | "processing">("idle")
  const [duration, setDuration] = useState(0)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }

    chunksRef.current = []
    setDuration(0)
  }, [])

  useEffect(() => cleanup, [cleanup])

  const startRecording = useCallback(async () => {
    if (disabled || status !== "idle") return

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" })
      mediaRecorderRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = (e) => chunksRef.current.push(e.data)

      recorder.start()

      setStatus("recording")

      const startTime = Date.now()
      timerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTime) / 1000))
      }, 1000)
    } catch (err) {
      console.error("Recording failed:", err)
      cleanup()
      setStatus("idle")
    }
  }, [status, disabled, cleanup])

  const stopRecording = useCallback(async () => {
    if (status !== "recording") return

    setStatus("processing")

    if (timerRef.current) clearInterval(timerRef.current)

    const recorder = mediaRecorderRef.current
    if (!recorder) return

    // Stop stream tracks BEFORE stopping recorder to ensure data is flushed
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }

    const stopPromise = new Promise<void>((resolve) => {
      recorder.onstop = () => resolve()
    })

    recorder.stop()
    await stopPromise

    // Create blob BEFORE cleanup clears chunksRef
    const audioData = chunksRef.current
    const blob = new Blob(audioData, { type: "audio/webm" })

    console.log(`🎙️ Audio blob created: ${blob.size} bytes, chunks: ${audioData.length}`)

    // Now cleanup (but don't clear chunks yet - we did it above)
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
    chunksRef.current = []
    mediaRecorderRef.current = null

    try {
      await onVoiceMessage(blob)
    } catch (err) {
      console.error("Error sending voice message:", err)
    }

    setStatus("idle")
  }, [status, onVoiceMessage])

  const handleClick = () =>
    status === "recording" ? stopRecording() : startRecording()

  const config = {
    idle: { icon: Mic, color: "bg-blue-500 hover:bg-blue-600", label: "Start" },
    recording: { icon: Square, color: "bg-red-500 hover:bg-red-600", label: "Stop" },
    processing: { icon: Loader2, color: "bg-yellow-500", label: "Processing..." }
  }[status]

  const Icon = config.icon

  return (
    <div className={cn("flex flex-col items-center justify-center gap-3", className)}>
      {status === "recording" && (
        <div className="flex items-center gap-2 text-red-600 text-sm font-medium">
          <motion.div
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
            className="w-2.5 h-2.5 bg-red-500 rounded-full"
          />
          Recording… {duration}s
        </div>
      )}

      {status === "processing" && (
        <div className="flex items-center gap-2 text-yellow-600 text-sm font-medium">
          <Loader2 className="w-4 h-4 animate-spin" /> Processing…
        </div>
      )}

      <Button
        className={cn(
          "w-16 h-16 rounded-full border-4 border-white shadow-lg text-white transition-all duration-200",
          config.color,
          status === "processing" && "opacity-50 cursor-not-allowed scale-95"
        )}
        onClick={handleClick}
        disabled={status === "processing"}
        title={status === "idle" ? "Click to start recording" : status === "recording" ? "Click to stop recording" : "Processing..."}
      >
        <Icon className={cn("w-7 h-7", status === "processing" && "animate-spin")} />
      </Button>

      <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
        {status === "recording"
          ? "Click stop button or tap again to finish"
          : status === "processing"
          ? "Processing your voice..."
          : "Tap to start recording"}
      </p>
    </div>
  )
}

export default WorkingVoiceRecorder
