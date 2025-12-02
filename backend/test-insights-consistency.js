/**
 * Test Script: Verify Insights and Journal Consistency
 * Tests that insights endpoint returns same emotion data as journal entries
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

async function testInsightsConsistency() {
  console.log('🧪 Testing Insights & Journal Consistency\n');
  console.log('=' .repeat(60));
  
  try {
    // Get a test user with journal entries
    const { data: journals, error: journalError } = await supabase
      .from('journal_entries')
      .select('user_id, date, emotion_summary')
      .not('emotion_summary', 'is', null)
      .order('date', { ascending: false })
      .limit(3);
    
    if (journalError || !journals || journals.length === 0) {
      console.log('❌ No journal entries found for testing');
      console.log('   Please create some journal entries first');
      return;
    }
    
    const testUserId = journals[0].user_id;
    const testDate = journals[0].date;
    
    console.log(`\n📝 Test User ID: ${testUserId}`);
    console.log(`📅 Test Date: ${testDate}\n`);
    
    // Fetch journal entry
    const { data: journal } = await supabase
      .from('journal_entries')
      .select('*')
      .eq('user_id', testUserId)
      .eq('date', testDate)
      .single();
    
    if (!journal) {
      console.log('❌ Journal entry not found');
      return;
    }
    
    const journalEmotion = journal.emotion_summary?.dominant_emotion || journal.emotion_summary?.primaryEmotion;
    const journalMoodScore = journal.emotion_summary?.mood_score || journal.emotion_summary?.moodScore;
    
    console.log('📖 JOURNAL DATA:');
    console.log(`   Dominant Emotion: ${journalEmotion}`);
    console.log(`   Mood Score: ${journalMoodScore}`);
    console.log(`   Emotion Counts:`, journal.emotion_summary?.emotion_counts || {});
    
    // Fetch insights via API
    const response = await fetch(
      `http://localhost:8080/api/insights/daily?userId=${testUserId}&startDate=${testDate}&endDate=${testDate}`
    );
    
    if (!response.ok) {
      console.log(`❌ API Error: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.log('   Response:', errorText);
      return;
    }
    
    const insightsData = await response.json();
    const insights = insightsData.data?.insights?.[0];
    
    if (!insights) {
      console.log('❌ No insights returned from API');
      return;
    }
    
    console.log('\n💡 INSIGHTS API DATA:');
    console.log(`   Dominant Emotion: ${insights.emotion_summary?.dominant_emotion}`);
    console.log(`   Mood Score: ${insights.emotion_summary?.mood_score}`);
    console.log(`   Emotion Counts:`, insights.emotion_summary?.emotion_counts || {});
    console.log(`   Top-level emotion: ${insights.emotion}`);
    console.log(`   Emoji: ${insights.emotion_emoji}`);
    
    // Compare
    console.log('\n' + '='.repeat(60));
    console.log('🔍 CONSISTENCY CHECK:\n');
    
    const emotionMatch = insights.emotion_summary?.dominant_emotion?.toLowerCase() === journalEmotion?.toLowerCase();
    const moodScoreMatch = Math.abs((insights.emotion_summary?.mood_score || 0) - (journalMoodScore || 0)) < 1;
    
    if (emotionMatch && moodScoreMatch) {
      console.log('✅ PASS: Insights match journal data!');
      console.log(`   ✓ Emotion: ${insights.emotion_summary?.dominant_emotion} = ${journalEmotion}`);
      console.log(`   ✓ Mood Score: ${insights.emotion_summary?.mood_score} ≈ ${journalMoodScore}`);
    } else {
      console.log('❌ FAIL: Mismatch detected!');
      if (!emotionMatch) {
        console.log(`   ✗ Emotion: ${insights.emotion_summary?.dominant_emotion} ≠ ${journalEmotion}`);
      }
      if (!moodScoreMatch) {
        console.log(`   ✗ Mood Score: ${insights.emotion_summary?.mood_score} ≠ ${journalMoodScore}`);
      }
    }
    
    console.log('\n' + '='.repeat(60));
    
    // Test multiple dates
    console.log('\n📊 Testing multiple dates...\n');
    
    for (let i = 0; i < Math.min(3, journals.length); i++) {
      const testJournal = journals[i];
      const jEmotion = testJournal.emotion_summary?.dominant_emotion || testJournal.emotion_summary?.primaryEmotion;
      const jMood = testJournal.emotion_summary?.mood_score || testJournal.emotion_summary?.moodScore;
      
      const insightsRes = await fetch(
        `http://localhost:8080/api/insights/daily?userId=${testJournal.user_id}&startDate=${testJournal.date}&endDate=${testJournal.date}`
      );
      
      if (insightsRes.ok) {
        const insData = await insightsRes.json();
        const ins = insData.data?.insights?.[0];
        
        const match = ins?.emotion_summary?.dominant_emotion?.toLowerCase() === jEmotion?.toLowerCase();
        const icon = match ? '✅' : '❌';
        
        console.log(`${icon} ${testJournal.date}: Journal=${jEmotion}/${jMood}, Insights=${ins?.emotion_summary?.dominant_emotion}/${ins?.emotion_summary?.mood_score}`);
      }
    }
    
  } catch (error) {
    console.error('\n❌ Test Error:', error.message);
    console.error(error.stack);
  }
}

// Run the test
testInsightsConsistency().then(() => {
  console.log('\n✨ Test completed\n');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
