// Load environment variables first
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Database connection configuration
const config = {
  connectionString: process.env.SUPABASE_DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
};

class MasterActivityMigrator {
  constructor() {
    this.client = new Client(config);
    this.summary = {
      messages: { total: 0, migrated: 0, skipped: 0, errors: 0 },
      emotions: { total: 0, migrated: 0, skipped: 0, errors: 0 },
      emotion_analysis: { total: 0, migrated: 0, skipped: 0, errors: 0 },
      multimodal_logs: { total: 0, migrated: 0, skipped: 0, errors: 0 }
    };
  }

  async connect() {
    try {
      await this.client.connect();
      console.log('✅ Connected to database');
    } catch (error) {
      console.error('❌ Failed to connect to database:', error.message);
      throw error;
    }
  }

  async disconnect() {
    await this.client.end();
    console.log('🔌 Disconnected from database');
  }

  async checkMigrationStatus() {
    try {
      // Check if data has already been migrated
      const result = await this.client.query(`
        SELECT legacy_table, COUNT(*) as count
        FROM master_user_activity 
        WHERE legacy_table IS NOT NULL
        GROUP BY legacy_table
      `);
      
      console.log('📊 Current migration status:');
      if (result.rows.length === 0) {
        console.log('   No legacy data found in master_user_activity');
        return false;
      }
      
      result.rows.forEach(row => {
        console.log(`   ${row.legacy_table}: ${row.count} records already migrated`);
      });
      
      return true;
    } catch (error) {
      console.error('❌ Error checking migration status:', error.message);
      return false;
    }
  }

  async migrateMessages() {
    console.log('\n📧 Migrating messages table...');
    
    try {
      // Get total count
      const countResult = await this.client.query('SELECT COUNT(*) as total FROM messages');
      this.summary.messages.total = parseInt(countResult.rows[0].total);
      
      if (this.summary.messages.total === 0) {
        console.log('   No messages to migrate');
        return;
      }
      
      console.log(`   Found ${this.summary.messages.total} messages to process`);
      
      // Get messages that haven't been migrated yet
      const messagesResult = await this.client.query(`
        SELECT m.* 
        FROM messages m
        LEFT JOIN master_user_activity ma ON ma.legacy_id = m.id AND ma.legacy_table = 'messages'
        WHERE ma.id IS NULL
        ORDER BY m.created_at ASC
      `);
      
      console.log(`   ${messagesResult.rows.length} new messages to migrate`);
      
      for (const message of messagesResult.rows) {
        try {
          await this.client.query('BEGIN');
          
          // Determine activity type based on role
          const activityType = message.role === 'user' ? 'chat_message' : 'ai_response';
          
          // Build emotion_data JSON from existing fields
          const emotionData = {};
          if (message.emotion) emotionData.emotion = message.emotion;
          if (message.emotion_confidence) emotionData.confidence = message.emotion_confidence;
          if (message.metadata && message.metadata.emotion_scores) {
            emotionData.scores = message.metadata.emotion_scores;
          }
          
          // Build metadata JSON
          const metadata = { ...message.metadata };
          if (message.audio_url) metadata.audio_url = message.audio_url;
          metadata.migrated_from = 'messages';
          metadata.original_role = message.role;
          
          // Insert into master_user_activity
          const insertResult = await this.client.query(`
            INSERT INTO master_user_activity (
              user_id, session_id, activity_type, content, emotion_data, 
              metadata, legacy_id, legacy_table, created_at, local_date
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING id
          `, [
            message.user_id,
            message.session_id,
            activityType,
            message.content,
            JSON.stringify(emotionData),
            JSON.stringify(metadata),
            message.id,
            'messages',
            message.created_at,
            message.created_at ? new Date(message.created_at).toISOString().split('T')[0] : null
          ]);
          
          // Record in migration map
          await this.client.query(`
            INSERT INTO migration_legacy_map (legacy_table, legacy_id, master_activity_id)
            VALUES ($1, $2, $3)
          `, ['messages', message.id, insertResult.rows[0].id]);
          
          await this.client.query('COMMIT');
          this.summary.messages.migrated++;
          
          if (this.summary.messages.migrated % 50 === 0) {
            console.log(`   ⏳ Migrated ${this.summary.messages.migrated}/${messagesResult.rows.length} messages`);
          }
          
        } catch (error) {
          await this.client.query('ROLLBACK');
          console.error(`   ⚠️ Error migrating message ${message.id}:`, error.message);
          this.summary.messages.errors++;
        }
      }
      
      this.summary.messages.skipped = this.summary.messages.total - messagesResult.rows.length;
      console.log(`   ✅ Messages migration complete: ${this.summary.messages.migrated} migrated, ${this.summary.messages.skipped} skipped, ${this.summary.messages.errors} errors`);
      
    } catch (error) {
      console.error('❌ Failed to migrate messages:', error.message);
    }
  }

