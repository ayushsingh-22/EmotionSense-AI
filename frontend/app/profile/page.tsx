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
import { AuthGuard } from '@/components/auth/AuthGuard';
import { DeleteAccountDialog, DeleteDataDialog } from '@/components/auth/DeleteConfirmationDialog';

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
  const [deleteDataDialogOpen, setDeleteDataDialogOpen] = useState(false);
  const [deleteAccountDialogOpen, setDeleteAccountDialogOpen] = useState(false);
  const [isDeletingData, setIsDeletingData] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  
  const { user, profile, updateProfile, signOut, deleteAccount, deleteAllData: deleteAllUserData } = useAuth();
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

  const handleDeleteAllData = async () => {
    setIsDeletingData(true);
    try {
      const result = await deleteAllUserData();
      if (!result.error) {
        setDeleteDataDialogOpen(false);
        // Refresh stats to show empty state
        fetchUserStats();
      } else {
        toast({
          title: 'Error',
          description: 'Failed to delete data. Please try again.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error deleting data:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete data. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsDeletingData(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeletingAccount(true);
    try {
      const result = await deleteAccount();
      if (!result.error) {
        setDeleteAccountDialogOpen(false);
        // User will be automatically signed out and redirected
      } else {
        toast({
          title: 'Error',
          description: 'Failed to delete account. Please try again.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error deleting account:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete account. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const getEmotionColor = (emotion: string) => {
    return EMOTION_CONFIG[emotion as keyof typeof EMOTION_CONFIG]?.color || '#666';
  };

  const getEmotionEmoji = (emotion: string) => {
    return EMOTION_CONFIG[emotion as keyof typeof EMOTION_CONFIG]?.emoji || '😐';
  };

  return (
    <AuthGuard requireAuth={true}>
      <div className="max-w-4xl mx-auto space-y-8 p-4 sm:p-6">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 mb-4">
          <User className="h-8 w-8 text-white" />
        </div>
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
            Your Profile
          </h1>
          <p className="text-lg text-muted-foreground">
            Manage your account and view your emotional journey analytics
          </p>
        </div>
      </div>

      {/* Profile Information */}
      <Card className="backdrop-blur-sm bg-white/80 dark:bg-gray-900/80 border-white/20 dark:border-gray-700/20 shadow-xl">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 rounded-t-lg">
          <CardTitle className="flex items-center text-lg text-gray-800 dark:text-white">
            <div className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 mr-3">
              <User className="h-4 w-4 text-white" />
            </div>
            Profile Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-gray-700 dark:text-gray-300">Email</Label>
              <Input
                id="email"
                value={user?.email || ''}
                disabled
                className="bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fullName" className="text-sm font-medium text-gray-700 dark:text-gray-300">Full Name</Label>
              <div className="flex space-x-2">
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={!isEditing}
                  className={isEditing 
                    ? "border-blue-300 dark:border-blue-600 focus:border-blue-500 dark:focus:border-blue-400 bg-white dark:bg-gray-900 text-gray-900 dark:text-white" 
                    : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300"}
                />
                <Button
                  onClick={isEditing ? handleUpdateProfile : () => setIsEditing(true)}
                  variant={isEditing ? 'default' : 'outline'}
                  size="icon"
                  className={isEditing ? "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700" : "dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"}
                >
                  <Edit className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Member Since</Label>
            <p className="text-sm text-muted-foreground bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-400">
              {profile ? new Date(profile.created_at).toLocaleDateString() : 'N/A'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Emotion Analytics */}
      <Card className="backdrop-blur-sm bg-white/80 dark:bg-gray-900/80 border-white/20 dark:border-gray-700/20 shadow-xl">
        <CardHeader className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-950/30 dark:to-blue-950/30 rounded-t-lg">
          <CardTitle className="flex items-center text-lg text-gray-800 dark:text-white">
            <div className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-r from-green-600 to-blue-600 mr-3">
              <BarChart3 className="h-4 w-4 text-white" />
            </div>
            Emotion Analytics
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {isLoading ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 mb-4 animate-spin">
                <BarChart3 className="h-6 w-6 text-white" />
              </div>
              <p className="text-muted-foreground dark:text-gray-400">Loading analytics...</p>
            </div>
          ) : !stats || stats.totalSessions === 0 ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 mb-4">
                <BarChart3 className="h-8 w-8 text-gray-500 dark:text-gray-400" />
              </div>
              <p className="text-lg font-medium text-muted-foreground dark:text-gray-400 mb-2">No emotion data yet</p>
              <p className="text-sm text-muted-foreground dark:text-gray-500">
                Start using the app to see your emotional journey analytics
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Overview Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/30 border border-blue-200 dark:border-blue-800">
                  <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{stats.totalSessions}</div>
                  <div className="text-sm text-blue-700 dark:text-blue-300 font-medium">Total Sessions</div>
                </div>
                <div className="text-center p-4 rounded-xl bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/30 dark:to-green-900/30 border border-green-200 dark:border-green-800">
                  <div className="text-3xl font-bold text-green-600 dark:text-green-400">{stats.thisWeek}</div>
                  <div className="text-sm text-green-700 dark:text-green-300 font-medium">This Week</div>
                </div>
                <div className="text-center p-4 rounded-xl bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/30 dark:to-purple-900/30 border border-purple-200 dark:border-purple-800">
                  <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">{stats.thisMonth}</div>
                  <div className="text-sm text-purple-700 dark:text-purple-300 font-medium">This Month</div>
                </div>
                <div className="text-center p-4 rounded-xl bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950/30 dark:to-orange-900/30 border border-orange-200 dark:border-orange-800">
                  <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">
                    {Math.round(stats.averageConfidence * 100)}%
                  </div>
                  <div className="text-sm text-orange-700 dark:text-orange-300 font-medium">Avg Confidence</div>
                </div>
              </div>

              {/* Most Frequent Emotion */}
              <div className="text-center p-8 bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-indigo-950/30 dark:via-purple-950/30 dark:to-pink-950/30 rounded-xl border border-indigo-200 dark:border-indigo-800">
                <div className="text-6xl mb-4 animate-pulse">
                  {getEmotionEmoji(stats.mostFrequentEmotion)}
                </div>
                <h3 className="text-xl font-semibold text-indigo-800 dark:text-indigo-200 mb-2">Most Frequent Emotion</h3>
                <p className="text-3xl font-bold capitalize bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">
                  {stats.mostFrequentEmotion}
                </p>
              </div>

              {/* Emotion Breakdown */}
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                <h4 className="text-lg font-semibold mb-4 text-gray-800 dark:text-white">Emotion Breakdown</h4>
                <div className="space-y-3">
                  {stats.emotionBreakdown.map((emotion) => (
                    <div key={emotion.emotion} className="flex items-center justify-between p-3 bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-all duration-200">
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">{getEmotionEmoji(emotion.emotion)}</span>
                        <span className="capitalize font-medium text-gray-800 dark:text-gray-200">{emotion.emotion}</span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                          {emotion.count} sessions
                        </div>
                        <Badge
                          className="px-3 py-1 font-semibold"
                          style={{
                            backgroundColor: getEmotionColor(emotion.emotion) + '20',
                            color: getEmotionColor(emotion.emotion),
                            border: `1px solid ${getEmotionColor(emotion.emotion)}40`,
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
      <Card className="backdrop-blur-sm bg-white/80 dark:bg-gray-900/80 border-red-200 dark:border-red-900/30 shadow-xl">
        <CardHeader className="bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-950/30 dark:to-pink-950/30 rounded-t-lg">
          <CardTitle className="text-red-600 dark:text-red-400 flex items-center text-lg">
            <div className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-r from-red-600 to-pink-600 mr-3">
              <Trash2 className="h-4 w-4 text-white" />
            </div>
            Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 border-2 border-orange-200 dark:border-orange-800 rounded-xl bg-gradient-to-r from-orange-50 to-yellow-50 dark:from-orange-950/20 dark:to-yellow-950/20 hover:from-orange-100 hover:to-yellow-100 dark:hover:from-orange-950/40 dark:hover:to-yellow-950/40 transition-all duration-200">
            <div className="mb-3 sm:mb-0">
              <h4 className="font-semibold text-orange-800 dark:text-orange-200">Delete All Emotion Data</h4>
              <p className="text-sm text-orange-600 dark:text-orange-300">
                Permanently delete all your emotion sessions and chat history
              </p>
            </div>
            <Button
              onClick={() => setDeleteDataDialogOpen(true)}
              variant="destructive"
              size="sm"
              className="bg-gradient-to-r from-orange-600 to-yellow-600 hover:from-orange-700 hover:to-yellow-700 text-white font-medium"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Data
            </Button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 border-2 border-red-200 dark:border-red-800 rounded-xl bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-950/20 dark:to-pink-950/20 hover:from-red-100 hover:to-pink-100 dark:hover:from-red-950/40 dark:hover:to-pink-950/40 transition-all duration-200">
            <div className="mb-3 sm:mb-0">
              <h4 className="font-semibold text-red-800 dark:text-red-200">Delete Account</h4>
              <p className="text-sm text-red-600 dark:text-red-300">
                Permanently delete your account and all associated data
              </p>
            </div>
            <Button
              onClick={() => setDeleteAccountDialogOpen(true)}
              variant="destructive"
              size="sm"
              className="bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 text-white font-medium"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Account
            </Button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 border-2 border-gray-200 dark:border-gray-700 rounded-xl bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-800/50 dark:to-slate-800/50 hover:from-gray-100 hover:to-slate-100 dark:hover:from-gray-800 dark:hover:to-slate-800 transition-all duration-200">
            <div className="mb-3 sm:mb-0">
              <h4 className="font-semibold text-gray-800 dark:text-gray-200">Sign Out</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Sign out of your account
              </p>
            </div>
            <Button
              onClick={signOut}
              variant="outline"
              size="sm"
              className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              Sign Out
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialogs */}
      <DeleteDataDialog
        open={deleteDataDialogOpen}
        onOpenChange={setDeleteDataDialogOpen}
        onConfirm={handleDeleteAllData}
        isLoading={isDeletingData}
      />

      <DeleteAccountDialog
        open={deleteAccountDialogOpen}
        onOpenChange={setDeleteAccountDialogOpen}
        onConfirm={handleDeleteAccount}
        userEmail={user?.email || ''}
        isLoading={isDeletingAccount}
      />
      </div>
    </AuthGuard>
  );
}