import { emergencyAlertHtml, emergencyAlertText, sendEmergencyAlert as sendAlert } from './emergencyEmail.js';

export const generateEmergencyAlertHTML = user => emergencyAlertHtml(user);
export const generateEmergencyAlertText = user => emergencyAlertText(user);
export const sendEmergencyAlert = (user, contact) => sendAlert(user, contact);
export const isEmailAlertsEnabled = () => Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM);
export const getEmailConfigStatus = () => ({ enabled: isEmailAlertsEnabled(), provider: 'resend' });