  async migrateEmotions() {
    console.log('\n😊 Migrating emotions table...');
    
    try {
      const countResult = await this.client.query('SELECT COUNT(*) as total FROM emotions');
      this.summary.emotions.total = parseInt(countResult.rows[0].total);
      
      if (this.summary.emotions.total === 0) {
        console.log('   No emotions to migrate');
        return;
      }
      
      console.log(`   Found ${this.summary.emotions.total} emotions to process`);
      
      const emotionsResult = await this.client.query(`
        SELECT e.* 
        FROM emotions e
        LEFT JOIN master_user_activity ma ON ma.legacy_id = e.id AND ma.legacy_table = 'emotions'
        WHERE ma.id IS NULL
        ORDER BY e.created_at ASC
      `);
      
      console.log(`   ${emotionsResult.rows.length} new emotions to migrate`);
      
      for (const emotion of emotionsResult.rows) {
        try {
          await this.client.query('BEGIN');
          
          // Build emotion_data JSON
          const emotionData = {
            emotion: emotion.emotion,
            confidence: emotion.confidence,
            model_used: emotion.model_used,
            input_type: emotion.input_type
          };
          
          // Build metadata
          const metadata = {
            migrated_from: 'emotions',
            original_input_type: emotion.input_type
          };
          
          // Insert into master_user_activity
          const insertResult = await this.client.query(`
            INSERT INTO master_user_activity (
              user_id, session_id, activity_type, content, emotion_data, 
              metadata, legacy_id, legacy_table, created_at, local_date
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING id
          `, [
            emotion.user_id,
            emotion.session_id,
            'emotion_analysis',
            null, // emotions table doesn't have content
            JSON.stringify(emotionData),
            JSON.stringify(metadata),
            emotion.id,
            'emotions',
            emotion.created_at,
            emotion.created_at ? new Date(emotion.created_at).toISOString().split('T')[0] : null
          ]);
          
          // Record in migration map
          await this.client.query(`
            INSERT INTO migration_legacy_map (legacy_table, legacy_id, master_activity_id)
            VALUES ($1, $2, $3)
          `, ['emotions', emotion.id, insertResult.rows[0].id]);
          
          await this.client.query('COMMIT');
          this.summary.emotions.migrated++;
          
        } catch (error) {
          await this.client.query('ROLLBACK');
          console.error(`   ⚠️ Error migrating emotion ${emotion.id}:`, error.message);
          this.summary.emotions.errors++;
        }
      }
      
      this.summary.emotions.skipped = this.summary.emotions.total - emotionsResult.rows.length;
      console.log(`   ✅ Emotions migration complete: ${this.summary.emotions.migrated} migrated, ${this.summary.emotions.skipped} skipped, ${this.summary.emotions.errors} errors`);
      
    } catch (error) {
      console.error('❌ Failed to migrate emotions:', error.message);
    }
  }

  async migrateEmotionAnalysis() {
    console.log('\n🔍 Migrating emotion_analysis table...');
    
    try {
      const countResult = await this.client.query('SELECT COUNT(*) as total FROM emotion_analysis');
      this.summary.emotion_analysis.total = parseInt(countResult.rows[0].total);
      
      if (this.summary.emotion_analysis.total === 0) {
        console.log('   No emotion_analysis to migrate');
        return;
      }
      
      console.log(`   Found ${this.summary.emotion_analysis.total} emotion_analysis records to process`);
      
      const analysisResult = await this.client.query(`
        SELECT ea.* 
        FROM emotion_analysis ea
        LEFT JOIN master_user_activity ma ON ma.legacy_id = ea.id AND ma.legacy_table = 'emotion_analysis'
        WHERE ma.id IS NULL
        ORDER BY ea.created_at ASC
      `);
      
      console.log(`   ${analysisResult.rows.length} new emotion_analysis records to migrate`);
      
      for (const analysis of analysisResult.rows) {
        try {
          await this.client.query('BEGIN');
          
          // Determine activity type based on analysis type
          const activityType = analysis.type === 'voice' ? 'voice_analysis' : 'emotion_analysis';
          
          // Build emotion_data JSON
          const emotionData = {
            emotion: analysis.emotion,
            confidence: analysis.confidence,
            scores: analysis.scores,
            audio_features: analysis.audio_features
          };
          
          // Build metadata
          const metadata = {
            ...analysis.metadata,
            migrated_from: 'emotion_analysis',
            original_type: analysis.type,
            transcript: analysis.transcript
          };
          
          // Insert into master_user_activity
          const insertResult = await this.client.query(`
            INSERT INTO master_user_activity (
              user_id, session_id, activity_type, content, emotion_data, 
              metadata, legacy_id, legacy_table, created_at, local_date
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING id
          `, [
            analysis.user_id,
            null, // emotion_analysis doesn't have session_id
            activityType,
            analysis.input_text || analysis.transcript,
            JSON.stringify(emotionData),
            JSON.stringify(metadata),
            analysis.id,
            'emotion_analysis',
            analysis.created_at || analysis.timestamp,
            (analysis.created_at || analysis.timestamp) ? 
              new Date(analysis.created_at || analysis.timestamp).toISOString().split('T')[0] : null
          ]);
          
          // Record in migration map
          await this.client.query(`
            INSERT INTO migration_legacy_map (legacy_table, legacy_id, master_activity_id)
            VALUES ($1, $2, $3)
          `, ['emotion_analysis', analysis.id, insertResult.rows[0].id]);
          
          await this.client.query('COMMIT');
          this.summary.emotion_analysis.migrated++;
          
        } catch (error) {
          await this.client.query('ROLLBACK');
          console.error(`   ⚠️ Error migrating emotion_analysis ${analysis.id}:`, error.message);
          this.summary.emotion_analysis.errors++;
        }
      }
      
      this.summary.emotion_analysis.skipped = this.summary.emotion_analysis.total - analysisResult.rows.length;
      console.log(`   ✅ Emotion_analysis migration complete: ${this.summary.emotion_analysis.migrated} migrated, ${this.summary.emotion_analysis.skipped} skipped, ${this.summary.emotion_analysis.errors} errors`);
      
    } catch (error) {
      console.error('❌ Failed to migrate emotion_analysis:', error.message);
    }
  }

