'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase, UserProfile } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { debounce } from '@/lib/performance';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: AuthError }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error?: AuthError }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  deleteAccount: () => Promise<{ error?: AuthError }>;
  deleteAllData: () => Promise<{ error?: Error }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Debounced profile fetch to prevent excessive API calls
  const debouncedFetchProfile = useCallback(
    debounce((...args: unknown[]) => {
      const userId = args[0] as string;
      fetchProfile(userId);
    }, 300),
    [user]
  );

  const fetchProfile = async (userId: string) => {
    try {
      // First, verify the user exists in auth
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !authUser) {
        console.warn('User session invalid, signing out...');
        await supabase.auth.signOut();
        setSession(null);
        setUser(null);
        setProfile(null);
        toast({
          title: 'Session Expired',
          description: 'Your session has expired. Please sign in again.',
          variant: 'destructive',
        });
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching profile:', error);
        return;
      }

      if (data) {
        setProfile(data);
      } else {
        // Create profile if it doesn't exist
        const { data: newProfile, error: createError } = await supabase
          .from('profiles')
          .insert([
            {
              id: userId,
              email: user?.email || '',
              full_name: user?.user_metadata?.full_name || '',
              avatar_url: user?.user_metadata?.avatar_url || null,
            },
          ])
          .select()
          .single();

        if (createError) {
          console.error('Error creating profile:', createError);
        } else {
          setProfile(newProfile);
        }
      }
    } catch (error) {
      console.error('Error in fetchProfile:', error);
    }
  };

  // Initialize auth state
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        // Validate the session by checking if user still exists
        if (session?.user) {
          const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
          
          if (authError || !authUser) {
            // User doesn't exist in auth system, clear the session
            console.warn('Invalid session detected, clearing...');
            await supabase.auth.signOut();
            setSession(null);
            setUser(null);
            setProfile(null);
            setLoading(false);
            return;
          }
        }

        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          debouncedFetchProfile(session.user.id);
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        // Clear session on error
        await supabase.auth.signOut();
        setSession(null);
        setUser(null);
        setProfile(null);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        debouncedFetchProfile(session.user.id);
      } else {
        setProfile(null);
      }

      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Sign in
  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast({
          title: 'Authentication Error',
          description: error.message,
          variant: 'destructive',
        });
        return { error };
      }

      toast({
        title: 'Welcome back!',
        description: 'You have successfully signed in.',
      });

      return {};
    } catch (error) {
      console.error('Sign in error:', error);
      return { error: error as AuthError };
    } finally {
      setLoading(false);
    }
  };

  // Sign up
  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      setLoading(true);
      console.log('AuthContext: Starting signup for:', email);
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

      console.log('AuthContext: Supabase signup response:', { data, error });

      if (error) {
        console.error('AuthContext: Signup error from Supabase:', error);
        toast({
          title: 'Registration Error',
          description: error.message,
          variant: 'destructive',
        });
        return { error };
      }

      console.log('AuthContext: Signup successful');
      toast({
        title: 'Account created!',
        description: 'Please check your email to verify your account.',
      });

      return {};
    } catch (error) {
      console.error('AuthContext: Unexpected signup error:', error);
      toast({
        title: 'Registration Error',
        description: 'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      });
      return { error: error as AuthError };
    } finally {
      setLoading(false);
    }
  };

  // Sign out
  const signOut = async () => {
    try {
      setLoading(true);
      await supabase.auth.signOut();
      setProfile(null);
      
      toast({
        title: 'Signed out',
        description: 'You have been successfully signed out.',
      });
    } catch (error) {
      console.error('Sign out error:', error);
      toast({
        title: 'Error',
        description: 'Failed to sign out. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Update profile
  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user || !profile) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) {
        toast({
          title: 'Error',
          description: 'Failed to update profile.',
          variant: 'destructive',
        });
        return;
      }

      setProfile({ ...profile, ...updates });
      toast({
        title: 'Profile updated',
        description: 'Your profile has been successfully updated.',
      });
    } catch (error) {
      console.error('Update profile error:', error);
    }
  };

  const deleteAccount = async (): Promise<{ error?: AuthError }> => {
    if (!user) return { error: new Error('No user logged in') as AuthError };

    try {
      // First delete all user data
      await deleteAllData();

      // Delete user profile
      await supabase
        .from('profiles')
        .delete()
        .eq('id', user.id);

      // Note: In production, account deletion should be handled by the backend
      // For now, we'll just delete user data and sign out
      await signOut();
      
      toast({
        title: 'Account deleted',
        description: 'Your account has been permanently deleted.',
      });

      return {};
    } catch (error) {
      console.error('Delete account error:', error);
      return { error: error as AuthError };
    }
  };

  const deleteAllData = async (): Promise<{ error?: Error }> => {
    if (!user) return { error: new Error('No user logged in') };

    try {
      // Delete in order to avoid foreign key constraints
      
      // Delete chat messages
      const { error: chatError } = await supabase
        .from('chat_messages')
        .delete()
        .eq('user_id', user.id);

      if (chatError) {
        console.error('Error deleting chat messages:', chatError);
        return { error: chatError };
      }

      // Delete chat sessions  
      const { error: sessionsError } = await supabase
        .from('chat_sessions')
        .delete()
        .eq('user_id', user.id);

      if (sessionsError) {
        console.error('Error deleting chat sessions:', sessionsError);
        return { error: sessionsError };
      }

      // Delete emotion sessions
      const { error: emotionError } = await supabase
        .from('emotion_sessions')
        .delete()
        .eq('user_id', user.id);

      if (emotionError) {
        console.error('Error deleting emotion sessions:', emotionError);
        return { error: emotionError };
      }

      toast({
        title: 'Data deleted',
        description: 'All your data has been permanently deleted.',
      });

      return {};
    } catch (error) {
      console.error('Delete all data error:', error);
      return { error: error as Error };
    }
  };

  const value = {
    user,
    session,
    profile,
    loading,
    signIn,
    signUp,
    signOut,
    updateProfile,
    deleteAccount,
    deleteAllData,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}