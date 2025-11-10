export interface EmergencyContact {
  id: string;
  user_id: string;
  contact_name: string;
  contact_email: string;
  contact_phone?: string | null;
  preferred_method: 'email' | 'sms' | 'whatsapp';
  notify_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface EmergencyContactForm {
  contact_name: string;
  contact_email: string;
  contact_phone?: string;
  preferred_method?: 'email' | 'sms' | 'whatsapp';
  notify_enabled?: boolean;
}

export interface EmergencyAlertPayload {
  emotion: string;
  timestamp?: Date;
}

export interface EmergencyContactResponse {
  success: boolean;
  message?: string;
  error?: string;
  contact?: EmergencyContact;
  contactEmail?: string;
}