  async refreshMaterializedViews() {
    console.log('\n🔄 Refreshing materialized views...');
    try {
      await this.client.query('SELECT refresh_insight_views()');
      console.log('   ✅ Materialized views refreshed');
    } catch (error) {
      console.error('   ⚠️ Error refreshing views:', error.message);
    }
  }

  printSummary() {
    console.log('\n📊 MIGRATION SUMMARY');
    console.log('='.repeat(50));
    
    let totalMigrated = 0;
    let totalErrors = 0;
    
    Object.entries(this.summary).forEach(([table, stats]) => {
      console.log(`\n${table.toUpperCase()}:`);
      console.log(`   Total found: ${stats.total}`);
      console.log(`   Migrated: ${stats.migrated}`);
      console.log(`   Skipped: ${stats.skipped}`);
      console.log(`   Errors: ${stats.errors}`);
      
      totalMigrated += stats.migrated;
      totalErrors += stats.errors;
    });
    
    console.log(`\nOVERALL:`);
    console.log(`   Total records migrated: ${totalMigrated}`);
    console.log(`   Total errors: ${totalErrors}`);
    
    if (totalErrors === 0) {
      console.log('\n✅ Migration completed successfully!');
    } else {
      console.log(`\n⚠️ Migration completed with ${totalErrors} errors. Check logs above.`);
    }
  }

  async rollback() {
    console.log('\n🔄 ROLLBACK MODE: Removing migrated data...');
    
    try {
      // Get count of migrated records
      const countResult = await this.client.query(`
        SELECT COUNT(*) as count 
        FROM master_user_activity 
        WHERE legacy_table IS NOT NULL
      `);
      
      const migratedCount = parseInt(countResult.rows[0].count);
      console.log(`   Found ${migratedCount} migrated records to remove`);
      
      if (migratedCount === 0) {
        console.log('   No migrated data to rollback');
        return;
      }
      
      // Delete from migration map first
      await this.client.query('DELETE FROM migration_legacy_map');
      console.log('   ✅ Cleared migration_legacy_map');
      
      // Delete migrated activities
      const deleteResult = await this.client.query(`
        DELETE FROM master_user_activity 
        WHERE legacy_table IS NOT NULL
      `);
      
      console.log(`   ✅ Removed ${deleteResult.rowCount} migrated records`);
      console.log('   🔄 Rollback completed successfully');
      
    } catch (error) {
      console.error('❌ Rollback failed:', error.message);
      throw error;
    }
  }

  async run(rollback = false) {
    console.log('🚀 Master User Activity Migration Script');
    console.log('========================================');
    
    if (!process.env.SUPABASE_DATABASE_URL) {
      console.error('❌ SUPABASE_DATABASE_URL environment variable is required');
      process.exit(1);
    }
    
    try {
      await this.connect();
      
      if (rollback) {
        await this.rollback();
      } else {
        const alreadyMigrated = await this.checkMigrationStatus();
        
        if (alreadyMigrated) {
          console.log('\n⚠️ Some data has already been migrated. Continuing with new data only...');
        }
        
        // Run migrations
        await this.migrateMessages();
        await this.migrateEmotions();
        await this.migrateEmotionAnalysis();
        
        // Refresh materialized views
        await this.refreshMaterializedViews();
        
        // Print summary
        this.printSummary();
      }
      
    } catch (error) {
      console.error('💥 Migration failed:', error.message);
      process.exit(1);
    } finally {
      await this.disconnect();
    }
  }
}

// CLI handling
const args = process.argv.slice(2);
const rollback = args.includes('--rollback') || args.includes('-r');

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Master User Activity Migration Script

Usage:
  node migrate-to-master-activity.js [options]

Options:
  --rollback, -r    Rollback migration (remove migrated data)
  --help, -h        Show this help message

Environment Variables:
  SUPABASE_DATABASE_URL    Database connection string (required)

Examples:
  node migrate-to-master-activity.js          # Run migration
  node migrate-to-master-activity.js -r       # Rollback migration
  `);
  process.exit(0);
}

// Run migration
const migrator = new MasterActivityMigrator();
migrator.run(rollback);
