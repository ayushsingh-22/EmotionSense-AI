'use client';

import { motion } from 'framer-motion';
import { ReactNode } from 'react';
import { Card, CardContent, CardHeader } from './card';

interface GlassPanelProps {
  children: ReactNode;
  title?: string;
  icon?: ReactNode;
  gradient?: string;
  className?: string;
  delay?: number;
  hoverable?: boolean;
}

export function GlassPanel({ 
  children, 
  title, 
  icon, 
  gradient = 'from-purple-500/10',
  className = '',
  delay = 0,
  hoverable = true
}: GlassPanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      whileHover={hoverable ? { scale: 1.02, y: -4 } : undefined}
    >
      <Card className={`overflow-hidden border-2 border-border/50 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br ${gradient} via-background to-background backdrop-blur-sm ${className}`}>
        {title && (
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              {icon && (
                <motion.div 
                  className="p-3 rounded-xl bg-gradient-to-br from-primary to-primary/60 shadow-md"
                  animate={{
                    boxShadow: [
                      '0 0 20px rgba(168, 85, 247, 0.3)',
                      '0 0 40px rgba(168, 85, 247, 0.5)',
                    ],
                  }}
                  transition={{ 
                    duration: 2, 
                    repeat: Infinity, 
                    repeatType: "reverse",
                    ease: "easeInOut" 
                  }}
                >
                  {icon}
                </motion.div>
              )}
              <h3 className="text-xl font-semibold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                {title}
              </h3>
            </div>
          </CardHeader>
        )}
        <CardContent className={title ? '' : 'pt-6'}>
          {children}
        </CardContent>
      </Card>
    </motion.div>
  );
}
