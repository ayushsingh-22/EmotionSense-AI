/**
 * Direct Migration Runner
 * Executes SQL migration directly using Supabase Admin API
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runMigration() {
  console.log('🚀 Running Insights Consolidation Migration\n');

  try {
    // Read migration file
    const migrationPath = join(__dirname, '..', 'migrations', '20251122_consolidate_insights_tables.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf8');

    console.log('📝 Migration loaded. Executing via Supabase...\n');

    // Split into executable chunks (DO blocks and regular statements)
    const chunks = [];
    let currentChunk = '';
    let inDoBlock = false;

    migrationSQL.split('\n').forEach(line => {
      const trimmed = line.trim();
      
      // Skip pure comment lines
      if (trimmed.startsWith('--') && !inDoBlock) {
        return;
      }

      // Track DO blocks
      if (trimmed.startsWith('DO $$') || trimmed.startsWith('DO$$')) {
        inDoBlock = true;
      }

      currentChunk += line + '\n';

      // End of DO block
      if (inDoBlock && trimmed === '$$;') {
        inDoBlock = false;
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }
      // Regular statement end
      else if (!inDoBlock && trimmed.endsWith(';') && !trimmed.startsWith('--')) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }
    });

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    // Filter out empty and comment-only chunks
    const validChunks = chunks.filter(chunk => {
      const cleaned = chunk.replace(/--[^\n]*\n/g, '').trim();
      return cleaned.length > 0;
    });

    console.log(`Found ${validChunks.length} SQL statements to execute\n`);

    // Execute each chunk
    let successCount = 0;
    let skipCount = 0;

    for (let i = 0; i < validChunks.length; i++) {
      const chunk = validChunks[i];
      const preview = chunk.substring(0, 60).replace(/\n/g, ' ');
      
      console.log(`[${i + 1}/${validChunks.length}] ${preview}...`);

      try {
        const { data, error } = await supabase.rpc('exec_sql', { sql: chunk });
        
        if (error) {
          // Check if it's a "already exists" error (can be ignored)
          if (error.message.includes('already exists') || 
              error.message.includes('duplicate') ||
              error.message.includes('does not exist')) {
            console.log(`    ⚠️  Skipped (already exists or expected error)\n`);
            skipCount++;
          } else {
            console.log(`    ❌ Error: ${error.message}\n`);
          }
        } else {
          console.log(`    ✓ Success\n`);
          successCount++;
        }
      } catch (err) {
        console.log(`    ⚠️  ${err.message.substring(0, 80)}\n`);
      }
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Migration complete!`);
    console.log(`   Successful: ${successCount}`);
    console.log(`   Skipped: ${skipCount}`);
    console.log(`   Total: ${validChunks.length}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    console.error('\n💡 Manual migration recommended:');
    console.error('   Open: backend/migrations/20251122_consolidate_insights_tables.sql');
    console.error('   In: Supabase Dashboard → SQL Editor\n');
    process.exit(1);
  }
}

runMigration();
