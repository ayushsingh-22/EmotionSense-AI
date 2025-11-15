'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, TrendingUp, Clock, Sparkles } from 'lucide-react';
import { 
  getDailyInsights, 
  getWeeklyInsights, 
  getUserStats,
  getKeyMoments,
  type DailyInsight,
  type WeeklyInsight,
  type UserStats,
  type KeyMoment
} from '@/lib/insightsApi';
import { format, parseISO } from 'date-fns';
import { DailyView } from '@/components/insights/DailyView';
import { WeeklyView } from '@/components/insights/WeeklyView';
import { TimelineView } from '@/components/insights/TimelineView';
import { StatsCardSkeleton } from '@/components/insights/InsightsLoading';

export default function InsightsPage() {
  const { user } = useAuth();
  const [dailyInsights, setDailyInsights] = useState<DailyInsight[]>([]);
  const [weeklyInsights, setWeeklyInsights] = useState<WeeklyInsight[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [moments, setMoments] = useState<KeyMoment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState('daily');

  const loadData = async () => {
    if (!user?.id) return;
    
    setIsLoading(true);
    try {
      const [daily, weekly, userStats, keyMoments] = await Promise.all([
        getDailyInsights(user.id),
        getWeeklyInsights(user.id, 4),
        getUserStats(user.id),
        getKeyMoments(user.id)
      ]);

      setDailyInsights(daily);
      setWeeklyInsights(weekly);
      setStats(userStats);
      setMoments(keyMoments);
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
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground">Please sign in to view your emotion insights.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Animated Header Section */}
      <motion.div 
        className="flex flex-col gap-2"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
          Emotion Insights
        </h1>
        <p className="text-muted-foreground text-lg">
          Track your emotional journey and discover patterns ✨
        </p>
      </motion.div>

      {/* Premium Stats Overview Cards */}
      {isLoading ? (
        <StatsCardSkeleton />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            whileHover={{ scale: 1.02, y: -4 }}
          >
            <Card className="overflow-hidden border-2 border-border/50 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-yellow-500/10 via-background to-background backdrop-blur-sm">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <motion.div 
                    className="p-4 rounded-2xl bg-gradient-to-br from-yellow-400 to-orange-500 shadow-lg"
                    animate={{
                      boxShadow: [
                        '0 0 20px rgba(251, 191, 36, 0.3)',
                        '0 0 30px rgba(251, 191, 36, 0.5)',
                        '0 0 20px rgba(251, 191, 36, 0.3)',
                      ],
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <Calendar className="h-7 w-7 text-white" />
                  </motion.div>
                  <div>
                    <p className="text-sm text-muted-foreground font-medium">Tracked Days</p>
                    <p className="text-3xl font-bold bg-gradient-to-r from-yellow-600 to-orange-600 bg-clip-text text-transparent">
                      {stats?.trackedDays || 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            whileHover={{ scale: 1.02, y: -4 }}
          >
            <Card className="overflow-hidden border-2 border-border/50 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-blue-500/10 via-background to-background backdrop-blur-sm">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <motion.div 
                    className="p-4 rounded-2xl bg-gradient-to-br from-blue-400 to-cyan-500 shadow-lg"
                    animate={{
                      boxShadow: [
                        '0 0 20px rgba(59, 130, 246, 0.3)',
                        '0 0 30px rgba(59, 130, 246, 0.5)',
                        '0 0 20px rgba(59, 130, 246, 0.3)',
                      ],
                    }}
                    transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
                  >
                    <TrendingUp className="h-7 w-7 text-white" />
                  </motion.div>
                  <div>
                    <p className="text-sm text-muted-foreground font-medium">Total Emotions</p>
                    <p className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                      {stats?.totalEmotions || 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            whileHover={{ scale: 1.02, y: -4 }}
          >
            <Card className="overflow-hidden border-2 border-border/50 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-purple-500/10 via-background to-background backdrop-blur-sm">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <motion.div 
                    className="p-4 rounded-2xl bg-gradient-to-br from-purple-400 to-pink-500 shadow-lg"
                    animate={{
                      boxShadow: [
                        '0 0 20px rgba(168, 85, 247, 0.3)',
                        '0 0 30px rgba(168, 85, 247, 0.5)',
                        '0 0 20px rgba(168, 85, 247, 0.3)',
                      ],
                    }}
                    transition={{ duration: 2, repeat: Infinity, delay: 1 }}
                  >
                    <Clock className="h-7 w-7 text-white" />
                  </motion.div>
                  <div>
                    <p className="text-sm text-muted-foreground font-medium">Tracking Since</p>
                    <p className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                      {stats?.firstChatDate 
                        ? format(parseISO(stats.firstChatDate), 'MMM d')
                        : '—'
                      }
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      )}

      {/* Enhanced Tabs with New Components */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 p-1 bg-muted/50 backdrop-blur-sm rounded-xl border border-border/50">
          <TabsTrigger 
            value="daily" 
            className="rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-primary/80 data-[state=active]:text-primary-foreground"
          >
            <Calendar className="h-4 w-4 mr-2" />
            Daily View
          </TabsTrigger>
          <TabsTrigger 
            value="weekly"
            className="rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-primary/80 data-[state=active]:text-primary-foreground"
          >
            <TrendingUp className="h-4 w-4 mr-2" />
            Weekly View
          </TabsTrigger>
          <TabsTrigger 
            value="timeline"
            className="rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-primary/80 data-[state=active]:text-primary-foreground"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Timeline
          </TabsTrigger>
        </TabsList>

        <TabsContent value="daily" className="mt-6">
          <DailyView insights={dailyInsights} isLoading={isLoading} />
        </TabsContent>

        <TabsContent value="weekly" className="mt-6">
          <WeeklyView insights={weeklyInsights} isLoading={isLoading} />
        </TabsContent>

        <TabsContent value="timeline" className="mt-6">
          <TimelineView moments={moments} isLoading={isLoading} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
