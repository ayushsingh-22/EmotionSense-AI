import { sendEmergencyAlert as sendAlert, isEmailAlertsEnabled, getEmailConfigStatus } from '../utils/nodemailerHelper.js';

export const initializeMailConfig = async () => isEmailAlertsEnabled();
export const isMailConfigured = isEmailAlertsEnabled;
export const getMailConfigStatus = getEmailConfigStatus;
export const sendEmergencyAlert = (contactEmail, userName) => sendAlert({full_name:userName}, {contact_email:contactEmail});
export const sendTestEmail = async () => false;
export default { initializeMailConfig, sendEmergencyAlert, sendTestEmail, isMailConfigured, getMailConfigStatus };
