'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { EmergencyContactForm } from '@/components/auth/EmergencyContactForm';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';

export default function EmergencyContactSetup() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const [canSkip, setCanSkip] = useState(false);

  useEffect(() => {
    // Allow skip after 3 seconds to encourage filling it out
    const timer = setTimeout(() => {
      setCanSkip(true);
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400 mb-4">Please log in first</p>
          <Button onClick={() => router.push('/auth/signin')}>
            Go to Sign In
          </Button>
        </div>
      </div>
    );
  }

  const handleSuccess = () => {
    toast({
      title: 'Setup Complete',
      description: 'Your emergency contact has been saved. Welcome!',
      variant: 'default'
    });
    // Redirect to home after success
    setTimeout(() => {
      router.push('/');
    }, 1000);
  };

  const handleSkip = () => {
    toast({
      title: 'Skipped',
      description: 'You can add an emergency contact later in your profile settings.',
      variant: 'default'
    });
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            💙 Let&apos;s Keep You Safe
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            We care about your wellbeing. Please add an emergency contact who will be notified if we
            detect signs of emotional distress in your messages.
          </p>
        </div>

        {/* Form Container */}
        <div className="flex justify-center mb-6">
          <EmergencyContactForm
            userId={user.id}
            onSuccess={handleSuccess}
          />
        </div>

        {/* Skip Button */}
        {canSkip && (
          <div className="text-center">
            <button
              onClick={handleSkip}
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 underline"
            >
              Skip for now →
            </button>
          </div>
        )}

        {/* Info Section */}
        <div className="mt-12 max-w-2xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 text-center">
            <div className="text-3xl mb-2">🔒</div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
              Private & Secure
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Your contact info is encrypted and only shared with authorized personnel
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 text-center">
            <div className="text-3xl mb-2">🚨</div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
              Alerts Only When Needed
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Alerts are sent only when high-risk indicators are detected
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 text-center">
            <div className="text-3xl mb-2">❤️</div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
              You&apos;re Not Alone
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Reaching out for support is a sign of strength
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
