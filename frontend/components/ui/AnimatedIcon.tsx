'use client';

import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface AnimatedIconProps {
  icon: ReactNode;
  gradient?: string;
  glowColor?: string;
  delay?: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'p-3 h-5 w-5',
  md: 'p-4 h-7 w-7',
  lg: 'p-5 h-9 w-9'
};

export function AnimatedIcon({ 
  icon, 
  gradient = 'from-purple-400 to-pink-500',
  glowColor = 'rgba(168, 85, 247, 0.3)',
  delay = 0,
  size = 'md',
  className = ''
}: AnimatedIconProps) {
  const sizeClass = sizeClasses[size];
  
  return (
    <motion.div 
      className={`rounded-2xl bg-gradient-to-br ${gradient} shadow-lg flex items-center justify-center ${className}`}
      animate={{
        boxShadow: [
          `0 0 20px ${glowColor}`,
          `0 0 30px ${glowColor.replace('0.3', '0.5')}`,
          `0 0 20px ${glowColor}`,
        ],
      }}
      transition={{ duration: 2, repeat: Infinity, delay }}
      whileHover={{ scale: 1.1, rotate: 5 }}
    >
      <div className={sizeClass.split(' ').slice(1).join(' ') + ' text-white flex items-center justify-center'}>
        {icon}
      </div>
    </motion.div>
  );
}
