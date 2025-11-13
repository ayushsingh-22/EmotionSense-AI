import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { hasEmergencyContact } from '@/lib/api';

/**
 * Hook to manage emergency contact setup flow
 */
export const useEmergencyContactSetup = () => {
  const { user, loading } = useAuth();
  const [needsSetup, setNeedsSetup] = useState(false);
  const [setupLoading, setSetupLoading] = useState(true);

  useEffect(() => {
    const checkEmergencyContact = async () => {
      if (!user || loading) {
        return;
      }

      try {
        const hasContact = await hasEmergencyContact(user.id);
        if (!hasContact) {
          setNeedsSetup(true);
        }
      } catch (error) {
        console.error('Error checking emergency contact:', error);
        // Don't fail - just don't show setup
      } finally {
        setSetupLoading(false);
      }
    };

    checkEmergencyContact();
  }, [user, loading]);

  return {
    needsSetup,
    setupLoading
  };
};

/**
 * Hook to check if user is new (just signed up)
 * Returns true if user was created in the last 2 minutes
 */
export const useIsNewUser = () => {
  const { user } = useAuth();
  const [isNew, setIsNew] = useState(false);

  useEffect(() => {
    if (!user?.created_at) {
      setIsNew(false);
      return;
    }

    const createdAt = new Date(user.created_at);
    const now = new Date();
    const diffMs = now.getTime() - createdAt.getTime();
    const diffMinutes = diffMs / (1000 * 60);

    // User is considered new if created in last 2 minutes
    setIsNew(diffMinutes < 2);
  }, [user]);

  return isNew;
};
