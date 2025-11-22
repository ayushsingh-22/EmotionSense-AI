'use client';

import { useState, useEffect, useCallback } from 'react';
import { Edit, Trash2, User, BarChart3, Heart, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { EMOTION_CONFIG } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { DeleteAccountDialog, DeleteDataDialog } from '@/components/auth/DeleteConfirmationDialog';
import { EmergencyContactForm } from '@/components/auth/EmergencyContactForm';
import { getEmergencyContact } from '@/lib/api';
import { GradientHeader } from '@/components/ui/GradientHeader';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { AnimatedIcon } from '@/components/ui/AnimatedIcon';
import { motion } from 'framer-motion';
import { EmotionAnalytics } from '@/components/profile/EmotionAnalytics';

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

interface EmergencyContactData {
  id: string;
  user_id: string;
  contact_name: string;
  contact_email: string;
  contact_phone?: string;
  notify_enabled: boolean;
  created_at: string;
  updated_at: string;
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
  const [showEmergencyForm, setShowEmergencyForm] = useState(false);
  const [emergencyContact, setEmergencyContact] = useState<EmergencyContactData | null>(null);
  const [emergencyLoading, setEmergencyLoading] = useState(true);
  
  const { user, profile, updateProfile, signOut, deleteAccount, deleteAllData: deleteAllUserData } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name);
    }
  }, [profile]);

  const fetchEmergencyContact = useCallback(async () => {
    if (!user) return;
    try {
      const contact = await getEmergencyContact(user.id);
      setEmergencyContact(contact);
    } catch (error) {
      console.error('Error fetching emergency contact:', error);
    } finally {
      setEmergencyLoading(false);
    }
  }, [user]);

  const fetchUserStats = useCallback(async () => {
    if (!user) return;

    try {
      setIsLoading(true);

      // Fetch chat sessions (emotion data is stored in messages, sessions track conversations)
      const { data: sessions, error } = await supabase
        .from('chat_sessions')
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
  }, [user]);

  useEffect(() => {
    const fetchData = async () => {
      if (user) {
        await Promise.all([
          fetchUserStats(),
          fetchEmergencyContact(),
        ]);
      }
    };
    fetchData();
  }, [user, fetchUserStats, fetchEmergencyContact]);

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
      <div className="max-w-5xl mx-auto space-y-8 p-6">
      {/* Header */}
      <div className="text-center space-y-4">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <AnimatedIcon 
            icon={<User className="h-12 w-12" />}
            gradient="from-blue-500 via-purple-500 to-pink-600"
            glowColor="rgba(168, 85, 247, 0.4)"
            size="lg"
            className="mx-auto mb-6"
          />
        </motion.div>
        <GradientHeader 
          title="Your Profile"
          subtitle="Manage your account and view your emotional journey analytics"
          className="text-center items-center"
        />
      </div>

      {/* Profile Information */}
      <GlassPanel 
        title="Profile Information"
        icon={<User className="h-6 w-6 text-white" />}
        gradient="from-blue-500/10"
        delay={0.2}
      >
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-semibold">Email</Label>
              <Input
                id="email"
                value={user?.email || ''}
                disabled
                className="h-12 rounded-2xl border-2 bg-background/60 backdrop-blur-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fullName" className="text-sm font-semibold">Full Name</Label>
              <div className="flex space-x-2">
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={!isEditing}
                  className={isEditing 
                    ? "h-12 rounded-2xl border-2 border-primary/60 focus:ring-4 focus:ring-primary/20" 
                    : "h-12 rounded-2xl border-2 bg-background/60 backdrop-blur-sm"}
                />
                <Button
                  onClick={isEditing ? handleUpdateProfile : () => setIsEditing(true)}
                  variant={isEditing ? 'default' : 'outline'}
                  size="icon"
                  className={isEditing ? "h-12 w-12 rounded-2xl bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 shadow-lg" : "h-12 w-12 rounded-2xl border-2"}
                >
                  <Edit className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Member Since</Label>
            <p className="text-sm text-muted-foreground bg-background/60 p-4 rounded-2xl border-2 border-border/40 backdrop-blur-sm font-medium">
              {profile ? new Date(profile.created_at).toLocaleDateString() : 'N/A'}
            </p>
          </div>
        </div>
      </GlassPanel>

      {/* Emotion Analytics */}
      <GlassPanel 
        title="Emotion Analytics"
        icon={<BarChart3 className="h-6 w-6 text-white" />}
        gradient="from-green-500/10"
        delay={0.3}
      >
        {user && <EmotionAnalytics userId={user.id} />}
      </GlassPanel>

      {/* Emergency Contact Management - Enhanced */}
      <GlassPanel 
        title="Emergency Contact"
        icon={<Heart className="h-6 w-6 text-white" />}
        gradient="from-blue-500/10"
        delay={0.4}
      >
        <div>
          <p className="text-sm text-muted-foreground mb-4">Your safety net for emotional support</p>
          {showEmergencyForm ? (
            <EmergencyContactForm
              userId={user?.id || ''}
              onSuccess={() => {
                setShowEmergencyForm(false);
                fetchEmergencyContact();
                toast({
                  title: 'Success',
                  description: emergencyContact
                    ? 'Emergency contact updated successfully'
                    : 'Emergency contact saved successfully',
                  variant: 'default'
                });
              }}
              onCancel={() => setShowEmergencyForm(false)}
              isModal={true}
              initialContact={emergencyContact}
            />
          ) : (
            <div className="space-y-4">
              {emergencyLoading ? (
                <div className="text-center py-8">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 mb-4 animate-pulse">
                    <span className="text-2xl">💙</span>
                  </div>
                  <p className="text-muted-foreground">Loading emergency contact...</p>
                </div>
              ) : emergencyContact ? (
                <div className="space-y-4">
                  {/* Contact Information Card */}
                  <div className="p-5 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20 border-2 border-blue-200 dark:border-blue-800 rounded-xl shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-sm font-semibold text-blue-900 dark:text-blue-100 flex items-center">
                        <span className="w-2 h-2 bg-blue-500 rounded-full mr-2 animate-pulse"></span>
                        Contact Information
                      </p>
                      {emergencyContact.notify_enabled && (
                        <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs font-medium rounded-full">
                          ✓ Active
                        </span>
                      )}
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex items-start justify-between bg-white dark:bg-gray-900 p-3 rounded-lg">
                        <span className="text-sm text-blue-700 dark:text-blue-300 font-medium">Name:</span>
                        <span className="text-sm font-semibold text-blue-900 dark:text-blue-100 text-right">{emergencyContact.contact_name}</span>
                      </div>
                      <div className="flex items-start justify-between bg-white dark:bg-gray-900 p-3 rounded-lg">
                        <span className="text-sm text-blue-700 dark:text-blue-300 font-medium">Email:</span>
                        <span className="text-sm font-semibold text-blue-900 dark:text-blue-100 text-right break-all">{emergencyContact.contact_email}</span>
                      </div>
                      {emergencyContact.contact_phone && (
                        <div className="flex items-start justify-between bg-white dark:bg-gray-900 p-3 rounded-lg">
                          <span className="text-sm text-blue-700 dark:text-blue-300 font-medium">Phone:</span>
                          <span className="text-sm font-semibold text-blue-900 dark:text-blue-100 text-right">{emergencyContact.contact_phone}</span>
                        </div>
                      )}
                      <div className="flex items-start justify-between bg-white dark:bg-gray-900 p-3 rounded-lg">
                        <span className="text-sm text-blue-700 dark:text-blue-300 font-medium">Notifications:</span>
                        <span className="text-sm font-semibold text-blue-900 dark:text-blue-100 text-right">
                          {emergencyContact.notify_enabled ? '✓ Enabled' : '✗ Disabled'}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Info Banner */}
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <p className="text-xs text-blue-800 dark:text-blue-200 flex items-start">
                      <span className="mr-2 flex-shrink-0">ℹ️</span>
                      <span>This contact will be notified if our AI detects signs of severe emotional distress in your conversations.</span>
                    </p>
                  </div>
                  
                  {/* Action Button */}
                  <Button
                    onClick={() => setShowEmergencyForm(true)}
                    variant="outline"
                    className="w-full border-2 border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/20 font-medium"
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Update Emergency Contact
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Warning Banner for No Contact */}
                  <div className="p-6 bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-950/20 dark:to-orange-950/20 border-2 border-yellow-300 dark:border-yellow-800 rounded-xl text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-yellow-100 dark:bg-yellow-900/30 mb-4">
                      <span className="text-4xl">⚠️</span>
                    </div>
                    <h4 className="text-lg font-semibold text-yellow-900 dark:text-yellow-100 mb-2">
                      No Emergency Contact Set
                    </h4>
                    <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-4">
                      Add a trusted contact to help us keep you safe. They&apos;ll be notified only in cases of severe emotional distress.
                    </p>
                  </div>
                  
                  {/* Add Contact Button */}
                  <Button
                    onClick={() => setShowEmergencyForm(true)}
                    className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-medium py-6 text-base shadow-lg hover:shadow-xl transition-all duration-200"
                  >
                    <span className="text-xl mr-2">💙</span>
                    Add Emergency Contact Now
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </GlassPanel>

      {/* Account Actions */}
      <GlassPanel 
        title="Danger Zone"
        icon={<AlertTriangle className="h-6 w-6 text-white" />}
        gradient="from-red-500/10"
        delay={0.5}
      >
        <div className="space-y-4">
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
        </div>
      </GlassPanel>

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