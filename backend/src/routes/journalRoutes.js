import express from 'express';
import { createClient } from '@supabase/supabase-js';
import journalGenerator from '../journal-service/journalGenerator.js';
import cronScheduler from '../journal-service/cronScheduler.js';
import config from '../config/index.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Initialize Supabase client
const supabase = createClient(
  config.database.supabase.url,
  config.database.supabase.serviceRoleKey || config.database.supabase.anonKey
);

/**
 * Get current date in IST timezone (YYYY-MM-DD format)
 */
const getCurrentISTDate = () => {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
  const istDate = new Date(now.getTime() + istOffset);
  return istDate.toISOString().split('T')[0];
};

/**
 * GET /api/journal/today?userId=xxx
 * Get today's journal for a user
 */
router.get('/today', async (req, res) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required'
      });
    }

    const today = getCurrentISTDate();
    
    // Query journal_entries table
    const { data: journal, error } = await supabase
      .from('journal_entries')
      .select('*')
      .eq('user_id', userId)
      .eq('date', today)
      .maybeSingle();
    
    if (error) {
      logger.error(`Error fetching journal: ${error.message}`);
      throw error;
    }
    
    if (journal) {
      // Extract emotion data from emotion_summary or provide defaults
      const emotionSummary = journal.emotion_summary || {};
      const emotion = emotionSummary.dominant_emotion || emotionSummary.primaryEmotion || null;
      const moodScore = emotionSummary.mood_score || emotionSummary.moodScore || null;
      
      // Generate emoji based on emotion (STRICT 7 EMOTIONS)
      const emotionEmojiMap = {
        anger: "🤬", 
        disgust: "🤢", 
        fear: "😨", 
        joy: "😀", 
        neutral: "😐", 
        sadness: "😭", 
        surprise: "😲"
      };
      const emotionEmoji = emotion ? emotionEmojiMap[emotion.toLowerCase()] : null;
      
      return res.json({
        success: true,
        data: {
          date: journal.date,
          content: journal.content,
          overview: journal.overview,
          key_moments: journal.key_moments,
          analysis: journal.analysis,
          closing: journal.closing,
          emotion: emotion,
          emotion_emoji: emotionEmoji,
          emotion_summary: {
            ...emotionSummary,
            mood_score: moodScore,
            dominant_emotion: emotion
          },
          source: journal.source,
          created_at: journal.generated_at,
          updated_at: journal.updated_at
        }
      });
    }
    
    // No journal exists yet
    res.json({
      success: true,
      data: null
    });
    
  } catch (error) {
    logger.error('❌ Error getting today\'s journal:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});



/**
 * GET /api/journal/list?userId=xxx&limit=30
 * Get list of journal entries for a user
 */
router.get('/list', async (req, res) => {
  try {
    const { userId, limit } = req.query;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required'
      });
    }

    const requestedLimit = limit ? parseInt(limit) : 30;
    
    // Query journal_entries table
    const { data: journals, error } = await supabase
      .from('journal_entries')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(requestedLimit);
    
    if (error) {
      logger.error(`Error fetching journals: ${error.message}`);
      throw error;
    }
    
    const formattedJournals = (journals || []).map(journal => {
      // Extract emotion data from emotion_summary or provide defaults
      const emotionSummary = journal.emotion_summary || {};
      let emotion = emotionSummary.dominant_emotion || emotionSummary.primaryEmotion || null;
      let moodScore = emotionSummary.mood_score || emotionSummary.moodScore || null;
      
      // If no emotion data in journal, try to get it from activities for that date
      if (!emotion || !moodScore) {
        // This would require fetching activities, which we should do in a separate function
        // For now, provide sensible defaults
        emotion = emotion || 'neutral';
        moodScore = moodScore || 50;
      }
      
      // Generate emoji based on emotion
      const emotionEmojiMap = {
        anger: "🤬", angry: "🤬", disgust: "🤢", fear: "😨", joy: "😀", 
        happiness: "😀", happy: "😀", neutral: "😐", sadness: "😭", sad: "😭", 
        surprise: "😲", peaceful: "😌", love: "💖", excitement: "🤩",
        frustrated: "😤", frustration: "😤", calm: "😌", pride: "😌"
      };
      const emotionEmoji = emotion ? emotionEmojiMap[emotion.toLowerCase()] || "😐" : null;
      
      return {
        date: journal.date,
        content: journal.content,
        overview: journal.overview,
        key_moments: journal.key_moments,
        analysis: journal.analysis,
        closing: journal.closing,
        emotion: emotion,
        emotion_emoji: emotionEmoji,
        emotion_summary: {
          ...emotionSummary,
          mood_score: moodScore,
          dominant_emotion: emotion
        },
        source: journal.source,
        created_at: journal.generated_at,
        updated_at: journal.updated_at
      };
    });
    
    res.json({
      success: true,
      data: { journals: formattedJournals }
    });
    
  } catch (error) {
    logger.error('❌ Error getting journal list:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/journal/generate
 * Manually generate a journal for a specific date
 * Body: { userId, date?, force? }
 */
router.post('/generate', async (req, res) => {
  try {
    const { userId, date, force } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required'
      });
    }

    const journalDate = date || getCurrentISTDate();
    
    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(journalDate)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date format. Use YYYY-MM-DD'
      });
    }
    
    logger.info(`📔 Manual journal generation requested for ${userId} on ${journalDate}`);
    
    // Use journalGenerator directly with manual=true
    const result = await journalGenerator.generateDailyJournal(userId, journalDate, {
      force: force || false,
      manual: true
    });
    
    if (result.skipped) {
      return res.json({
        success: true,
        skipped: true,
        reason: result.reason,
        message: `Journal generation skipped: ${result.reason}`
      });
    }
    
    res.json({
      success: true,
      data: {
        date: result.journal.date,
        content: result.journal.content,
        overview: result.journal.overview,
        key_moments: result.journal.key_moments,
        analysis: result.journal.analysis,
        closing: result.journal.closing,
        emotion_summary: result.journal.emotion_summary || {},
        source: result.journal.source,
        created_at: result.journal.generated_at,
        updated_at: result.journal.updated_at,
        messageCount: result.messageCount,
        emotion: result.emotion
      }
    });
    
  } catch (error) {
    logger.error('❌ Error generating journal:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/journal/refresh
 * Refresh today's journal by recalculating from today's chat messages
 */
router.post('/refresh', async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required'
      });
    }

    const today = getCurrentISTDate();
    logger.info(`🔄 Refreshing journal for user ${userId} on ${today}`);
    
    // Force regenerate journal for today using the new method
    const result = await journalGenerator.generateDailyJournal(userId, today, { forceRegenerate: true });
    
    if (!result || !result.journal) {
      logger.warn(`⚠️ No chat messages found for user ${userId} on ${today}`);
      return res.status(200).json({
        success: false,
        error: 'No chat messages found for today. Start chatting to generate your journal!',
        messageCount: result?.messageCount || 0
      });
    }

    // Format response
    const emotionSummary = result.journal.emotion_summary || {};
    const emotion = emotionSummary.dominant_emotion || emotionSummary.primaryEmotion || null;
    const moodScore = emotionSummary.mood_score || emotionSummary.moodScore || null;
    
    const emotionEmojiMap = {
      anger: "🤬", 
      disgust: "🤢", 
      fear: "😨", 
      joy: "😀", 
      neutral: "😐", 
      sadness: "😭", 
      surprise: "😲"
    };
    const emotionEmoji = emotion ? emotionEmojiMap[emotion.toLowerCase()] : null;
    
    res.json({
      success: true,
      data: {
        date: result.journal.date,
        content: result.journal.content,
        overview: result.journal.overview,
        key_moments: result.journal.key_moments,
        analysis: result.journal.analysis,
        closing: result.journal.closing,
        emotion: emotion,
        emotion_emoji: emotionEmoji,
        emotion_summary: {
          ...emotionSummary,
          mood_score: moodScore,
          dominant_emotion: emotion
        },
        source: result.journal.source,
        created_at: result.journal.generated_at,
        updated_at: result.journal.updated_at,
        messageCount: result.messageCount
      }
    });
    
  } catch (error) {
    logger.error('❌ Error refreshing journal:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/journal/status
 * Get journal service status
 */
router.get('/status', async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        cron_running: cronScheduler.isRunning || false,
        cron_schedule: cronScheduler.cronSchedule,
        timezone: 'Asia/Kolkata',
        current_ist_date: getCurrentISTDate()
      }
    });
  } catch (error) {
    logger.error('❌ Error getting status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/journal/test-generation
 * Test manual generation for all users (admin/testing only)
 */
router.post('/test-generation', async (req, res) => {
  try {
    const { date } = req.body;
    
    logger.info('🧪 Test generation triggered');
    
    const result = await cronScheduler.triggerManualGeneration(null, date);
    
    res.json({
      success: true,
      data: result
    });
    
  } catch (error) {
    logger.error('❌ Error in test generation:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/journal/:date?userId=xxx
 * Get journal for a specific date
 */
router.get('/:date', async (req, res) => {
  try {
    const { userId } = req.query;
    const { date } = req.params;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required'
      });
    }

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date format. Use YYYY-MM-DD'
      });
    }
    
    // Query journal_entries table
    const { data: journal, error } = await supabase
      .from('journal_entries')
      .select('*')
      .eq('user_id', userId)
      .eq('date', date)
      .maybeSingle();
    
    if (error) {
      logger.error(`Error fetching journal: ${error.message}`);
      throw error;
    }
    
    if (journal) {
      // Extract emotion data from emotion_summary or provide defaults
      const emotionSummary = journal.emotion_summary || {};
      const emotion = emotionSummary.dominant_emotion || emotionSummary.primaryEmotion || null;
      const moodScore = emotionSummary.mood_score || emotionSummary.moodScore || null;
      
      // Generate emoji based on emotion
      const emotionEmojiMap = {
        anger: "🤬", 
        disgust: "🤢", 
        fear: "😨", 
        joy: "😀", 
        neutral: "😐", 
        sadness: "😭", 
        surprise: "😲"
      };
      const emotionEmoji = emotion ? emotionEmojiMap[emotion.toLowerCase()] : null;
      
      return res.json({
        success: true,
        data: {
          date: journal.date,
          content: journal.content,
          overview: journal.overview,
          key_moments: journal.key_moments,
          analysis: journal.analysis,
          closing: journal.closing,
          emotion: emotion,
          emotion_emoji: emotionEmoji,
          emotion_summary: {
            ...emotionSummary,
            mood_score: moodScore,
            dominant_emotion: emotion
          },
          source: journal.source,
          created_at: journal.generated_at,
          updated_at: journal.updated_at
        }
      });
    }
    
    // No journal exists
    res.json({
      success: true,
      data: null
    });
    
  } catch (error) {
    logger.error(`❌ Error getting journal for ${req.params.date}:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
