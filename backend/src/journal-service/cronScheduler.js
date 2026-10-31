import cron from 'node-cron';
import pg from 'pg';
import journalGenerator from './journalGenerator.js';
import prisma from '../lib/prisma.js';
import logger from '../utils/logger.js';
import { normalizeNodeEnv } from '../config/environment.js';

/**
 * Whether the nightly journal job may be registered in this process.
 *
 * Local development and test runs (NODE_ENV "development" or "test") do NOT register it unless
 * JOURNAL_SCHEDULER_ENABLED=true, so a developer's local server never silently generates journals (LLM calls +
 * database writes) for every user of the development database at 23:30 IST.
 * Every other environment, including production and an unset NODE_ENV, keeps the original behaviour: always registered.
 */
export const shouldRegisterNightlyJob = (env = process.env) => {
  const nodeEnv = normalizeNodeEnv(env.NODE_ENV ?? '');
  const isLocal = nodeEnv === 'development' || nodeEnv === 'test';
  if (!isLocal) return true;
  return env.JOURNAL_SCHEDULER_ENABLED === 'true';
};

export class CronScheduler {
  constructor() {
    // Run at 23:30 IST (6:00 PM UTC) every night
    this.cronSchedule = process.env.JOURNAL_CRON_SCHEDULE || '30 23 * * *';
    this.isRunning = false;
    this.cronTask = null;
  }

  /**
   * Get current date in IST timezone (YYYY-MM-DD format)
   */
  getCurrentISTDate() {
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
    const istDate = new Date(now.getTime() + istOffset);
    return istDate.toISOString().split('T')[0];
  }

  /**
   * Start the cron scheduler for nightly journal generation
   */
  start({ env = process.env, scheduler = cron } = {}) {
    if (!shouldRegisterNightlyJob(env)) {
      this.cronTask = null;
      logger.info('⏸️ Nightly journal cron NOT registered (local development/test). Set JOURNAL_SCHEDULER_ENABLED=true to enable it.');
      return false;
    }
    logger.info(`📅 Starting journal cron scheduler: ${this.cronSchedule} (Asia/Kolkata)`);
    
    // Schedule nightly journal generation
    this.cronTask = scheduler.schedule(this.cronSchedule, async () => {
      await this.runNightly().catch(() => logger.error());
    }, {
      timezone: 'Asia/Kolkata'
    });

    logger.info('✅ Journal cron scheduler started');
    return true;
  }

  /** Hold a direct, dedicated PostgreSQL session lock throughout the run. */
  async runNightly({ date = null, clientFactory = options => new pg.Client(options) } = {}) {
    if (this.isRunning) return { started: false };
    const direct = process.env.DIRECT_URL;
    if (!direct || !process.env.DATABASE_URL) throw new Error('Database connections are required');
    const directUrl = new URL(direct), pooledUrl = new URL(process.env.DATABASE_URL);
    if (directUrl.hostname.includes('-pooler') || pooledUrl.hostname.replace('-pooler.', '.') !== directUrl.hostname || pooledUrl.pathname !== directUrl.pathname) throw new Error('Direct and pooled database targets must match');
    this.isRunning = true;
    const client = clientFactory({ connectionString: direct, connectionTimeoutMillis: 15000 });
    let locked = false; let disconnected = false;
    client.on('error', () => { disconnected = true; });
    client.on('end', () => { disconnected = true; });
    try {
      await client.connect();
      const result = await client.query('SELECT pg_try_advisory_lock($1, $2) AS locked', [183562, 202610]);
      locked = result.rows[0]?.locked === true;
      if (!locked) return { started: false };
      this.assertLock = () => { if (disconnected) throw new Error('Journal lock connection lost'); };
      const summary = await this.generateNightlyJournals(date);
      this.assertLock();
      return { started: true, ...summary };
    } finally {
      this.assertLock = null;
      if (locked && !disconnected) await client.query('SELECT pg_advisory_unlock($1, $2)', [183562, 202610]).catch(() => {});
      await client.end().catch(() => {});
      this.isRunning = false;
    }
  }

  /**
   * Stop the cron scheduler
   */
  stop() {
    logger.info('🛑 Stopping journal cron scheduler...');
    if (this.cronTask) {
      this.cronTask.stop();
    }
    logger.info('✅ Journal cron scheduler stopped');
  }

