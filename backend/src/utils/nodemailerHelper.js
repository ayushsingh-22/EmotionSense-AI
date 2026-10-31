import { createEmailAdapter } from '../auth/emailService.js';
﻿import { emergencyAlertHtml, emergencyAlertText, sendEmergencyAlert as sendAlert } from './emergencyEmail.js';

export const generateEmergencyAlertHTML = user => emergencyAlertHtml(user);
export const generateEmergencyAlertText = user => emergencyAlertText(user);
export const sendEmergencyAlert = (user, contact) => sendAlert(user, contact);
export const isEmailAlertsEnabled = () => Boolean(createEmailAdapter().configured?.() ?? (process.env.RESEND_API_KEY && process.env.RESEND_FROM));
export const getEmailConfigStatus = () => ({ enabled: isEmailAlertsEnabled(), provider: process.env.EMAIL_PROVIDER || (process.env.NODE_ENV?.trim().toLowerCase() === 'production' ? 'gmail' : 'resend') });
