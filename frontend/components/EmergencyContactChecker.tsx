'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useChat } from '@/contexts/ChatContext';
import { EmergencyContactModal } from '@/components/auth/EmergencyContactModal';
import { hasEmergencyContact } from '@/lib/api';

/**
 * Component that checks if user needs to add an emergency contact.
 * Shows a proactive nudge shortly after login (dismissible anywhere — skipping
 * it just hides it, nothing is blocked outside of chat). On the /chat screen
 * specifically, ChatContext reporting a blocked chat attempt (text or voice)
 * upgrades this into a hard, non-dismissible gate: chat only starts once a
 * contact is actually added.
 */
export function EmergencyContactChecker() {
  const { user, loading } = useAuth();
  const { needsEmergencyContact, onEmergencyContactAdded, dismissEmergencyContactPrompt } = useChat();
  const pathname = usePathname();
  const isChatScreen = pathname?.startsWith('/chat') ?? false;
  const [showNudge, setShowNudge] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const checkAndPrompt = async () => {
      if (!user || loading) {
        return;
      }

      // Only check once per mount
      if (checked) {
        return;
      }

      try {
        const hasContact = await hasEmergencyContact(user.id);

        if (!hasContact) {
          // Wait a bit before showing the proactive nudge for better UX
          setTimeout(() => {
            setShowNudge(true);
          }, 1000);
        }
      } catch (error) {
        console.error('Error checking emergency contact:', error);
        // Don't show the nudge if there's an error
      } finally {
        setChecked(true);
      }
    };

    checkAndPrompt();
  }, [user, loading, checked]);

  if (!user) {
    return null;
  }

  // Only the /chat screen turns a blocked attempt into a hard, non-dismissible
  // gate. Anywhere else, a blocked attempt (or the proactive nudge) is just a
  // normal dismissible prompt — skipping it doesn't block anything, since
  // there's no chat being started from those screens.
  const isBlocking = needsEmergencyContact && isChatScreen;
  const isOpen = showNudge || needsEmergencyContact;

  const handleClose = () => {
    setShowNudge(false);
    if (needsEmergencyContact) {
      // Clears the flag without creating a session — the next real chat
      // attempt (text or voice) re-checks and re-triggers this if still needed.
      dismissEmergencyContactPrompt();
    }
  };

  return (
    <EmergencyContactModal
      userId={user.id}
      isOpen={isOpen}
      blocking={isBlocking}
      onClose={handleClose}
      onSuccess={onEmergencyContactAdded}
    />
  );
}