  /**
   * Generate journals for all active users
   */
  async generateNightlyJournals(date = null) {
    const startTime = Date.now();
    
    try {
      // Use today's date (will become "yesterday" after midnight)
      const journalDate = date || this.getCurrentISTDate();
      
      logger.info(`📅 Generating journals for date: ${journalDate}`);

      // Get all users who have messages today
      const userMessages = await prisma.message.findMany({
        where: {
          createdAt: {
            gte: new Date(`${journalDate}T00:00:00Z`),
            lte: new Date(`${journalDate}T23:59:59Z`)
          }
        },
        select: { userId: true }
      });

      // Deduplicate user IDs
      const uniqueUserIds = [...new Set(userMessages.map(m => m.userId))];
      
      logger.info(`👥 Found ${uniqueUserIds.length} users with messages today`);
      
      if (uniqueUserIds.length === 0) {
        logger.info('📝 No users with messages for journal generation');
        return { success: 0, skipped: 0, failed: 0 };
      }

      let successCount = 0;
      let skippedCount = 0;
      let errorCount = 0;
      const errors = [];
      
      // Process users in batches
      const batchSize = 5;
      
      for (let i = 0; i < uniqueUserIds.length; i += batchSize) {
        this.assertLock?.();
        const batch = uniqueUserIds.slice(i, i + batchSize);
        
        logger.info(`📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(uniqueUserIds.length / batchSize)}`);
        
        const batchResults = await Promise.allSettled(
          batch.map(userId => this.generateJournalForUser(userId, journalDate))
        );
        
        batchResults.forEach((result, idx) => {
          const userId = batch[idx];
          
          if (result.status === 'fulfilled') {
            const { success, skipped } = result.value;
            if (success && !skipped) {
              successCount++;
            } else if (skipped) {
              skippedCount++;
            }
          } else {
            errorCount++;
            errors.push({ userId, error: result.reason?.message || 'Unknown error' });
            logger.error(`❌ Failed for user ${userId}: ${result.reason?.message}`);
          }
        });
        
        // Small delay between batches
        if (i + batchSize < uniqueUserIds.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      const duration = Date.now() - startTime;
      
      logger.info('\n📊 Journal Generation Summary:');
      logger.info(`   ✅ Successful: ${successCount}`);
      logger.info(`   ⏭️ Skipped: ${skippedCount}`);
      logger.info(`   ❌ Errors: ${errorCount}`);
      logger.info(`   ⏱️ Total time: ${(duration / 1000).toFixed(2)}s`);
      logger.info(`   📅 Date: ${journalDate}`);
      
      return { success: successCount, skipped: skippedCount, failed: errorCount, errors };

    } catch (error) {
      logger.error('💥 Critical error in nightly journal generation:', error);
      throw error;
    }
  }

  /**
   * Generate journal for a specific user and date (auto-run)
   */
  async generateJournalForUser(userId, journalDate) {
    try {
      logger.info(`📖 Generating journal for user ${userId} on ${journalDate}`);
      
      // Use the new journalGenerator.generateDailyJournal method
      // Auto-run: force=false (skip if no messages), manual=false (auto-generated)
      const result = await journalGenerator.generateDailyJournal(userId, journalDate, {
        force: false,
        manual: false,
        ensureLock: () => this.assertLock?.()
      });
      
      if (result.skipped) {
        logger.info(`⏭️ Skipped journal for ${userId}: ${result.reason}`);
        return { success: true, skipped: true, reason: result.reason };
      }
      
      logger.info(`✅ Journal saved for user ${userId}`);
      return { success: true, skipped: false };
      
    } catch (error) {
      logger.error(`❌ Error generating journal for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Manual trigger for testing
   */
  async triggerManualGeneration(userId = null, date = null) {
    const journalDate = date || this.getCurrentISTDate();
    
    if (userId) {
      // Generate for specific user
      logger.info(`🧪 Manual generation for user ${userId} on ${journalDate}`);
      return await journalGenerator.generateDailyJournal(userId, journalDate, {
        force: true,
        manual: true
      });
    } else {
      // Generate for all users
      logger.info(`🧪 Manual generation for all users on ${journalDate}`);
      return await this.runNightly({ date: journalDate });
    }
  }
}

export default new CronScheduler();
