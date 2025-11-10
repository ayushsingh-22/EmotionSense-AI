'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, CheckCircle2, Heart, Phone, Mail } from 'lucide-react';
import { EmergencyContactForm as FormData } from '@/types/emergency';
import { useEmergencyContact } from '@/hooks/useEmergencyContact';

interface EmergencyContactFormProps {
  onSuccess?: () => void;
  isModal?: boolean;
  onCancel?: () => void;
  existingContact?: FormData | null;
  mode?: 'create' | 'edit';
}

export function EmergencyContactForm({
  onSuccess,
  isModal = false,
  onCancel,
  existingContact,
  mode = 'create',
}: EmergencyContactFormProps) {
  const [formData, setFormData] = useState<FormData>({
    contact_name: existingContact?.contact_name || '',
    contact_email: existingContact?.contact_email || '',
    contact_phone: existingContact?.contact_phone || '',
    preferred_method: existingContact?.preferred_method || 'email',
    notify_enabled: existingContact?.notify_enabled !== false,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const { loading, error: hookError, success, createContact, updateContact, clearMessages } = useEmergencyContact();

  useEffect(() => {
    if (hookError || success) {
      const timer = setTimeout(() => {
        clearMessages();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [hookError, success, clearMessages]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.contact_name.trim()) {
      newErrors.contact_name = 'Contact name is required';
    }

    if (!formData.contact_email.trim()) {
      newErrors.contact_email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contact_email)) {
      newErrors.contact_email = 'Invalid email format';
    }

    if (formData.contact_phone && !/^[\d\s+\-()]{10,}$/.test(formData.contact_phone)) {
      newErrors.contact_phone = 'Invalid phone format (minimum 10 digits)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    });
    if (errors[name]) {
      setErrors({ ...errors, [name]: '' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      let success_result = false;

      if (mode === 'create') {
        success_result = await createContact(formData);
      } else {
        success_result = await updateContact(formData);
      }

      if (success_result && onSuccess) {
        onSuccess();
      }
    } catch (err) {
      console.error('Form submission error:', err);
    }
  };

  return (
    <div className={isModal ? '' : ''}>
      <Card className="border-0 shadow-lg bg-white dark:bg-gray-900">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Heart className="h-6 w-6 text-red-500" />
            {mode === 'create' ? 'Add Emergency Contact' : 'Edit Emergency Contact'}
          </CardTitle>
          <CardDescription className="text-base">
            {mode === 'create'
              ? 'Provide contact information for someone we should notify if we detect emotional distress.'
              : 'Update your emergency contact information.'}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {hookError && (
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 dark:text-red-300">{hookError}</p>
            </div>
          )}

          {success && (
            <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-green-700 dark:text-green-300">{success}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Contact Name */}
            <div className="space-y-2">
              <Label htmlFor="contact_name" className="text-sm font-medium">
                Contact Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="contact_name"
                name="contact_name"
                type="text"
                placeholder="e.g., John Doe"
                value={formData.contact_name}
                onChange={handleChange}
                disabled={loading}
                className={`h-11 rounded-lg border-2 transition-all ${
                  errors.contact_name
                    ? 'border-red-500 focus:border-red-600'
                    : 'border-gray-200 dark:border-gray-700 focus:border-blue-500'
                }`}
              />
              {errors.contact_name && (
                <p className="text-sm text-red-600 dark:text-red-400">{errors.contact_name}</p>
              )}
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="contact_email" className="text-sm font-medium flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email Address <span className="text-red-500">*</span>
              </Label>
              <Input
                id="contact_email"
                name="contact_email"
                type="email"
                placeholder="e.g., john@example.com"
                value={formData.contact_email}
                onChange={handleChange}
                disabled={loading}
                className={`h-11 rounded-lg border-2 transition-all ${
                  errors.contact_email
                    ? 'border-red-500 focus:border-red-600'
                    : 'border-gray-200 dark:border-gray-700 focus:border-blue-500'
                }`}
              />
              {errors.contact_email && (
                <p className="text-sm text-red-600 dark:text-red-400">{errors.contact_email}</p>
              )}
            </div>

            {/* Phone Number */}
            <div className="space-y-2">
              <Label htmlFor="contact_phone" className="text-sm font-medium flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Phone Number (Optional)
              </Label>
              <Input
                id="contact_phone"
                name="contact_phone"
                type="tel"
                placeholder="e.g., +1 (555) 123-4567"
                value={formData.contact_phone || ''}
                onChange={handleChange}
                disabled={loading}
                className={`h-11 rounded-lg border-2 transition-all ${
                  errors.contact_phone
                    ? 'border-red-500 focus:border-red-600'
                    : 'border-gray-200 dark:border-gray-700 focus:border-blue-500'
                }`}
              />
              {errors.contact_phone && (
                <p className="text-sm text-red-600 dark:text-red-400">{errors.contact_phone}</p>
              )}
            </div>

            {/* Preferred Notification Method */}
            <div className="space-y-2">
              <Label htmlFor="preferred_method" className="text-sm font-medium">
                Preferred Notification Method
              </Label>
              <select
                id="preferred_method"
                name="preferred_method"
                value={formData.preferred_method || 'email'}
                onChange={handleChange}
                disabled={loading}
                className="w-full h-11 px-4 rounded-lg border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-blue-500 outline-none transition-all"
              >
                <option value="email">Email</option>
                <option value="sms">SMS</option>
                <option value="whatsapp">WhatsApp</option>
              </select>
            </div>

            {/* Notifications Enabled */}
            <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <input
                id="notify_enabled"
                name="notify_enabled"
                type="checkbox"
                checked={formData.notify_enabled !== false}
                onChange={handleChange}
                disabled={loading}
                className="w-5 h-5 rounded cursor-pointer"
              />
              <Label htmlFor="notify_enabled" className="cursor-pointer flex-1 text-sm font-medium">
                Enable notifications for this contact
              </Label>
            </div>

            {/* Help Text */}
            <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                💡 <strong>How it works:</strong> When our system detects emotional distress, we'll send a notification to your emergency contact so they can reach out and check in on you.
              </p>
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                type="submit"
                disabled={loading}
                className="flex-1 h-11 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-medium rounded-lg shadow-lg hover:shadow-xl transition-all"
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    {mode === 'create' ? 'Adding...' : 'Updating...'}
                  </div>
                ) : (
                  <>{mode === 'create' ? 'Add Contact' : 'Update Contact'}</>
                )}
              </Button>

              {isModal && onCancel && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={loading}
                  onClick={onCancel}
                  className="flex-1 h-11 rounded-lg border-2"
                >
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
