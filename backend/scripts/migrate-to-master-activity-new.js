/**
 * Data Migration Script: Backfill master_user_activity from messages
 * 
 * Purpose: Migrate existing chat messages and emotion data to master_user_activity table
 * Usage: npm run migrate:master-activity
 * 
 * This script:
 * 1. Fetches all existing messages from messages table
 * 2. Creates activity records in master_user_activity
 * 3. Links activity to journal entries if applicable
 * 4. Updates statistics and completion status
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { DateTime } from 'luxon';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BATCH_SIZE = 500;
const LOG_PREFIX = '📊 Migration:';

/**
 * Helper to convert UTC timestamp to IST date
 */
function convertToISTDate(utcTimestamp) {
  const dt = DateTime.fromISO(utcTimestamp, { zone: 'utc' });
  const istDt = dt.setZone('Asia/Kolkata');
  return istDt.toFormat('yyyy-MM-dd');
}

/**
 * Emotion to mood score mapping
 */
const EMOTION_TO_MOOD = {
  anger: 15,
  disgust: 20,
  fear: 25,
  sadness: 30,
  anxious: 28,
  frustrated: 22,
  neutral: 50,
  surprise: 60,
  calm: 75,
  happy: 85,
  joy: 90,
  excited: 88,
  love: 95
};

function calculateMoodScore(emotion) {
  return EMOTION_TO_MOOD[emotion?.toLowerCase()] || 50;
}

/**
 * Main migration function
 */
async function migrateMessagesToMasterActivity() {
  console.log('\n' + '='.repeat(80));
  console.log('🚀 Starting Master User Activity Migration');
  console.log('='.repeat(80) + '\n');

  try {
    // Step 1: Verify master_user_activity table exists
    console.log(`${LOG_PREFIX} Verifying master_user_activity table exists...`);
    const { data: tableCheck, error: tableCheckError } = await supabase
      .from('master_user_activity')
      .select('id')
      .limit(1);

    if (tableCheckError && tableCheckError.code !== 'PGRST205') {
      throw new Error(`Failed to access master_user_activity table: ${tableCheckError.message}`);
    }
    console.log(`${LOG_PREFIX} ✅ master_user_activity table accessible\n`);

    // Step 2: Get total message count
    console.log(`${LOG_PREFIX} Fetching total message count...`);
    const { count: totalMessages, error: countError } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true });

    if (countError) {
      throw new Error(`Failed to count messages: ${countError.message}`);
    }
    console.log(`${LOG_PREFIX} Found ${totalMessages} messages to migrate\n`);

    // Step 3: Batch process messages
    console.log(`${LOG_PREFIX} Processing messages in batches of ${BATCH_SIZE}...`);
    let totalProcessed = 0;
    let totalSuccessful = 0;
    let totalFailed = 0;

    for (let offset = 0; offset < totalMessages; offset += BATCH_SIZE) {
      const { data: messageBatch, error: fetchError } = await supabase
        .from('messages')
        .select('*')
        .range(offset, offset + BATCH_SIZE - 1);

      if (fetchError) {
        console.error(`${LOG_PREFIX} ❌ Error fetching batch at offset ${offset}:`, fetchError.message);
        continue;
      }

      if (!messageBatch || messageBatch.length === 0) break;

      // Transform messages to activity records
      const activities = messageBatch.map(msg => ({
        user_id: msg.user_id,
        session_id: msg.session_id,
        message_id: msg.id,
        content: msg.content,
        role: msg.role,
        source: 'chat',
        primary_emotion: msg.emotion || 'neutral',
        emotion_scores: msg.emotion_confidence 
          ? { [msg.emotion || 'neutral']: msg.emotion_confidence }
          : {},
        mood_score: calculateMoodScore(msg.emotion),
        emotion_confidence: msg.emotion_confidence || 0.5,
        local_date: convertToISTDate(msg.created_at),
        belongs_to_journal: false,
        journal_generated: false,
        meta: {
          audio_url: msg.audio_url,
          metadata: msg.metadata,
          migrated_from: 'messages',
          migration_timestamp: new Date().toISOString()
        }
      }));

      // Insert batch
      const { data: inserted, error: insertError } = await supabase
        .from('master_user_activity')
        .insert(activities)
        .select('id');

      if (insertError) {
        console.error(`${LOG_PREFIX} ❌ Error inserting batch at offset ${offset}:`, insertError.message);
        totalFailed += activities.length;
      } else {
        totalSuccessful += (inserted?.length || 0);
      }

      totalProcessed += messageBatch.length;
      const progress = Math.round((totalProcessed / totalMessages) * 100);
      console.log(`${LOG_PREFIX} Progress: ${totalProcessed}/${totalMessages} (${progress}%) ✅ ${totalSuccessful} successful`);
    }

    console.log(`\n${LOG_PREFIX} ✨ Message migration complete!`);
    console.log(`${LOG_PREFIX} Total processed: ${totalProcessed}`);
    console.log(`${LOG_PREFIX} Successful: ${totalSuccessful}`);
    console.log(`${LOG_PREFIX} Failed: ${totalFailed}\n`);

    // Step 4: Link to daily journals if they exist
    console.log(`${LOG_PREFIX} Linking activities to journals (if any)...`);
    try {
      const { data: journals, error: journalError } = await supabase
        .from('daily_journals')
        .select('id, user_id, date');

      if (!journalError && journals && journals.length > 0) {
        let linkedCount = 0;

        for (const journal of journals) {
          const { data: updated, error: updateError } = await supabase
            .from('master_user_activity')
            .update({
              belongs_to_journal: true,
              journal_id: journal.id,
              journal_generated: true
            })
            .eq('user_id', journal.user_id)
            .eq('local_date', journal.date)
            .eq('role', 'user')
            .select('id');

          if (!updateError && updated) {
            linkedCount += updated.length;
          }
        }

        console.log(`${LOG_PREFIX} ✅ Linked ${linkedCount} activities to journals\n`);
      }
    } catch (journalLinkError) {
      console.warn(`${LOG_PREFIX} ⚠️  Could not link journals (non-critical):`, journalLinkError.message);
    }

    // Step 5: Get statistics
    console.log(`${LOG_PREFIX} Gathering migration statistics...`);
    
    const { data: stats } = await supabase
      .from('master_user_activity')
      .select('id', { count: 'exact' });

    const { data: emotionDist } = await supabase
      .from('master_user_activity')
      .select('primary_emotion')
      .neq('primary_emotion', 'neutral');

    const emotionCounts = {};
    (emotionDist || []).forEach(rec => {
      emotionCounts[rec.primary_emotion] = (emotionCounts[rec.primary_emotion] || 0) + 1;
    });

    console.log(`\n${LOG_PREFIX} 📊 Migration Statistics:`);
    console.log(`${LOG_PREFIX}   Total activities in table: ${stats?.length || 0}`);
    console.log(`${LOG_PREFIX}   Emotion distribution:`);
    Object.entries(emotionCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .forEach(([emotion, count]) => {
        console.log(`${LOG_PREFIX}     ${emotion}: ${count}`);
      });

    // Step 6: Verify data integrity
    console.log(`\n${LOG_PREFIX} Verifying data integrity...`);
    
    const { data: orphanedActivities } = await supabase
      .from('master_user_activity')
      .select('id')
      .is('user_id', null);

    if (orphanedActivities && orphanedActivities.length > 0) {
      console.warn(`${LOG_PREFIX} ⚠️  Found ${orphanedActivities.length} orphaned activities (user_id is null)`);
    } else {
      console.log(`${LOG_PREFIX} ✅ All activities have valid user_id`);
    }

    console.log('\n' + '='.repeat(80));
    console.log('✨ Migration completed successfully!');
    console.log('='.repeat(80) + '\n');

    return {
      success: true,
      totalProcessed,
      totalSuccessful,
      totalFailed,
      statistics: {
        totalActivities: stats?.length || 0,
        topEmotions: Object.entries(emotionCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
      }
    };

  } catch (error) {
    console.error('\n' + '='.repeat(80));
    console.error('❌ Migration failed:', error.message);
    console.error('='.repeat(80) + '\n');
    throw error;
  }
}

