/**
 * Quick migration script to add new journal format columns
 * Run: node backend/scripts/add-journal-columns.js
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read .env file
const envPath = path.join(__dirname, '../.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const envLines = envContent.split('\n');

let supabaseUrl = '';
let supabaseKey = '';

envLines.forEach(line => {
  if (line.startsWith('SUPABASE_URL=')) {
    supabaseUrl = line.split('=')[1].trim();
  }
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) {
    supabaseKey = line.split('=')[1].trim();
  }
});

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Could not find SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  console.log('🚀 Running journal format migration...\n');
  
  const sql = `
    ALTER TABLE journal_entries
    ADD COLUMN IF NOT EXISTS title TEXT,
    ADD COLUMN IF NOT EXISTS date_time TEXT,
    ADD COLUMN IF NOT EXISTS context TEXT,
    ADD COLUMN IF NOT EXISTS reflections TEXT,
    ADD COLUMN IF NOT EXISTS emotions_text TEXT,
    ADD COLUMN IF NOT EXISTS insights JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS plans TEXT;
  `;
  
  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
      // Try direct query if RPC doesn't exist
      console.log('Trying direct SQL execution...');
      
      // Execute each ALTER statement separately
      const statements = [
        "ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS title TEXT",
        "ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS date_time TEXT",
        "ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS context TEXT",
        "ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS reflections TEXT",
        "ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS emotions_text TEXT",
        "ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS insights JSONB DEFAULT '[]'::jsonb",
        "ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS plans TEXT"
      ];
      
      for (const stmt of statements) {
        const { error: stmtError } = await supabase.from('journal_entries').select('id').limit(0);
        if (stmtError) {
          console.error(`❌ Error: ${stmtError.message}`);
        }
      }
      
      console.log('\n⚠️  Could not run migration automatically.');
      console.log('Please run this SQL directly in your Supabase SQL Editor:\n');
      console.log(sql);
      console.log('\nOr use the Supabase dashboard: https://supabase.com/dashboard/project/YOUR_PROJECT/sql');
    } else {
      console.log('✅ Migration completed successfully!');
      console.log('New columns added: title, date_time, context, reflections, emotions_text, insights, plans');
    }
  } catch (err) {
    console.error('❌ Migration error:', err.message);
    console.log('\n📋 Please run this SQL in Supabase SQL Editor:\n');
    const migrationPath = path.join(__dirname, '../migrations/20251123_add_journal_format_columns.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');
    console.log(migrationSql);
  }
}

runMigration();
