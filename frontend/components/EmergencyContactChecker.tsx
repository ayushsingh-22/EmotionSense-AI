'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { EmergencyContactModal } from '@/components/auth/EmergencyContactModal';
import { hasEmergencyContact } from '@/lib/api';

/**
 * Component that checks if user needs to add an emergency contact
 * Shows a modal if they don't have one set up
 */
export function EmergencyContactChecker() {
  const { user, loading } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const checkAndPrompt = async () => {
      if (!user || loading) {
        return;
      }

      // Only check once
      if (checked) {
        return;
      }

      try {
        // Check if user has emergency contact
        const hasContact = await hasEmergencyContact(user.id);
        
        if (!hasContact) {
          // Wait a bit before showing modal for better UX
          setTimeout(() => {
            setShowModal(true);
          }, 1000);
        }
      } catch (error) {
        console.error('Error checking emergency contact:', error);
        // Don't show modal if there's an error
      } finally {
        setChecked(true);
      }
    };

    checkAndPrompt();
  }, [user, loading, checked]);

  if (!user) {
    return null;
  }

  return (
    <EmergencyContactModal
      userId={user.id}
      isOpen={showModal}
      onClose={() => setShowModal(false)}
    />
  );
}
