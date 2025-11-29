/**
 * Date Utilities
 * Centralized date handling with IST timezone support
 * All journal-related dates should use these utilities
 */

/**
 * Get current date in IST timezone (YYYY-MM-DD)
 * @returns {string} Date string in YYYY-MM-DD format
 */
export function getTodayIST() {
  const nowIST = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
  return new Date(nowIST).toISOString().split('T')[0];
}

/**
 * Get yesterday's date in IST timezone (YYYY-MM-DD)
 * @returns {string} Date string in YYYY-MM-DD format
 */
export function getYesterdayIST() {
  const nowIST = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
  const yesterday = new Date(nowIST);
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toISOString().split('T')[0];
}

/**
 * Convert a date to IST timezone start (00:00:00 IST)
 * @param {string} date - Date in YYYY-MM-DD format
 * @returns {string} ISO string for start of day in IST
 */
export function getISTDateStart(date) {
  return new Date(`${date}T00:00:00+05:30`).toISOString();
}

/**
 * Convert a date to IST timezone end (23:59:59 IST)
 * @param {string} date - Date in YYYY-MM-DD format
 * @returns {string} ISO string for end of day in IST
 */
export function getISTDateEnd(date) {
  return new Date(`${date}T23:59:59+05:30`).toISOString();
}

/**
 * Format a UTC timestamp to IST date (YYYY-MM-DD)
 * @param {string} utcTimestamp - UTC timestamp
 * @returns {string} Date in YYYY-MM-DD format in IST
 */
export function utcToISTDate(utcTimestamp) {
  const dateIST = new Date(utcTimestamp).toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
  return new Date(dateIST).toISOString().split('T')[0];
}

/**
 * Check if a date is valid (YYYY-MM-DD format)
 * @param {string} date - Date string to validate
 * @returns {boolean} True if valid
 */
export function isValidDate(date) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
}

/**
 * Get date N days ago in IST
 * @param {number} daysAgo - Number of days ago
 * @returns {string} Date in YYYY-MM-DD format
 */
export function getDateNDaysAgoIST(daysAgo) {
  const nowIST = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
  const targetDate = new Date(nowIST);
  targetDate.setDate(targetDate.getDate() - daysAgo);
  return targetDate.toISOString().split('T')[0];
}
