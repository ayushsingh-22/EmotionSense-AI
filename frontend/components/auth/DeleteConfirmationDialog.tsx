'use client';

import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Trash2 } from 'lucide-react';

interface DeleteAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
  userEmail?: string;
  isLoading?: boolean;
}

export function DeleteAccountDialog({
  open,
  onOpenChange,
  onConfirm,
  userEmail = '',
  isLoading = false,
}: DeleteAccountDialogProps) {
  const [confirmText, setConfirmText] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  
  const isConfirmValid = 
    confirmText.toLowerCase() === 'delete my account' && 
    confirmEmail.toLowerCase() === userEmail.toLowerCase();

  const handleConfirm = async () => {
    if (!isConfirmValid) return;
    
    try {
      await onConfirm();
      setConfirmText('');
      setConfirmEmail('');
    } catch (error) {
      console.error('Delete confirmation error:', error);
    }
  };

  const handleCancel = () => {
    setConfirmText('');
    setConfirmEmail('');
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <AlertDialogTitle className="text-red-700 dark:text-red-400">
              Delete Account Permanently
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription>
            <div className="space-y-3">
              <div>
                <strong className="text-red-600">This action cannot be undone.</strong> This will permanently delete your account and remove all your data from our servers.
              </div>
              
              <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg p-3">
                <h4 className="font-semibold text-red-800 dark:text-red-300 text-sm mb-2">
                  What will be deleted:
                </h4>
                <ul className="text-xs text-red-700 dark:text-red-400 space-y-1">
                  <li>• Your profile and account information</li>
                  <li>• All chat messages and conversation history</li>
                  <li>• All emotion analysis sessions and data</li>
                  <li>• Voice recordings and text analysis results</li>
                  <li>• All statistics and insights</li>
                </ul>
              </div>

              <div className="space-y-3 pt-2">
                <div>
                  <Label htmlFor="confirm-email" className="text-sm font-medium">
                    Please enter your email to confirm:
                  </Label>
                  <Input
                    id="confirm-email"
                    type="email"
                    placeholder={userEmail}
                    value={confirmEmail}
                    onChange={(e) => setConfirmEmail(e.target.value)}
                    className="mt-1"
                    disabled={isLoading}
                  />
                </div>

                <div>
                  <Label htmlFor="confirm-text" className="text-sm font-medium">
                    Type &quot;delete my account&quot; to confirm:
                  </Label>
                  <Input
                    id="confirm-text"
                    type="text"
                    placeholder="delete my account"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    className="mt-1"
                    disabled={isLoading}
                  />
                </div>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <AlertDialogCancel onClick={handleCancel} disabled={isLoading}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={!isConfirmValid || isLoading}
            className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
          >
            {isLoading ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Deleting...
              </div>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Account
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface DeleteDataDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
  isLoading?: boolean;
}

export function DeleteDataDialog({
  open,
  onOpenChange,
  onConfirm,
  isLoading = false,
}: DeleteDataDialogProps) {
  const [confirmText, setConfirmText] = useState('');
  
  const isConfirmValid = confirmText.toLowerCase() === 'delete all data';

  const handleConfirm = async () => {
    if (!isConfirmValid) return;
    
    try {
      await onConfirm();
      setConfirmText('');
    } catch (error) {
      console.error('Delete data confirmation error:', error);
    }
  };

  const handleCancel = () => {
    setConfirmText('');
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center">
              <Trash2 className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            <AlertDialogTitle className="text-orange-700 dark:text-orange-400">
              Delete All Data
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription>
            <div className="space-y-3">
              <div>
                <strong className="text-orange-600">This action cannot be undone.</strong> This will permanently delete all your emotion data while keeping your account active.
              </div>
              
              <div className="bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800 rounded-lg p-3">
                <h4 className="font-semibold text-orange-800 dark:text-orange-300 text-sm mb-2">
                  What will be deleted:
                </h4>
                <ul className="text-xs text-orange-700 dark:text-orange-400 space-y-1">
                  <li>• All chat messages and conversation history</li>
                  <li>• All emotion analysis sessions</li>
                  <li>• Voice recordings and text analysis results</li>
                  <li>• All statistics and insights</li>
                  <li>• Chat session history</li>
                </ul>
              </div>

              <div className="pt-2">
                <Label htmlFor="confirm-delete-data" className="text-sm font-medium">
                  Type &quot;delete all data&quot; to confirm:
                </Label>
                <Input
                  id="confirm-delete-data"
                  type="text"
                  placeholder="delete all data"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  className="mt-1"
                  disabled={isLoading}
                />
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <AlertDialogCancel onClick={handleCancel} disabled={isLoading}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={!isConfirmValid || isLoading}
            className="bg-orange-600 hover:bg-orange-700 focus:ring-orange-600"
          >
            {isLoading ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Deleting...
              </div>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete All Data
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}