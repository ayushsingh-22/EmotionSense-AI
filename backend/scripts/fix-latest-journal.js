
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import journalGenerator from '../src/journal-service/journalGenerator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load env vars from absolute path
const envPath = join(process.cwd(), '.env');
console.log('Loading .env from:', envPath);
dotenv.config({ path: envPath });

console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'Found' : 'Missing');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

async function fixLatestJournal() {
  console.log('🔧 Fixing latest journal entry...');
  
  try {
    // Get the most recent journal entry to find the user and date
    const { data: journals, error } = await supabase
      .from('journal_entries')
      .select('user_id, date')
      .order('date', { ascending: false })
      .limit(1);
      
    if (error || !journals || journals.length === 0) {
      console.error('❌ Could not find any journal entries');
      return;
    }
    
    const { user_id, date } = journals[0];
    console.log(`👤 User: ${user_id}`);
    console.log(`📅 Date: ${date}`);
    
    // Regenerate the journal
    console.log('🔄 Regenerating journal...');
    const result = await journalGenerator.generateDailyJournal(user_id, date, { forceRegenerate: true });
    
    if (result.success) {
      console.log('✅ Journal regenerated successfully!');
      
      // Verify time_segments
      const { data: newJournal } = await supabase
        .from('journal_entries')
        .select('emotion_summary')
        .eq('user_id', user_id)
        .eq('date', date)
        .single();
        
      if (newJournal?.emotion_summary?.time_segments) {
        console.log('✨ Verified: time_segments are present in the new entry');
        console.log('📊 Segments:', JSON.stringify(newJournal.emotion_summary.time_segments, null, 2));
      } else {
        console.warn('⚠️ Warning: time_segments still missing from database record');
      }
    } else {
      console.error('❌ Failed to regenerate journal:', result);
    }
    
  } catch (err) {
    console.error('❌ Error:', err);
  }
}

fixLatestJournal();
