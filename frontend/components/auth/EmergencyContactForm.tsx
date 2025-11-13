'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import axios from 'axios';

interface EmergencyContactFormProps {
  userId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
  isModal?: boolean;
  initialContact?: {
    contact_name: string;
    contact_email: string;
    contact_phone?: string;
  } | null;
}

export function EmergencyContactForm({
  userId,
  onSuccess,
  onCancel,
  isModal = false,
  initialContact = null
}: EmergencyContactFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    contactName: initialContact?.contact_name || '',
    contactEmail: initialContact?.contact_email || '',
    contactPhone: initialContact?.contact_phone || ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Basic validation
  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.contactName.trim()) {
      newErrors.contactName = 'Contact name is required';
    }

    if (!formData.contactEmail.trim()) {
      newErrors.contactEmail = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contactEmail)) {
      newErrors.contactEmail = 'Please enter a valid email address';
    }

    // Phone is optional but validate if provided
    if (formData.contactPhone && !/^[+\d\s\-()]{10,}$/.test(formData.contactPhone)) {
      newErrors.contactPhone = 'Please enter a valid phone number';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
      
      // Determine if we're creating or updating
      const endpoint = initialContact ? '/api/emergency/update' : '/api/emergency/save';
      
      const response = await axios.post(`${apiUrl}${endpoint}`, {
        userId,
        contactName: formData.contactName.trim(),
        contactEmail: formData.contactEmail.trim(),
        contactPhone: formData.contactPhone.trim() || null
      });

      if (response.data.success) {
        toast({
          title: 'Success',
          description: initialContact
            ? 'Emergency contact updated successfully'
            : 'Emergency contact saved successfully',
          variant: 'default'
        });

        // Call success callback if provided
        if (onSuccess) {
          onSuccess();
        } else if (!isModal) {
          // Redirect to home if not in modal
          router.push('/');
        }
      } else {
        throw new Error(response.data.error || 'Failed to save emergency contact');
      }
    } catch (error: any) {
      console.error('Error saving emergency contact:', error);
      toast({
        title: 'Error',
        description:
          error.response?.data?.error ||
          error.message ||
          'Failed to save emergency contact',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-6 bg-gradient-to-br from-white to-blue-50 dark:from-gray-800 dark:to-blue-950/20 rounded-xl shadow-lg border-2 border-blue-200 dark:border-blue-800">
      <div className="mb-6 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-r from-blue-600 to-cyan-600 mb-4">
          <span className="text-3xl">💙</span>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          {initialContact ? 'Update Emergency Contact' : 'Add Emergency Contact'}
        </h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
          {initialContact
            ? 'Update your emergency contact information for your safety'
            : 'Add a trusted contact who will be notified in case of safety concerns'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Contact Name */}
        <div className="space-y-2">
          <Label htmlFor="contactName" className="text-gray-700 dark:text-gray-200 font-medium">
            Contact Name *
          </Label>
          <Input
            id="contactName"
            name="contactName"
            type="text"
            placeholder="e.g., John Doe"
            value={formData.contactName}
            onChange={handleChange}
            className={`${
              errors.contactName
                ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                : 'border-blue-200 dark:border-blue-800 focus:border-blue-500 dark:focus:border-blue-400'
            } bg-white dark:bg-gray-900`}
            disabled={isLoading}
          />
          {errors.contactName && (
            <p className="text-sm text-red-500 flex items-center">
              <span className="mr-1">⚠️</span>
              {errors.contactName}
            </p>
          )}
        </div>

        {/* Contact Email */}
        <div className="space-y-2">
          <Label htmlFor="contactEmail" className="text-gray-700 dark:text-gray-200 font-medium">
            Contact Email *
          </Label>
          <Input
            id="contactEmail"
            name="contactEmail"
            type="email"
            placeholder="e.g., john@example.com"
            value={formData.contactEmail}
            onChange={handleChange}
            className={`${
              errors.contactEmail
                ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                : 'border-blue-200 dark:border-blue-800 focus:border-blue-500 dark:focus:border-blue-400'
            } bg-white dark:bg-gray-900`}
            disabled={isLoading}
          />
          {errors.contactEmail && (
            <p className="text-sm text-red-500 flex items-center">
              <span className="mr-1">⚠️</span>
              {errors.contactEmail}
            </p>
          )}
        </div>

        {/* Contact Phone (Optional) */}
        <div className="space-y-2">
          <Label htmlFor="contactPhone" className="text-gray-700 dark:text-gray-200 font-medium">
            Contact Phone <span className="text-gray-400 text-xs">(Optional)</span>
          </Label>
          <Input
            id="contactPhone"
            name="contactPhone"
            type="tel"
            placeholder="e.g., +1 (555) 123-4567"
            value={formData.contactPhone}
            onChange={handleChange}
            className={`${
              errors.contactPhone
                ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                : 'border-blue-200 dark:border-blue-800 focus:border-blue-500 dark:focus:border-blue-400'
            } bg-white dark:bg-gray-900`}
            disabled={isLoading}
          />
          {errors.contactPhone && (
            <p className="text-sm text-red-500 flex items-center">
              <span className="mr-1">⚠️</span>
              {errors.contactPhone}
            </p>
          )}
        </div>

        {/* Important Note */}
        <div className="p-4 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-sm text-blue-800 dark:text-blue-200 flex items-start">
            <span className="text-xl mr-2 flex-shrink-0">💙</span>
            <span>
              <strong className="font-semibold">Your safety matters:</strong> This contact will be notified if we detect
              signs of severe emotional distress in your messages.
            </span>
          </p>
        </div>

        {/* Buttons */}
        <div className="flex gap-3 pt-4">
          {isModal && onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isLoading}
              className="flex-1 border-2 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 font-medium"
            >
              Cancel
            </Button>
          )}
          <Button
            type="submit"
            disabled={isLoading}
            className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
          >
            {isLoading ? (
              <>
                <span className="mr-2">⏳</span>
                {initialContact ? 'Updating...' : 'Saving...'}
              </>
            ) : (
              <>
                <span className="mr-2">💾</span>
                {initialContact ? 'Update Contact' : 'Save Contact'}
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
