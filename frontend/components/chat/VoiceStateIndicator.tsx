'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Mic, Loader2, Volume2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export type VoiceState = 'idle' | 'listening' | 'processing' | 'responding'

interface VoiceStateIndicatorProps {
  state: VoiceState
  className?: string
}

export const VoiceStateIndicator: React.FC<VoiceStateIndicatorProps> = ({ state, className }) => {
  const getStateConfig = (state: VoiceState) => {
    switch (state) {
      case 'listening':
        return {
          icon: Mic,
          color: 'text-blue-500',
          bgColor: 'bg-blue-100 dark:bg-blue-900/30',
          label: 'Listening...',
          animation: true
        }
      case 'processing':
        return {
          icon: Loader2,
          color: 'text-yellow-500',
          bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
          label: 'Processing...',
          animation: true
        }
      case 'responding':
        return {
          icon: Volume2,
          color: 'text-green-500',
          bgColor: 'bg-green-100 dark:bg-green-900/30',
          label: 'Responding...',
          animation: false
        }
      default:
        return null
    }
  }

  const config = getStateConfig(state)
  if (!config) return null

  const { icon: Icon, color, bgColor, label, animation } = config

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      className={cn(
        "flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium",
        bgColor,
        color,
        className
      )}
    >
      <Icon 
        className={cn(
          "h-3 w-3",
          animation && state === 'processing' && "animate-spin"
        )}
      />
      <span>{label}</span>
      
      {/* Pulsing animation for listening state */}
      {state === 'listening' && (
        <motion.div
          className="w-2 h-2 rounded-full bg-current"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.6, 1, 0.6]
          }}
          transition={{
            duration: 1,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      )}
    </motion.div>
  )
}

export default VoiceStateIndicator