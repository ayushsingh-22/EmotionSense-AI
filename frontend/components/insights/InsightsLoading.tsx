/**
 * InsightsLoading - Premium loading skeletons for insights components
 */

'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export const DailyViewSkeleton = React.memo(() => {
  return (
    <div className="space-y-6">
      {[1, 2].map((i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1 }}
        >
          <Card className="overflow-hidden border-2 border-border/50">
            <div className="bg-gradient-to-r from-primary/20 to-primary/10 p-6">
              <Skeleton className="h-6 w-64 mb-2" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-12 w-full mt-4" />
            </div>
            <CardContent className="p-6 space-y-4">
              <Skeleton className="h-24 w-full rounded-2xl" />
              <Skeleton className="h-32 w-full rounded-xl" />
              <div className="flex gap-2">
                <Skeleton className="h-20 flex-1 rounded-xl" />
                <Skeleton className="h-20 flex-1 rounded-xl" />
                <Skeleton className="h-20 flex-1 rounded-xl" />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
});

DailyViewSkeleton.displayName = 'DailyViewSkeleton';

export const WeeklyViewSkeleton = React.memo(() => {
  return (
    <div className="space-y-6">
      {[1, 2].map((i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1 }}
        >
          <Card className="overflow-hidden border-2 border-border/50">
            <div className="bg-gradient-to-r from-primary/20 to-primary/10 p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1">
                  <Skeleton className="h-16 w-16 rounded-2xl" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-6 w-48" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                </div>
                <Skeleton className="h-10 w-10 rounded-full" />
              </div>
            </div>
            <CardContent className="p-6 space-y-4">
              <Skeleton className="h-48 w-full rounded-2xl" />
              <Skeleton className="h-32 w-full rounded-2xl" />
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
});

WeeklyViewSkeleton.displayName = 'WeeklyViewSkeleton';

export const TimelineViewSkeleton = React.memo(() => {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4].map((i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
        >
          <Card className="border-2 border-border/50">
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                <Skeleton className="h-16 w-16 rounded-2xl shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-4 w-48" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
});

TimelineViewSkeleton.displayName = 'TimelineViewSkeleton';

export const StatsCardSkeleton = React.memo(() => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {[1, 2, 3].map((i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1 }}
        >
          <Card className="overflow-hidden border-2 border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <Skeleton className="h-14 w-14 rounded-2xl" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-16" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
});

StatsCardSkeleton.displayName = 'StatsCardSkeleton';
