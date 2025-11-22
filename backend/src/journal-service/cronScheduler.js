import cron from 'node-cron';
import journalGenerator from './journalGenerator.js';
import { createClient} from '@supabase/supabase-js';
import config from '../config/index.js';
import logger from '../utils/logger.js';

class CronScheduler {
  constructor() {
    this.supabase = createClient(
      config.database.supabase.url,
      config.database.supabase.serviceRoleKey || config.database.supabase.anonKey
    );
    
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
  start() {
    logger.info(`📅 Starting journal cron scheduler: ${this.cronSchedule} (Asia/Kolkata)`);
    
    // Schedule nightly journal generation
    this.cronTask = cron.schedule(this.cronSchedule, async () => {
      if (this.isRunning) {
        logger.warn('⚠️ Journal generation already in progress, skipping...');
        return;
      }

      this.isRunning = true;
      logger.info('\n🌙 Starting nightly journal generation...');
      
      try {
        await this.generateNightlyJournals();
        logger.info('✅ Nightly journal generation completed');
      } catch (error) {
        logger.error('❌ Nightly journal generation failed:', error);
      } finally {
        this.isRunning = false;
      }
    }, {
      timezone: 'Asia/Kolkata'
    });

    logger.info('✅ Journal cron scheduler started');
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
  async generateNightlyJournals() {
    const startTime = Date.now();
    
    try {
      // Use today's date (will become "yesterday" after midnight)
      const journalDate = this.getCurrentISTDate();
      
      logger.info(`📅 Generating journals for date: ${journalDate}`);

      // Get all users who have messages today
      const { data: userMessages, error } = await this.supabase
        .from('messages')
        .select('user_id')
        .gte('created_at', `${journalDate}T00:00:00Z`)
        .lte('created_at', `${journalDate}T23:59:59Z`);
      
      if (error) {
        throw error;
      }
      
      // Deduplicate user IDs
      const uniqueUserIds = [...new Set(userMessages.map(m => m.user_id))];
      
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
        manual: false
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
      return await this.generateNightlyJournals();
    }
  }
}

export default new CronScheduler();
