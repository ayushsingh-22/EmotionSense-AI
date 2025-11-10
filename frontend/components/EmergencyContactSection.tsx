'use client';

import { useState, useEffect } from 'react';
import { Heart, Edit2, Trash2, Phone, Mail, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useEmergencyContact } from '@/hooks/useEmergencyContact';
import { EmergencyContactModal } from './EmergencyContactModal';
import { EmergencyContact } from '@/types/emergency';

export function EmergencyContactSection() {
  const {
    contact,
    loading,
    error,
    success,
    fetchContact,
    deleteContact,
    clearMessages,
  } = useEmergencyContact();

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteConfirming, setIsDeleteConfirming] = useState(false);
  const [isDeletingContact, setIsDeletingContact] = useState(false);

  useEffect(() => {
    fetchContact();
  }, []);

  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        clearMessages();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, success, clearMessages]);

  const handleDelete = async () => {
    setIsDeletingContact(true);
    const result = await deleteContact();
    setIsDeletingContact(false);
    if (result) {
      setIsDeleteConfirming(false);
    }
  };

  const handleEditSuccess = () => {
    setIsEditModalOpen(false);
    fetchContact();
  };

  const getPreferredMethodIcon = (method?: string) => {
    switch (method) {
      case 'sms':
        return '📱';
      case 'whatsapp':
        return '💬';
      case 'email':
      default:
        return '📧';
    }
  };

  return (
    <>
      <Card className="border-0 shadow-lg bg-white dark:bg-gray-900">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-pink-600 rounded-full blur-lg opacity-20"></div>
                <Heart className="relative h-6 w-6 text-red-500" />
              </div>
              <div>
                <CardTitle className="text-2xl">Emergency Contact</CardTitle>
                <CardDescription>
                  Someone we'll notify if we detect emotional distress
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          {success && (
            <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-green-700 dark:text-green-300">{success}</p>
            </div>
          )}

          {contact ? (
            <div className="space-y-4">
              {/* Contact Card */}
              <div className="p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {contact.contact_name}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Emergency contact saved
                    </p>
                  </div>
                  <Badge
                    variant={contact.notify_enabled ? 'default' : 'secondary'}
                    className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                  >
                    {contact.notify_enabled ? '🔔 Active' : '🔕 Disabled'}
                  </Badge>
                </div>

                <div className="space-y-3">
                  {/* Email */}
                  <div className="flex items-center gap-3 text-sm">
                    <Mail className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                    <div className="flex-1 break-all">
                      <p className="text-gray-600 dark:text-gray-400">Email</p>
                      <p className="text-gray-900 dark:text-white font-medium">
                        {contact.contact_email}
                      </p>
                    </div>
                  </div>

                  {/* Phone */}
                  {contact.contact_phone && (
                    <div className="flex items-center gap-3 text-sm">
                      <Phone className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-gray-600 dark:text-gray-400">Phone</p>
                        <p className="text-gray-900 dark:text-white font-medium">
                          {contact.contact_phone}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Preferred Method */}
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-lg">{getPreferredMethodIcon(contact.preferred_method)}</span>
                    <div>
                      <p className="text-gray-600 dark:text-gray-400">Preferred method</p>
                      <p className="text-gray-900 dark:text-white font-medium capitalize">
                        {contact.preferred_method}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Help Text */}
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  💡 <strong>How it works:</strong> When we detect emotional distress in your
                  messages, we'll send a {contact.preferred_method === 'email' ? 'notification email' : contact.preferred_method === 'sms' ? 'text message' : 'WhatsApp message'} to {contact.contact_name} so they can reach out.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2">
                <Button
                  onClick={() => setIsEditModalOpen(true)}
                  disabled={loading}
                  className="flex-1 h-10 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-all flex items-center justify-center gap-2"
                >
                  <Edit2 className="h-4 w-4" />
                  Edit
                </Button>
                <Button
                  onClick={() => setIsDeleteConfirming(true)}
                  disabled={loading}
                  variant="destructive"
                  className="flex-1 h-10 rounded-lg transition-all flex items-center justify-center gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              </div>

              {/* Delete Confirmation */}
              {isDeleteConfirming && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-sm text-red-700 dark:text-red-300 mb-3">
                    Are you sure you want to delete this emergency contact? You won't receive notifications about detected emotional distress.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleDelete}
                      disabled={isDeletingContact}
                      variant="destructive"
                      className="flex-1"
                    >
                      {isDeletingContact ? 'Deleting...' : 'Yes, Delete'}
                    </Button>
                    <Button
                      onClick={() => setIsDeleteConfirming(false)}
                      disabled={isDeletingContact}
                      variant="outline"
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Empty State */}
              <div className="p-8 text-center">
                <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                  <Heart className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  No emergency contact yet
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Add an emergency contact so we can notify them if we detect emotional distress.
                </p>
              </div>

              {/* Info Box */}
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                <p className="text-sm text-amber-800 dark:text-amber-300">
                  🛡️ <strong>Privacy:</strong> Your emergency contact information is only used with
                  your consent and is never shared without your permission.
                </p>
              </div>

              {/* Add Button */}
              <Button
                onClick={() => setIsEditModalOpen(true)}
                disabled={loading}
                className="w-full h-11 bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white font-medium rounded-lg shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
              >
                <Heart className="h-4 w-4" />
                Add Emergency Contact
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Modal */}
      <EmergencyContactModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={handleEditSuccess}
        existingContact={contact}
        mode={contact ? 'edit' : 'create'}
      />
    </>
  );
}
