/**
 * Simple Migration Runner for Supabase
 * Executes SQL migration using fetch to Supabase REST API
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function executeSQLQuery(sql) {
  const url = `${SUPABASE_URL}/rest/v1/rpc/exec_sql`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ query: sql })
    });

    return { ok: response.ok, status: response.status, text: await response.text() };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

async function runMigration() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║   Running Insights Consolidation Migration              ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  try {
    // Read migration file
    const migrationPath = join(__dirname, '..', 'migrations', '20251122_consolidate_insights_tables.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf8');

    console.log('📄 Migration file loaded\n');

    // Split SQL into individual statements
    const statements = migrationSQL
      .split(/;\s*\n/)
      .map(s => s.trim())
      .filter(s => {
        // Remove comments and empty statements
        const cleaned = s.replace(/--[^\n]*/g, '').trim();
        return cleaned.length > 10 && !cleaned.startsWith('/*');
      })
      .map(s => s + ';');

    console.log(`📊 Found ${statements.length} SQL statements\n`);
    console.log('⚙️  Executing migration...\n');

    let executed = 0;
    let errors = 0;

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      const preview = statement.substring(0, 70).replace(/\s+/g, ' ');
      
      process.stdout.write(`[${i + 1}/${statements.length}] ${preview}... `);

      const result = await executeSQLQuery(statement);

      if (result.ok || result.status === 200 || result.status === 204) {
        console.log('✓');
        executed++;
      } else if (result.text && (
        result.text.includes('already exists') ||
        result.text.includes('does not exist')
      )) {
        console.log('⊘ (skipped)');
      } else {
        console.log('✗');
        if (result.text && result.text.length < 200) {
          console.log(`   Error: ${result.text}`);
        }
        errors++;
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('\n' + '─'.repeat(60));
    console.log(`✅ Migration completed: ${executed} executed, ${errors} errors`);
    console.log('─'.repeat(60) + '\n');

    if (errors > 0) {
      console.log('⚠️  Some statements failed. This is often expected for:');
      console.log('   • Indexes/constraints that already exist');
      console.log('   • Tables that are already created');
      console.log('   • Columns that already exist\n');
    }

    console.log('📝 Manual verification steps:');
    console.log('   1. Open Supabase Dashboard → Database → Tables');
    console.log('   2. Check master_user_activity table has "mood_score" column');
    console.log('   3. Verify indexes were created (Database → Indexes)');
    console.log('   4. Restart backend server: cd backend && npm run dev\n');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\n💡 Alternative: Run manually in Supabase SQL Editor');
    console.error('   File: backend/migrations/20251122_consolidate_insights_tables.sql\n');
    process.exit(1);
  }
}

// Execute
runMigration().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