/**
 * Rollback function (if needed)
 */
async function rollbackMigration() {
  console.log('\n' + '='.repeat(80));
  console.log('🔄 Rolling back Master User Activity Migration');
  console.log('='.repeat(80) + '\n');

  try {
    console.log(`${LOG_PREFIX} Deleting migrated activities (marked with migrated_from: messages)...`);
    
    const { data: deleted, error: deleteError } = await supabase
      .from('master_user_activity')
      .delete()
      .eq('migrated_from', 'messages')
      .select('id', { count: 'exact' });

    if (deleteError) {
      throw deleteError;
    }

    console.log(`${LOG_PREFIX} ✅ Deleted ${deleted?.length || 0} activity records\n`);

    console.log('='.repeat(80));
    console.log('✨ Rollback completed!');
    console.log('='.repeat(80) + '\n');

    return { success: true, deletedCount: deleted?.length || 0 };

  } catch (error) {
    console.error('❌ Rollback failed:', error.message);
    throw error;
  }
}

// Run migration
const command = process.argv[2] || 'migrate';

if (command === 'migrate') {
  migrateMessagesToMasterActivity()
    .then(result => {
      console.log('Result:', result);
      process.exit(0);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
} else if (command === 'rollback') {
  rollbackMigration()
    .then(result => {
      console.log('Result:', result);
      process.exit(0);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
} else {
  console.error('Unknown command:', command);
  console.error('Usage: node migrate-to-master-activity.js [migrate|rollback]');
  process.exit(1);
}
