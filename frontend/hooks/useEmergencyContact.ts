import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { EmergencyContact, EmergencyContactForm, EmergencyContactResponse } from '@/types/emergency';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export function useEmergencyContact() {
  const { user, session } = useAuth();
  const [contact, setContact] = useState<EmergencyContact | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Get auth token from session
  const getAuthHeaders = () => {
    if (!session) {
      throw new Error('User is not authenticated');
    }
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    };
  };

  /**
   * Fetch emergency contact for current user
   */
  const fetchContact = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/emergency-contact/${user.id}`,
        {
          method: 'GET',
          headers: getAuthHeaders(),
        }
      );

      const data: EmergencyContactResponse = await response.json();

      if (!response.ok) {
        if (response.status === 404) {
          setContact(null);
          return null;
        }
        setError(data.error || 'Failed to fetch emergency contact');
        return null;
      }

      setContact(data.contact || null);
      return data.contact || null;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch emergency contact';
      setError(errorMessage);
      console.error('Error fetching emergency contact:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [user?.id, session]);

  /**
   * Create new emergency contact
   */
  const createContact = useCallback(
    async (formData: EmergencyContactForm) => {
      if (!user?.id) {
        setError('User is not authenticated');
        return false;
      }

      setLoading(true);
      setError(null);
      setSuccess(null);

      try {
        const response = await fetch(`${API_BASE_URL}/api/emergency-contact`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(formData),
        });

        const data: EmergencyContactResponse = await response.json();

        if (!response.ok) {
          setError(data.error || 'Failed to create emergency contact');
          return false;
        }

        setContact(data.contact || null);
        setSuccess(data.message || 'Emergency contact created successfully');
        return true;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to create emergency contact';
        setError(errorMessage);
        console.error('Error creating emergency contact:', err);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [user?.id, session]
  );

  /**
   * Update existing emergency contact
   */
  const updateContact = useCallback(
    async (formData: Partial<EmergencyContactForm>) => {
      if (!user?.id) {
        setError('User is not authenticated');
        return false;
      }

      setLoading(true);
      setError(null);
      setSuccess(null);

      try {
        const response = await fetch(
          `${API_BASE_URL}/api/emergency-contact/${user.id}`,
          {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(formData),
          }
        );

        const data: EmergencyContactResponse = await response.json();

        if (!response.ok) {
          setError(data.error || 'Failed to update emergency contact');
          return false;
        }

        setContact(data.contact || null);
        setSuccess(data.message || 'Emergency contact updated successfully');
        return true;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to update emergency contact';
        setError(errorMessage);
        console.error('Error updating emergency contact:', err);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [user?.id, session]
  );

  /**
   * Delete emergency contact
   */
  const deleteContact = useCallback(async () => {
    if (!user?.id) {
      setError('User is not authenticated');
      return false;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/emergency-contact/${user.id}`,
        {
          method: 'DELETE',
          headers: getAuthHeaders(),
        }
      );

      const data: EmergencyContactResponse = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to delete emergency contact');
        return false;
      }

      setContact(null);
      setSuccess(data.message || 'Emergency contact deleted successfully');
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete emergency contact';
      setError(errorMessage);
      console.error('Error deleting emergency contact:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, [user?.id, session]);

  /**
   * Trigger emergency alert (for testing)
   */
  const triggerAlert = useCallback(
    async (emotion: string) => {
      if (!user?.id) {
        setError('User is not authenticated');
        return false;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `${API_BASE_URL}/api/emergency-contact/trigger-alert/${user.id}`,
          {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
              emotion,
              timestamp: new Date().toISOString(),
            }),
          }
        );

        const data: EmergencyContactResponse = await response.json();

        if (!response.ok) {
          setError(data.error || 'Failed to trigger alert');
          return false;
        }

        setSuccess(`Alert sent to ${data.contactEmail}`);
        return true;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to trigger alert';
        setError(errorMessage);
        console.error('Error triggering alert:', err);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [user?.id, session]
  );

  /**
   * Clear messages
   */
  const clearMessages = useCallback(() => {
    setError(null);
    setSuccess(null);
  }, []);

  return {
    contact,
    loading,
    error,
    success,
    fetchContact,
    createContact,
    updateContact,
    deleteContact,
    triggerAlert,
    clearMessages,
  };
}
