/**
 * Cleanup Script: Remove data from legacy tables
 * 
 * This script removes data from tables that are no longer needed
 * after migration to master_user_activity:
 * 
 * TABLES TO CLEAN (delete data):
 * - emotions
 * - emotion_analysis
 * - multimodal_logs
 * - journal_entries (data only, keep table structure)
 * - weekly_insights (data only, keep table structure)
 * 
 * TABLES TO PRESERVE:
 * - messages (needed for backward compatibility)
 * - chat_sessions (needed for chat functionality)
 * - profiles (authentication)
 * - emergency_contacts (safety feature)
 * - safety_alerts (safety feature)
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Ask for user confirmation
 */
function askConfirmation(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
}

/**
 * Delete data from a table
 */
async function cleanTable(tableName, description) {
  try {
    console.log(`\n🧹 Cleaning ${tableName} (${description})...`);
    
    // Count before deletion
    const { count: beforeCount } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true });

    if (!beforeCount || beforeCount === 0) {
      console.log(`   ℹ️  Table is already empty (0 rows)`);
      return true;
    }

    console.log(`   📊 Found ${beforeCount} rows to delete`);

    // Delete all rows
    const { error } = await supabase
      .from(tableName)
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all (using impossible condition)

    if (error) {
      console.error(`   ❌ Error: ${error.message}`);
      return false;
    }

    // Verify deletion
    const { count: afterCount } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true });

    console.log(`   ✅ Successfully deleted ${beforeCount} rows (${afterCount || 0} remaining)`);
    return true;

  } catch (error) {
    console.error(`   ❌ Failed to clean ${tableName}:`, error.message);
    return false;
  }
}

/**
 * Main cleanup function
 */
async function cleanupLegacyTables() {
  console.log('🧹 Legacy Table Cleanup Script');
  console.log('═'.repeat(60));
  console.log('\nThis script will DELETE DATA from the following tables:');
  console.log('  • emotions');
  console.log('  • emotion_analysis');
  console.log('  • multimodal_logs');
  console.log('  • journal_entries');
  console.log('  • weekly_insights');
  console.log('\n⚠️  WARNING: This action cannot be undone!');
  console.log('⚠️  Make sure you have completed the migration first!');
  console.log('\n');

  const confirmed = await askConfirmation('Do you want to proceed? (yes/no): ');

  if (!confirmed) {
    console.log('\n❌ Cleanup cancelled by user.');
    process.exit(0);
  }

  console.log('\n🚀 Starting cleanup...');

  const tables = [
    { name: 'emotions', description: 'Old emotion records' },
    { name: 'emotion_analysis', description: 'Old emotion analysis logs' },
    { name: 'multimodal_logs', description: 'Old multimodal logs' },
    { name: 'journal_entries', description: 'Old journal entries' },
    { name: 'weekly_insights', description: 'Old weekly insights' }
  ];

  let successCount = 0;
  let failCount = 0;

  for (const table of tables) {
    const success = await cleanTable(table.name, table.description);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
  }

  console.log('\n' + '═'.repeat(60));
  console.log('📊 Cleanup Summary:');
  console.log(`   Successfully cleaned: ${successCount} tables`);
  console.log(`   Failed: ${failCount} tables`);

  if (failCount === 0) {
    console.log('\n🎉 Cleanup completed successfully!');
  } else {
    console.log('\n⚠️  Cleanup completed with some errors.');
  }

  console.log('\n📝 Note: The table structures remain intact.');
  console.log('   Only the data has been removed.');
}

// Run cleanup
cleanupLegacyTables()
  .then(() => {
    console.log('\n✨ Cleanup script completed.');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  });
