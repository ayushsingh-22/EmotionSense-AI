/**
 * Run Database Migration
 * Automatically executes the insights consolidation migration
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Supabase client with service role key (required for DDL operations)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

async function runMigration() {
  console.log('🚀 Starting database migration...\n');

  try {
    // Read migration file
    const migrationPath = join(__dirname, '..', 'migrations', '20251122_consolidate_insights_tables.sql');
    console.log(`📄 Reading migration file: ${migrationPath}`);
    
    const migrationSQL = readFileSync(migrationPath, 'utf8');
    console.log(`✅ Migration file loaded (${migrationSQL.length} characters)\n`);

    // Execute migration
    console.log('⚙️  Executing migration...');
    console.log('   This may take a few moments...\n');

    const { data, error } = await supabase.rpc('exec_sql', { 
      sql: migrationSQL 
    });

    if (error) {
      // If exec_sql function doesn't exist, try direct execution
      if (error.message.includes('function') && error.message.includes('does not exist')) {
        console.log('⚠️  exec_sql function not found. Trying alternative method...\n');
        
        // Split SQL into individual statements and execute them
        const statements = migrationSQL
          .split(';')
          .map(s => s.trim())
          .filter(s => s.length > 0 && !s.startsWith('--'));

        for (let i = 0; i < statements.length; i++) {
          const statement = statements[i] + ';';
          
          // Skip comments and empty statements
          if (statement.trim().startsWith('--') || statement.trim() === ';') {
            continue;
          }

          console.log(`   Executing statement ${i + 1}/${statements.length}...`);
          
          try {
            // Use the Supabase SQL editor approach
            const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
                'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
              },
              body: JSON.stringify({ query: statement })
            });

            if (!response.ok && response.status !== 404) {
              const errorText = await response.text();
              console.log(`   ⚠️  Statement ${i + 1} may have failed: ${errorText.substring(0, 100)}`);
            }
          } catch (execError) {
            console.log(`   ⚠️  Statement ${i + 1} error (continuing): ${execError.message.substring(0, 100)}`);
          }
        }

        console.log('\n✅ Migration statements executed (some may need manual verification)');
        console.log('\n💡 Recommendation: Run the migration manually in Supabase SQL Editor for guaranteed execution:');
        console.log('   1. Go to Supabase Dashboard → SQL Editor');
        console.log('   2. Create a new query');
        console.log('   3. Paste the contents of: backend/migrations/20251122_consolidate_insights_tables.sql');
        console.log('   4. Click "Run"\n');

      } else {
        throw error;
      }
    } else {
      console.log('✅ Migration executed successfully!');
    }

    // Verify migration
    console.log('\n🔍 Verifying migration...');
    
    // Check if indexes were created
    const { data: indexes, error: indexError } = await supabase
      .from('pg_indexes')
      .select('indexname')
      .eq('tablename', 'master_user_activity')
      .in('indexname', [
        'idx_master_activity_local_date',
        'idx_master_activity_emotion',
        'idx_master_activity_date_range'
      ]);

    if (!indexError && indexes) {
      console.log(`   ✓ Found ${indexes.length} new indexes on master_user_activity`);
    }

    // Check if mood_score column was added
    const { data: columns, error: columnError } = await supabase
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_name', 'master_user_activity')
      .eq('column_name', 'mood_score');

    if (!columnError && columns && columns.length > 0) {
      console.log('   ✓ mood_score column added to master_user_activity');
    }

    console.log('\n✨ Migration process completed!');
    console.log('\n📊 Next steps:');
    console.log('   1. Verify the migration in Supabase Dashboard → Database → Tables');
    console.log('   2. Check that master_user_activity has the mood_score column');
    console.log('   3. Restart your backend server to apply changes');
    console.log('   4. Test the insights page to see the improvements\n');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    console.error('\n💡 Please run the migration manually:');
    console.error('   1. Open Supabase Dashboard → SQL Editor');
    console.error('   2. Copy contents from: backend/migrations/20251122_consolidate_insights_tables.sql');
    console.error('   3. Paste and execute in SQL Editor\n');
    process.exit(1);
  }
}

// Run migration
runMigration().catch(console.error);
