'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Activity, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  getDailyInsights, 
  getWeeklyInsights,
  type DailyInsight,
  type WeeklyInsight
} from '@/lib/insightsApi';
import { WeeklyMoodJourney } from '@/components/insights/WeeklyMoodJourney';
import { TodayEmotionalFlow } from '@/components/insights/TodayEmotionalFlow';
import { MinimalistWeeklyChart } from '@/components/insights/MinimalistWeeklyChart';
import { format, parseISO } from 'date-fns';

export default function InsightsPage() {
  const { user } = useAuth();
  const [dailyInsights, setDailyInsights] = useState<DailyInsight[]>([]);
  const [weeklyInsights, setWeeklyInsights] = useState<WeeklyInsight[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    if (!user?.id) return;
    
    setIsLoading(true);
    try {
      const [daily, weekly] = await Promise.all([
        getDailyInsights(user.id),
        getWeeklyInsights(user.id, 4)
      ]);

      setDailyInsights(daily);
      setWeeklyInsights(weekly);
    } catch (error) {
      console.error('Error loading insights:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Please sign in to view your insights.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl space-y-8">
      {/* Clean Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Insights</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your emotional journey at a glance
        </p>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center space-y-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="text-sm text-muted-foreground">Loading insights...</p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && dailyInsights.length === 0 && weeklyInsights.length === 0 && (
        <Card className="border border-border">
          <CardContent className="p-12 text-center">
            <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <p className="text-sm text-muted-foreground">
              No insights yet. Start chatting to track your emotions!
            </p>
          </CardContent>
        </Card>
      )}

      {/* Today's Emotional Flow - Premium Component */}
      {!isLoading && dailyInsights.length > 0 && (
        <TodayEmotionalFlow insight={dailyInsights[0]} />
      )}

      {/* Weekly Mood Journey - 30 Day Timeline */}
      {!isLoading && weeklyInsights.length > 0 && (
        <WeeklyMoodJourney weeklyInsights={weeklyInsights} />
      )}

      {/* Weekly Trends - Collapsible Weekly Cards */}
      {!isLoading && weeklyInsights.map((week, idx) => {
        // State needs to be inside the component, so we'll use a separate component
        return <CollapsibleWeekCard key={idx} week={week} index={idx} />;
      })}
    </div>
  );
}

// Collapsible Week Card Component
function CollapsibleWeekCard({ week, index }: { week: WeeklyInsight; index: number }) {
  const [isOpen, setIsOpen] = useState(index === 0); // First card open by default

  return (
    <Card className="border border-border overflow-hidden">
      <div 
        className="bg-gradient-to-r from-primary/10 via-primary/5 to-background p-6 cursor-pointer hover:from-primary/15 hover:via-primary/8 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h3 className="text-lg font-semibold">
              {index === 0 ? 'This Week' : `${index === 1 ? 'Last Week' : format(parseISO(week.week_start), 'MMM d')} - ${format(parseISO(week.week_end), 'MMM d')}`}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {week.active_days} active days • {week.total_activities} activities
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Avg Mood</p>
              <p className="text-4xl font-bold text-primary">{Math.round(week.avg_mood_score)}</p>
            </div>
            <motion.div
              animate={{ rotate: isOpen ? 180 : 0 }}
              transition={{ duration: 0.3 }}
              className="ml-2"
            >
              <ChevronDown className="h-6 w-6 text-muted-foreground" />
            </motion.div>
          </div>
        </div>
      </div>
      
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <CardContent className="p-6 space-y-6">
              {/* Reflection Text */}
              {week.reflection_text && (
                <div className="bg-muted/30 rounded-lg p-4 border-l-4 border-primary">
                  <p className="text-sm text-foreground/90 italic">
                    &quot;{week.reflection_text}&quot;
                  </p>
                </div>
              )}

              {/* Weekly Chart */}
              <MinimalistWeeklyChart 
                dailyArc={week.daily_arc}
                weekStart={week.week_start}
                weekEnd={week.week_end}
              />
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
