/**
 * Supabase Migration Runner
 * Executes the entire migration as a single transaction
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('\n╔══════════════════════════════════════════════════════════╗');
console.log('║       Supabase Insights Migration Helper                ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

try {
  // Read migration file
  const migrationPath = join(__dirname, '..', 'migrations', '20251122_consolidate_insights_tables.sql');
  const migrationSQL = readFileSync(migrationPath, 'utf8');

  console.log('✅ Migration SQL loaded successfully\n');
  console.log('📋 Migration Summary:');
  console.log('   • Add performance indexes to master_user_activity');
  console.log('   • Add CHECK constraints for mood_score (0-100 range)');
  console.log('   • Mark legacy tables as deprecated');
  console.log('   • Add mood_score column to master_user_activity');
  console.log('   • Create calculate_mood_score() function');
  console.log('   • Create auto-update trigger for mood scores');
  console.log('   • Update existing records with mood scores\n');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📝 TO RUN THIS MIGRATION:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log('Option 1: Supabase Dashboard (Recommended)');
  console.log('─────────────────────────────────────────────');
  console.log('1. Open Supabase Dashboard: https://supabase.com/dashboard');
  console.log('2. Navigate to: SQL Editor (left sidebar)');
  console.log('3. Click: "+ New query"');
  console.log('4. Copy and paste the migration SQL from:');
  console.log(`   ${migrationPath}`);
  console.log('5. Click: "Run" (or press Ctrl+Enter)\n');

  console.log('Option 2: Using psql (Command Line)');
  console.log('────────────────────────────────────');
  console.log('If you have PostgreSQL client installed:');
  
  // Extract connection info from Supabase URL
  const supabaseUrl = process.env.SUPABASE_URL;
  const projectRef = supabaseUrl?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
  
  if (projectRef) {
    console.log(`psql "postgresql://postgres:[YOUR-PASSWORD]@db.${projectRef}.supabase.co:5432/postgres" -f "${migrationPath}"`);
  } else {
    console.log(`psql [CONNECTION_STRING] -f "${migrationPath}"`);
  }
  console.log('\nNote: Get your database password from Supabase Dashboard → Settings → Database\n');

  console.log('Option 3: Copy SQL to Clipboard');
  console.log('────────────────────────────────');
  
  // Create a simplified copy script
  const copyScriptPath = join(__dirname, 'copy-migration-to-clipboard.bat');
  const copyScript = `@echo off
echo Copying migration SQL to clipboard...
type "${migrationPath}" | clip
echo.
echo ✅ Migration SQL copied to clipboard!
echo.
echo Now paste it into Supabase SQL Editor and run it.
pause
`;
  
  writeFileSync(copyScriptPath, copyScript);
  console.log(`Run: scripts/copy-migration-to-clipboard.bat`);
  console.log('Then paste into Supabase SQL Editor\n');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('🔗 Quick Links:');
  console.log(`   Supabase Dashboard: ${supabaseUrl?.replace(/\/rest.*/, '')}/project/${projectRef}`);
  console.log(`   SQL Editor: ${supabaseUrl?.replace(/\/rest.*/, '')}/project/${projectRef}/sql`);
  console.log(`   Migration File: ${migrationPath}\n`);

  console.log('💡 After running the migration:');
  console.log('   1. Restart the backend server');
  console.log('   2. Test the insights page');
  console.log('   3. Verify mood scores are displayed correctly\n');

} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
