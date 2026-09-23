'use client';

import React, { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { EmergencyContactForm } from './EmergencyContactForm';

interface EmergencyContactModalProps {
  userId: string;
  isOpen: boolean;
  /**
   * When true, this is a hard gate (chat couldn't start without a contact):
   * the backdrop no longer dismisses the modal, and "Maybe Later" makes clear
   * that chat stays blocked instead of implying the prompt was just skipped.
   */
  blocking?: boolean;
  onClose?: () => void;
  /** Called once the contact is actually saved, so the caller can retry whatever was blocked. */
  onSuccess?: () => void;
}

export function EmergencyContactModal({
  userId,
  isOpen,
  blocking = false,
  onClose,
  onSuccess
}: EmergencyContactModalProps) {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);

  const handleAddContact = () => {
    setShowForm(true);
  };

  const handleSetupLater = () => {
    if (onClose) {
      onClose();
    }
    toast({
      title: blocking ? 'Chat is on hold' : 'Reminder',
      description: blocking
        ? "You'll need to add an emergency contact before you can start chatting."
        : 'You can add an emergency contact anytime in your profile settings.',
      variant: 'default'
    });
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    if (onClose) {
      onClose();
    }
    if (onSuccess) {
      onSuccess();
    }
    toast({
      title: 'Success',
      description: 'Emergency contact saved!',
      variant: 'default'
    });
  };

  if (!isOpen) {
    return null;
  }

  return (
    <>
      {/* Backdrop — not dismissible while blocking */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={blocking ? undefined : handleSetupLater}
      />

      {/* Modal */}
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md">
        {showForm ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6">
            <EmergencyContactForm
              userId={userId}
              onSuccess={handleFormSuccess}
              onCancel={handleSetupLater}
              isModal={true}
            />
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6">
            <div className="text-center">
              <div className="text-4xl mb-4">💙</div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Safety First
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                {blocking
                  ? "Add an emergency contact to start chatting. This person will be notified if we detect signs of severe emotional distress in your messages."
                  : 'Would you like to add an emergency contact? This person will be notified if we detect signs of severe emotional distress in your messages.'}
              </p>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={handleSetupLater}
                  className="flex-1"
                >
                  Maybe Later
                </Button>
                <Button
                  onClick={handleAddContact}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Add Contact Now
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
