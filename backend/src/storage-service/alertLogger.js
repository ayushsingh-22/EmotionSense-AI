/**
 * Alert Logger Utility
 * Handles logging of emergency alerts to the alert_logs table (Neon/Prisma)
 * Provides audit trail for all emergency notifications sent
 */

import prisma from '../lib/prisma.js';

const normalizeAlertRow = (row) => {
  if (!row) {
    return row;
  }

  return {
    id: row.id,
    user_id: row.userId,
    contact_email: row.contactEmail,
    alert_type: row.alertType,
    message_excerpt: row.messageExcerpt,
    additional_data: row.additionalData,
    created_at: row.createdAt
  };
};

/**
 * Log an alert event to the alert_logs table
 * Creates a permanent audit trail of emergency notifications
 *
 * @param {string} userId - User ID (UUID)
 * @param {string} contactEmail - Emergency contact's email
 * @param {string} messageText - User's message that triggered alert (truncated to 1000 chars)
 * @param {string} alertType - Type of alert (default: 'emotional_distress')
 * @param {Object} additionalData - Optional additional data to log
 * @returns {Promise<Object|null>} - Logged alert record or null on error
 */
export const logAlertEvent = async (
  userId,
  contactEmail,
  messageText,
  alertType = 'emotional_distress',
  additionalData = {}
) => {
  try {
    // Truncate message to first 1000 characters
    const messageExcerpt = messageText
      ? messageText.slice(0, 1000) + (messageText.length > 1000 ? '...' : '')
      : null;

    console.log(`📝 Logging alert event to alert_logs table...`);

    const created = await prisma.alertLog.create({
      data: {
        userId,
        contactEmail,
        alertType,
        messageExcerpt,
        additionalData: additionalData || null
      }
    });

    console.log(`✅ Alert logged successfully with ID: ${created.id}`);
    return normalizeAlertRow(created);
  } catch (error) {
    console.error('❌ Unexpected error logging alert:', error.message);
    return null;
  }
};

/**
 * Fetch all alerts for a specific user
 * @param {string} userId - User ID (UUID)
 * @param {number} limit - Maximum number of records to fetch (default: 50)
 * @param {number} offset - Number of records to skip for pagination (default: 0)
 * @returns {Promise<Array|null>} - Array of alert records or null on error
 */
export const getAlertHistoryForUser = async (userId, limit = 50, offset = 0) => {
  try {
    const rows = await prisma.alertLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit
    });

    return rows.map(normalizeAlertRow);
  } catch (error) {
    console.error('❌ Unexpected error fetching alert history:', error.message);
    return null;
  }
};

/**
 * Get statistics about alerts for a user
 * @param {string} userId - User ID (UUID)
 * @returns {Promise<Object|null>} - Statistics object or null on error
 */
export const getAlertStatistics = async (userId) => {
  try {
    // Get total count
    const totalAlerts = await prisma.alertLog.count({ where: { userId } });

    // Get count from last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const alertsLast24h = await prisma.alertLog.count({
      where: { userId, createdAt: { gte: oneDayAgo } }
    });

    // Get unique contact emails that have been alerted
    const contactEmails = await prisma.alertLog.findMany({
      where: { userId },
      select: { contactEmail: true },
      distinct: ['contactEmail']
    });

    return {
      totalAlerts: totalAlerts || 0,
      alertsLast24h: alertsLast24h || 0,
      uniqueContactsAlerted: contactEmails?.length || 0,
      lastAlertTime: null // Will be fetched if needed
    };
  } catch (error) {
    console.error('❌ Unexpected error getting alert statistics:', error.message);
    return null;
  }
};

/**
 * Delete old alerts (for data cleanup)
 * @param {number} daysOld - Delete alerts older than this many days
 * @returns {Promise<number|null>} - Number of deleted records or null on error
 */
export const deleteOldAlerts = async (daysOld = 90) => {
  try {
    const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);

    console.log(`🗑️ Deleting alerts older than ${daysOld} days (before ${cutoffDate.toISOString()})`);

    const result = await prisma.alertLog.deleteMany({
      where: { createdAt: { lt: cutoffDate } }
    });

    console.log(`✅ Deleted ${result.count} old alert records`);
    return result.count;
  } catch (error) {
    console.error('❌ Unexpected error deleting old alerts:', error.message);
    return null;
  }
};

export default {
  logAlertEvent,
  getAlertHistoryForUser,
  getAlertStatistics,
  deleteOldAlerts
};
