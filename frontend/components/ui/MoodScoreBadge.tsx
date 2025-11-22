"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface MoodScoreBadgeProps {
  score: number | null;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

const getMoodColor = (score: number) => {
  if (score >= 75) return "bg-green-500/80 text-green-50 border-green-500/60";
  if (score >= 60) return "bg-green-400/80 text-green-50 border-green-400/60";
  if (score >= 45) return "bg-yellow-500/80 text-yellow-50 border-yellow-500/60";
  if (score >= 30) return "bg-orange-500/80 text-orange-50 border-orange-500/60";
  return "bg-red-500/80 text-red-50 border-red-500/60";
};

const getMoodEmoji = (score: number) => {
  if (score >= 75) return "😊";
  if (score >= 60) return "🙂";
  if (score >= 45) return "😐";
  if (score >= 30) return "😕";
  return "😢";
};

const getMoodLabel = (score: number) => {
  if (score >= 75) return "Great";
  if (score >= 60) return "Good";
  if (score >= 45) return "Okay";
  if (score >= 30) return "Low";
  return "Poor";
};

export function MoodScoreBadge({ score, size = 'md', showLabel = false, className }: MoodScoreBadgeProps) {
  if (score === null || score === undefined) {
    return (
      <div className={cn(
        "inline-flex items-center justify-center rounded-full border bg-gray-200/80 text-gray-600 border-gray-300/60",
        size === 'sm' && "h-5 w-5 text-[10px]",
        size === 'md' && "h-6 w-6 text-xs",
        size === 'lg' && "h-8 w-8 text-sm",
        className
      )}>
        <span>—</span>
      </div>
    );
  }

  const sizeClasses = {
    sm: "h-5 min-w-[1.25rem] px-1 text-[10px] font-medium",
    md: "h-6 min-w-[1.5rem] px-1.5 text-xs font-medium",
    lg: "h-8 min-w-[2rem] px-2 text-sm font-semibold"
  };

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.2, type: "spring", stiffness: 300 }}
      className={cn(
        "inline-flex items-center justify-center rounded-full border font-medium transition-all",
        getMoodColor(score),
        sizeClasses[size],
        className
      )}
      title={`Mood Score: ${score}/100 (${getMoodLabel(score)})`}
    >
      {showLabel ? (
        <span className="flex items-center gap-1">
          <span>{getMoodEmoji(score)}</span>
          <span>{score}</span>
        </span>
      ) : (
        <span>{score}</span>
      )}
    </motion.div>
  );
}

export { getMoodColor, getMoodEmoji, getMoodLabel };