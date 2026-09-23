'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { useSession, signIn as nextAuthSignIn, signOut as nextAuthSignOut } from 'next-auth/react';
import type { UserProfile } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

interface AuthUser {
  id: string;
  email: string | null;
  name?: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  session: ReturnType<typeof useSession>['data'];
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  deleteAccount: () => Promise<{ error?: string }>;
  deleteAllData: () => Promise<{ error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const { toast } = useToast();

  const loading = status === 'loading';
  // Stable reference: only recompute when the underlying id/email/name
  // actually change, not on every re-render — otherwise anything depending on
  // `user` by reference (e.g. ChatContext's session-init effect) re-fires on
  // every unrelated re-render, since session?.user is a fresh object each time.
  const sessionUserId = session?.user?.id;
  const sessionUserEmail = session?.user?.email ?? null;
  const sessionUserName = session?.user?.name;
  const user: AuthUser | null = useMemo(() => {
    if (!sessionUserId) return null;
    return { id: sessionUserId, email: sessionUserEmail, name: sessionUserName };
  }, [sessionUserId, sessionUserEmail, sessionUserName]);

  const fetchProfile = useCallback(async () => {
    try {
      const response = await fetch('/api/profile', { credentials: 'same-origin' });
      if (!response.ok) {
        if (response.status === 401) {
          setProfile(null);
        }
        return;
      }
      const data = await response.json();
      setProfile(data);
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchProfile();
    } else {
      setProfile(null);
    }
  }, [user?.id, fetchProfile]);

  // Sign in
  const signIn = async (email: string, password: string) => {
    try {
      const result = await nextAuthSignIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (!result || result.error) {
        const message = 'Invalid email or password.';
        toast({
          title: 'Authentication Error',
          description: message,
          variant: 'destructive',
        });
        return { error: message };
      }

      toast({
        title: 'Welcome back!',
        description: 'You have successfully signed in.',
      });

      return {};
    } catch (error) {
      console.error('Sign in error:', error);
      return { error: error instanceof Error ? error.message : 'Failed to sign in.' };
    }
  };

  // Sign up: register via our own API route, then sign in immediately
  // (there's no email verification step in this app, unlike Supabase Auth).
  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, fullName }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message = data?.error || 'Failed to create account. Please try again.';
        toast({
          title: 'Registration Error',
          description: message,
          variant: 'destructive',
        });
        return { error: message };
      }

      const signInResult = await nextAuthSignIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (!signInResult || signInResult.error) {
        toast({
          title: 'Account created',
          description: 'Your account was created. Please sign in.',
        });
        return {};
      }

      toast({
        title: 'Account created!',
        description: 'Welcome to MantrAI! You can now start chatting.',
      });

      return {};
    } catch (error) {
      console.error('Unexpected signup error:', error);
      toast({
        title: 'Registration Error',
        description: 'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      });
      return { error: error instanceof Error ? error.message : 'An unexpected error occurred.' };
    }
  };

  // Sign out
  const signOut = async () => {
    try {
      setProfile(null);
      await nextAuthSignOut({ redirect: false });
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
    }
  };

  // Update profile
  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user || !profile) return;

    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        toast({
          title: 'Error',
          description: 'Failed to update profile.',
          variant: 'destructive',
        });
        return;
      }

      const data = await response.json();
      setProfile(data);
      toast({
        title: 'Profile updated',
        description: 'Your profile has been successfully updated.',
      });
    } catch (error) {
      console.error('Update profile error:', error);
    }
  };

  // Deleting the account cascades (via Prisma's onDelete: Cascade on every
  // relation to User) through all of the user's chat sessions, messages,
  // emergency contact, safety alerts, emotion analyses, journals, etc. — so
  // deleteAccount and deleteAllData both collapse into the same API call.
  const deleteAccount = async (): Promise<{ error?: string }> => {
    if (!user) return { error: 'No user logged in' };

    try {
      const response = await fetch('/api/account', {
        method: 'DELETE',
        credentials: 'same-origin',
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        const message = data?.error || 'Failed to delete account.';
        return { error: message };
      }

      setProfile(null);
      await nextAuthSignOut({ redirect: false });

      toast({
        title: 'Account deleted',
        description: 'Your account has been permanently deleted.',
      });

      return {};
    } catch (error) {
      console.error('Delete account error:', error);
      return { error: error instanceof Error ? error.message : 'Failed to delete account.' };
    }
  };

  const deleteAllData = async (): Promise<{ error?: string }> => {
    // All of the user's data lives on the User row via cascading relations,
    // so "delete all data" and "delete account" are the same operation here.
    return deleteAccount();
  };

  const value: AuthContextType = {
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
