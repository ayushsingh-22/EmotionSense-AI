'use client';

import { useState, useEffect } from 'react';
import { Edit, Trash2, User, BarChart3 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { EMOTION_CONFIG } from '@/types';
import { useToast } from '@/hooks/use-toast';

interface EmotionStats {
  emotion: string;
  count: number;
  percentage: number;
  avgConfidence: number;
}

interface SessionStats {
  totalSessions: number;
  thisWeek: number;
  thisMonth: number;
  averageConfidence: number;
  mostFrequentEmotion: string;
  emotionBreakdown: EmotionStats[];
}

export default function ProfilePage() {
  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState('');
  const [stats, setStats] = useState<SessionStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const { user, profile, updateProfile, signOut } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name);
    }
  }, [profile]);

  useEffect(() => {
    if (user) {
      fetchUserStats();
    }
  }, [user]);

  const fetchUserStats = async () => {
    if (!user) return;

    try {
      setIsLoading(true);

      // Fetch emotion sessions
      const { data: sessions, error } = await supabase
        .from('emotion_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching stats:', error);
        return;
      }

      if (!sessions || sessions.length === 0) {
        setStats({
          totalSessions: 0,
          thisWeek: 0,
          thisMonth: 0,
          averageConfidence: 0,
          mostFrequentEmotion: 'neutral',
          emotionBreakdown: [],
        });
        return;
      }

      // Calculate stats
      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const thisWeekSessions = sessions.filter(
        s => new Date(s.created_at) >= oneWeekAgo
      );
      const thisMonthSessions = sessions.filter(
        s => new Date(s.created_at) >= oneMonthAgo
      );

      // Emotion breakdown
      const emotionCounts: { [key: string]: { count: number; totalConfidence: number } } = {};
      sessions.forEach(session => {
        const emotion = session.emotion_detected;
        if (!emotionCounts[emotion]) {
          emotionCounts[emotion] = { count: 0, totalConfidence: 0 };
        }
        emotionCounts[emotion].count++;
        emotionCounts[emotion].totalConfidence += session.confidence_score || 0;
      });

      const emotionBreakdown: EmotionStats[] = Object.entries(emotionCounts)
        .map(([emotion, data]) => ({
          emotion,
          count: data.count,
          percentage: (data.count / sessions.length) * 100,
          avgConfidence: data.totalConfidence / data.count,
        }))
        .sort((a, b) => b.count - a.count);

      const averageConfidence = sessions.reduce(
        (sum, s) => sum + (s.confidence_score || 0),
        0
      ) / sessions.length;

      setStats({
        totalSessions: sessions.length,
        thisWeek: thisWeekSessions.length,
        thisMonth: thisMonthSessions.length,
        averageConfidence,
        mostFrequentEmotion: emotionBreakdown[0]?.emotion || 'neutral',
        emotionBreakdown,
      });

    } catch (error) {
      console.error('Error calculating stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateProfile = async () => {
    if (!fullName.trim()) return;

    await updateProfile({ full_name: fullName.trim() });
    setIsEditing(false);
  };

  const deleteAllData = async () => {
    if (!user) return;

    const confirmed = window.confirm(
      'Are you sure you want to delete all your emotion data? This action cannot be undone.'
    );

    if (!confirmed) return;

    try {
      // Delete emotion sessions
      await supabase
        .from('emotion_sessions')
        .delete()
        .eq('user_id', user.id);

      // Delete chat messages
      await supabase
        .from('chat_messages')
        .delete()
        .eq('user_id', user.id);

      toast({
        title: 'Data Deleted',
        description: 'All your emotion data has been deleted.',
      });

      // Refresh stats
      fetchUserStats();

    } catch (error) {
      console.error('Error deleting data:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete data. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const getEmotionColor = (emotion: string) => {
    return EMOTION_CONFIG[emotion as keyof typeof EMOTION_CONFIG]?.color || '#666';
  };

  const getEmotionEmoji = (emotion: string) => {
    return EMOTION_CONFIG[emotion as keyof typeof EMOTION_CONFIG]?.emoji || '😐';
  };

  // Redirect if not authenticated
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Please sign in to access your profile.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Your Profile</h1>
        <p className="text-muted-foreground">
          Manage your account and view your emotional journey analytics
        </p>
      </div>

      {/* Profile Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <User className="h-5 w-5 mr-2" />
            Profile Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={user.email || ''}
                disabled
                className="bg-muted"
              />
            </div>
            <div>
              <Label htmlFor="fullName">Full Name</Label>
              <div className="flex space-x-2">
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={!isEditing}
                />
                <Button
                  onClick={isEditing ? handleUpdateProfile : () => setIsEditing(true)}
                  variant={isEditing ? 'default' : 'outline'}
                  size="icon"
                >
                  <Edit className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          
          <div>
            <Label>Member Since</Label>
            <p className="text-sm text-muted-foreground">
              {profile ? new Date(profile.created_at).toLocaleDateString() : 'N/A'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Emotion Analytics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <BarChart3 className="h-5 w-5 mr-2" />
            Emotion Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Loading analytics...</p>
            </div>
          ) : !stats || stats.totalSessions === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-2">No emotion data yet</p>
              <p className="text-sm text-muted-foreground">
                Start using the app to see your emotional journey analytics
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Overview Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold">{stats.totalSessions}</div>
                  <div className="text-sm text-muted-foreground">Total Sessions</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{stats.thisWeek}</div>
                  <div className="text-sm text-muted-foreground">This Week</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{stats.thisMonth}</div>
                  <div className="text-sm text-muted-foreground">This Month</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {Math.round(stats.averageConfidence * 100)}%
                  </div>
                  <div className="text-sm text-muted-foreground">Avg Confidence</div>
                </div>
              </div>

              {/* Most Frequent Emotion */}
              <div className="text-center p-4 bg-muted rounded-lg">
                <div className="text-3xl mb-2">
                  {getEmotionEmoji(stats.mostFrequentEmotion)}
                </div>
                <h3 className="text-lg font-medium">Most Frequent Emotion</h3>
                <p className="text-2xl font-bold capitalize">
                  {stats.mostFrequentEmotion}
                </p>
              </div>

              {/* Emotion Breakdown */}
              <div>
                <h4 className="font-medium mb-3">Emotion Breakdown</h4>
                <div className="space-y-2">
                  {stats.emotionBreakdown.map((emotion) => (
                    <div key={emotion.emotion} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span>{getEmotionEmoji(emotion.emotion)}</span>
                        <span className="capitalize">{emotion.emotion}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="text-sm text-muted-foreground">
                          {emotion.count} sessions
                        </div>
                        <Badge
                          style={{
                            backgroundColor: getEmotionColor(emotion.emotion) + '20',
                            color: getEmotionColor(emotion.emotion),
                          }}
                        >
                          {Math.round(emotion.percentage)}%
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Account Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-red-600">Danger Zone</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border border-red-200 rounded-lg">
            <div>
              <h4 className="font-medium">Delete All Emotion Data</h4>
              <p className="text-sm text-muted-foreground">
                Permanently delete all your emotion sessions and chat history
              </p>
            </div>
            <Button
              onClick={deleteAllData}
              variant="destructive"
              size="sm"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Data
            </Button>
          </div>

          <div className="flex items-center justify-between p-4 border border-red-200 rounded-lg">
            <div>
              <h4 className="font-medium">Sign Out</h4>
              <p className="text-sm text-muted-foreground">
                Sign out of your account
              </p>
            </div>
            <Button
              onClick={signOut}
              variant="outline"
              size="sm"
            >
              Sign Out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}