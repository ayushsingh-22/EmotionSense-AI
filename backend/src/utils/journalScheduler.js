/**
 * Journal Scheduler
 * Automatically generates daily journals at night
 * Runs at 23:30 (11:30 PM) server time
 */

import cron from 'node-cron';
import { generateJournalsForAllUsers } from '../journal-service/index.js';
import logger from '../utils/logger.js';
import { getYesterdayIST } from './dateUtils.js';

/**
 * Initialize journal scheduler
 * Runs every day at 23:30 (11:30 PM)
 */
export function initializeJournalScheduler() {
  // Validate cron expression: Run at 23:30 every day
  // Format: minute hour day month weekday
  const cronExpression = '30 23 * * *';

  logger.info('📅 Initializing journal scheduler...');
  logger.info(`⏰ Journals will be auto-generated daily at 23:30 server time`);

  const scheduledTask = cron.schedule(cronExpression, async () => {
    try {
      logger.info('🌙 Nightly journal generation started');
      
      // Generate journals for yesterday in IST timezone
      const date = getYesterdayIST();

      const results = await generateJournalsForAllUsers(date);

      logger.info(`✅ Nightly journal generation complete for ${date}`);
      logger.info(`📊 Results: ${results.success} success, ${results.skipped} skipped, ${results.failed} failed`);

      if (results.errors.length > 0) {
        logger.warn(`⚠️ Errors occurred during generation:`);
        results.errors.forEach(err => {
          logger.warn(`  - User ${err.userId}: ${err.error}`);
        });
      }

    } catch (error) {
      logger.error('❌ Nightly journal generation failed:', error);
    }
  }, {
    scheduled: true,
    timezone: 'Asia/Kolkata' // Adjust timezone as needed
  });

  logger.info('✅ Journal scheduler initialized successfully');

  return scheduledTask;
}

/**
 * Generate journals immediately (for testing)
 */
export async function runImmediateGeneration() {
  try {
    logger.info('🧪 Running immediate journal generation for testing...');
    
    const date = getYesterdayIST();

    const results = await generateJournalsForAllUsers(date);
    
    logger.info(`✅ Test generation complete`);
    logger.info(`📊 Results:`, results);
    
    return results;
  } catch (error) {
    logger.error('❌ Test generation failed:', error);
    throw error;
  }
}