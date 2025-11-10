'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmergencyContactForm } from './EmergencyContactForm';
import { Heart, AlertCircle } from 'lucide-react';

interface EmergencyContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  existingContact?: any;
  mode?: 'create' | 'edit';
}

export function EmergencyContactModal({
  isOpen,
  onClose,
  onSuccess,
  existingContact,
  mode = 'create',
}: EmergencyContactModalProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleSuccess = () => {
    if (onSuccess) {
      onSuccess();
    }
    onClose();
  };

  if (!isClient) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            <DialogTitle className="text-xl">
              {mode === 'create' ? 'Set Up Emergency Contact' : 'Edit Emergency Contact'}
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm">
            {mode === 'create'
              ? 'We noticed you haven\'t set up an emergency contact yet. This helps us notify someone you trust if we detect emotional distress.'
              : 'Update your emergency contact information.'}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <EmergencyContactForm
            isModal={true}
            onSuccess={handleSuccess}
            onCancel={onClose}
            existingContact={existingContact}
            mode={mode}
          />
        </div>

        {mode === 'create' && (
          <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 text-sm text-blue-800 dark:text-blue-300">
            <p className="flex items-start gap-2">
              <Heart className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>Your emergency contact will only be notified with your consent when we detect signs of emotional distress.</span>
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
