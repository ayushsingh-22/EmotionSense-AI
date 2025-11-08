'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Send, Mic, Type, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import WorkingVoiceRecorder from './WorkingVoiceRecorder'

export type VoiceState = 'idle' | 'listening' | 'processing' | 'responding'

interface NewUnifiedChatInputProps {
  onSendMessage: (message: string) => void
  onVoiceMessage: (audioBlob: Blob) => Promise<void>
  disabled?: boolean
  className?: string
  placeholder?: string
}

export const NewUnifiedChatInput: React.FC<NewUnifiedChatInputProps> = ({
  onSendMessage,
  onVoiceMessage,
  disabled = false,
  className,
  placeholder = "Type your message..."
}) => {
  const [mode, setMode] = useState<'text' | 'voice'>('text')
  const [message, setMessage] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
    }
  }, [message])

  const handleSendMessage = () => {
    if (message.trim() && !disabled) {
      onSendMessage(message.trim())
      setMessage('')
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const toggleMode = () => {
    setMode(prev => prev === 'text' ? 'voice' : 'text')
  }

  return (
    <div className={cn("w-full", className)}>
      <AnimatePresence mode="wait">
        {mode === 'text' ? (
          <motion.div
            key="text-mode"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex flex-col gap-2"
          >
            {/* Text Input Area */}
            <div className="flex items-end gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow duration-200">
              {/* Mode Toggle Button */}
              <Button
                onClick={toggleMode}
                variant="ghost"
                size="sm"
                className="w-9 h-9 rounded-lg p-0 hover:bg-gray-200 dark:hover:bg-gray-700 flex-shrink-0"
                disabled={disabled}
                title="Switch to voice mode"
              >
                <Mic className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              </Button>

              {/* Text Input */}
              <Textarea
                ref={textareaRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder={placeholder}
                disabled={disabled}
                className="flex-1 min-h-[36px] max-h-24 resize-none border-0 bg-transparent p-0 text-sm placeholder:text-gray-400 focus-visible:ring-0 focus-visible:ring-offset-0 dark:text-white"
                rows={1}
              />

              {/* Send Button */}
              <Button
                onClick={handleSendMessage}
                disabled={disabled || !message.trim()}
                size="sm"
                className="w-9 h-9 rounded-lg p-0 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 flex-shrink-0 transition-colors duration-200"
                title="Send message (Ctrl+Enter)"
              >
                <Send className="h-4 w-4 text-white" />
              </Button>
            </div>

            {/* Mode Switch Hint */}
            <div className="flex items-center justify-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <Type className="h-3 w-3" />
              <span>Text mode</span>
              <span>•</span>
              <button
                onClick={toggleMode}
                className="text-blue-500 hover:text-blue-600 dark:text-blue-400 hover:underline"
              >
                Switch to voice
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="voice-mode"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex flex-col gap-2"
          >
            {/* Voice Recording Area - Compact */}
            <div className="relative p-4 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 rounded-xl border-2 border-blue-200 dark:border-blue-700">
              {/* Close/Switch Mode Button */}
              <Button
                onClick={toggleMode}
                variant="ghost"
                size="sm"
                className="absolute top-2 right-2 w-7 h-7 rounded-full p-0 hover:bg-blue-200 dark:hover:bg-blue-700 text-gray-600 dark:text-gray-300"
                disabled={disabled}
                title="Switch to text mode"
              >
                <X className="h-3.5 w-3.5" />
              </Button>

              {/* Voice Recorder */}
              <WorkingVoiceRecorder
                onVoiceMessage={onVoiceMessage}
                disabled={disabled}
                className="w-full"
              />
            </div>

            {/* Quick Info */}
            <div className="flex items-center justify-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <Mic className="h-3 w-3" />
              <span>Voice mode</span>
              <span>•</span>
              <button
                onClick={toggleMode}
                className="text-blue-500 hover:text-blue-600 dark:text-blue-400 hover:underline"
              >
                Switch to text
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default NewUnifiedChatInput