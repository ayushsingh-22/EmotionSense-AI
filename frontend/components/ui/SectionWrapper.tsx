'use client';

import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface SectionWrapperProps {
  children: ReactNode;
  delay?: number;
  className?: string;
  fadeIn?: boolean;
}

export function SectionWrapper({ 
  children, 
  delay = 0,
  className = '',
  fadeIn = true
}: SectionWrapperProps) {
  if (!fadeIn) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
