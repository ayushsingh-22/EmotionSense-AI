'use client';

import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface GradientHeaderProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  className?: string;
}

export function GradientHeader({ title, subtitle, icon, className = '' }: GradientHeaderProps) {
  return (
    <motion.div 
      className={`flex flex-col gap-2 ${className}`}
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="flex items-center gap-3">
        {icon && (
          <motion.div
            animate={{ rotate: 5 }}
            transition={{ 
              duration: 2, 
              repeat: Infinity, 
              repeatType: "reverse",
              repeatDelay: 3 
            }}
          >
            {icon}
          </motion.div>
        )}
        <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
          {title}
        </h1>
      </div>
      {subtitle && (
        <p className="text-muted-foreground text-lg">
          {subtitle}
        </p>
      )}
    </motion.div>
  );
}
