import cronScheduler from './cronScheduler.js';
import journalGenerator from './journalGenerator.js';

/**
 * Journal Service - Automated journal generation system
 * 
 * This service manages:
 * 1. Nightly cron jobs for automatic journal generation
 * 2. Manual journal generation for testing/backfilling
 * 3. Journal content generation using AI (Gemini) and fallback templates
 * 4. Integration with master_user_activity table for unified data access
 */

class JournalService {
  constructor() {
    this.isInitialized = false;
  }

  /**
   * Initialize the journal service and start cron scheduler
   */
  async initialize() {
    try {
      console.log('🚀 Initializing Journal Service...');
      
      // Start cron scheduler for nightly generation
      cronScheduler.start();
      
      this.isInitialized = true;
      console.log('✅ Journal Service initialized successfully');
      
      // Log current schedule
      console.log(`📅 Nightly journal generation scheduled for: ${cronScheduler.cronSchedule}`);
      console.log(`🌍 Timezone: Asia/Kolkata (IST)`);
      
    } catch (error) {
      console.error('❌ Failed to initialize Journal Service:', error);
      throw error;
    }
  }

  /**
   * Stop the journal service
   */
  async shutdown() {
    try {
      console.log('🛑 Shutting down Journal Service...');
      
      cronScheduler.stop();
      
      this.isInitialized = false;
      console.log('✅ Journal Service shut down successfully');
      
    } catch (error) {
      console.error('❌ Error during Journal Service shutdown:', error);
    }
  }

  /**
   * Manual journal generation for testing or backfilling
   */
  async generateJournal(userId, date = null) {
    if (!this.isInitialized) {
      throw new Error('Journal Service not initialized');
    }
    
    return await cronScheduler.triggerManualGeneration(userId, date);
  }

  /**
   * Generate journals for all users (manual trigger)
   */
  async generateAllJournals(date = null) {
    if (!this.isInitialized) {
      throw new Error('Journal Service not initialized');
    }
    
    return await cronScheduler.triggerManualGeneration(null, date);
  }

  /**
   * Generate journal content only (without saving to database)
   */
  async generateJournalContent(activities, options = {}) {
    return await journalGenerator.generateJournal(activities, options);
  }

  /**
   * Generate journals for a date range (for bulk backfilling)
   */
  async generateJournalsForDateRange(userId, startDate, endDate) {
    if (!this.isInitialized) {
      throw new Error('Journal Service not initialized');
    }
    
    return await journalGenerator.generateJournalsForDateRange(userId, startDate, endDate);
  }

  /**
   * Check service status
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      cron_running: cronScheduler.isRunning || false,
      schedule: cronScheduler.cronSchedule,
      timezone: 'Asia/Kolkata'
    };
  }
}

// Export singleton instance
const journalService = new JournalService();

export {
  journalService,
  cronScheduler,
  journalGenerator
};
