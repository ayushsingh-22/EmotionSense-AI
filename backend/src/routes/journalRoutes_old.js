import express from 'express';
import { journalService, cronScheduler } from '../journal-service/index.js';
import masterActivityService from '../storage-service/masterActivityService.js';

const router = express.Router();

/**
 * Journal Routes - API endpoints for journal service
 */

/**
 * Get current date in IST timezone (YYYY-MM-DD format)
 * Ensures consistent date handling across all journal functions
 */
const getCurrentISTDate = () => {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
  const istDate = new Date(now.getTime() + istOffset);
  return istDate.toISOString().split('T')[0];
};

/**
 * GET /api/journal/today
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

    const today = getCurrentISTDate(); // Use IST date consistently
    
    // Check if there's an auto-generated journal for today
    try {
      const generatedJournal = await journalService.getJournalByDate(userId, today);
      if (generatedJournal) {
        return res.json({
          success: true,
          data: {
            date: today,
            content: generatedJournal.content,
            emotions: generatedJournal.emotions,
            created_at: generatedJournal.created_at,
            isGenerated: true
          }
        });
      }
    } catch (journalError) {
      console.log('No generated journal found, checking activities...');
    }
    
    // Fallback: Get chat activities for today and create a summary
    const activitiesResult = await masterActivityService.getActivities({
      user_id: userId,
      startDate: today,
      endDate: today,
      limit: 100
    });
    
    const activities = activitiesResult.data || [];
    
    if (activities.length === 0) {
      return res.json({
        success: true,
        data: null // No journal for today
      });
    }
    
    // Create a simple daily summary from activities
    const emotions = {};
    let totalMessages = 0;
    let totalConfidence = 0;
    let confidenceCount = 0;
    
    activities.forEach(activity => {
      if (activity.activity_type === 'chat_message') totalMessages++;
      if (activity.emotion_data?.emotion) {
        const emotion = activity.emotion_data.emotion;
        emotions[emotion] = (emotions[emotion] || 0) + 1;
        
        // Calculate mood score from confidence
        if (activity.emotion_data.confidence) {
          totalConfidence += activity.emotion_data.confidence;
          confidenceCount++;
        }
      }
    });
    
    const dominantEmotion = Object.entries(emotions)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'neutral';
    
    const moodScore = confidenceCount > 0 ? Math.round((totalConfidence / confidenceCount) * 100) : 50;
    
    const summaryContent = `Today you had ${totalMessages} conversations. Your dominant emotion was ${dominantEmotion}.`;
    
    res.json({
      success: true,
      data: {
        date: today,
        content: summaryContent,
        emotion: dominantEmotion,
        emotion_summary: {
          dominant_emotion: dominantEmotion,
          mood_score: moodScore,
          emotion_counts: emotions
        },
        emotions: emotions, // Keep for backward compatibility
        created_at: new Date().toISOString(),
        isGenerated: false
      }
    });
    
  } catch (error) {
    console.error('❌ Error getting today\'s journal:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/journal/list
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
    
    // First try to get generated journals from journal service
    try {
      const generatedJournals = await journalService.getUserJournals(userId, requestedLimit);
      if (generatedJournals && generatedJournals.length > 0) {
        const formattedJournals = generatedJournals.map(journal => ({
          date: journal.date,
          content: journal.content,
          emotions: journal.emotions,
          created_at: journal.created_at,
          isGenerated: true
        }));
        
        return res.json({
          success: true,
          data: { journals: formattedJournals }
        });
      }
    } catch (journalError) {
      console.log('No generated journals found, creating from activities...');
    }
    
    // Fallback: Create daily summaries from chat activities
    const activitiesResult = await masterActivityService.getActivities({
      user_id: userId,
      limit: 1000 // Get more activities to group by date
    });
    
    const activities = activitiesResult.data || [];
    
    // Group activities by date
    const dailyActivities = {};
    activities.forEach(activity => {
      const date = activity.local_date;
      if (!dailyActivities[date]) {
        dailyActivities[date] = [];
      }
      dailyActivities[date].push(activity);
    });
    
    // Create journal entries from daily activity groups
    const journals = Object.entries(dailyActivities)
      .sort(([dateA], [dateB]) => dateB.localeCompare(dateA)) // Sort by date descending
      .slice(0, requestedLimit) // Limit results
      .map(([date, dayActivities]) => {
        const emotions = {};
        let messageCount = 0;
        let totalConfidence = 0;
        let confidenceCount = 0;
        
        dayActivities.forEach(activity => {
          if (activity.activity_type === 'chat_message') messageCount++;
          if (activity.emotion_data?.emotion) {
            const emotion = activity.emotion_data.emotion;
            emotions[emotion] = (emotions[emotion] || 0) + 1;
            
            // Calculate mood score from confidence
            if (activity.emotion_data.confidence) {
              totalConfidence += activity.emotion_data.confidence;
              confidenceCount++;
            }
          }
        });
        
        const dominantEmotion = Object.entries(emotions)
          .sort(([,a], [,b]) => b - a)[0]?.[0] || 'neutral';
        
        const moodScore = confidenceCount > 0 ? Math.round((totalConfidence / confidenceCount) * 100) : 50;
        
        const content = messageCount > 0 
          ? `You had ${messageCount} conversations on this day. Your main emotion was ${dominantEmotion}.`
          : `Quiet day with minimal activity.`;
        
        return {
          date,
          content,
          emotion: dominantEmotion,
          emotion_summary: {
            dominant_emotion: dominantEmotion,
            mood_score: moodScore,
            emotion_counts: emotions
          },
          emotions, // Keep for backward compatibility
          created_at: dayActivities[0].created_at,
          isGenerated: false
        };
      })
      .filter(journal => Object.keys(journal.emotions).length > 0); // Only include days with emotions
    
    res.json({
      success: true,
      data: { journals }
    });
    
  } catch (error) {
    console.error('❌ Error getting journal list:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/journal/:date
 * Get journal entry for a specific date
 */
router.get('/:date', async (req, res) => {
  try {
    const { date } = req.params;
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required'
      });
    }

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        success: false,
        error: 'Valid date (YYYY-MM-DD) is required'
      });
    }

    // Get activities with journal entries for specific date
    const activitiesResult = await masterActivityService.getActivities({
      user_id: userId,
      startDate: date,
      endDate: date,
      activityTypes: ['journal_entry'],
      limit: 1
    });
    
    const journalActivities = activitiesResult.data || [];
    const dateJournal = journalActivities.length > 0 ? {
      date: date,
      content: journalActivities[0].ejournal_entry,
      created_at: journalActivities[0].created_at
    } : null;
    
    res.json({
      success: true,
      data: dateJournal
    });
    
  } catch (error) {
    console.error('❌ Error getting journal by date:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/journal/service/status
 * Get journal service status
 */
router.get('/service/status', (req, res) => {
  try {
    const status = journalService.getStatus();
    
    res.json({
      success: true,
      data: {
        service_status: status,
        current_time: new Date().toISOString(),
        current_ist_time: new Date(Date.now() + (5.5 * 60 * 60 * 1000)).toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ Error getting service status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/journal/generate/:userId
 * Generate journal for specific user and date (manual generation)
 */
router.post('/generate/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { date } = req.body;
    
    // Use IST date if no date provided
    const targetDate = date || getCurrentISTDate();
    
    console.log(`📖 Manual journal generation requested for user ${userId} on ${targetDate}`);
    
    if (!journalService.isInitialized) {
      return res.status(503).json({
        success: false,
        error: 'Journal service not initialized'
      });
    }
    
    const journal = await journalService.generateJournal(userId, targetDate);
    
    if (!journal) {
      return res.status(500).json({
        success: false,
        error: 'Journal generation failed'
      });
    }
    
    // Provide detailed response about database operations
    const response = {
      success: true,
      data: {
        ...journal,
        date: targetDate
      },
      message: journal.is_update 
        ? `Journal updated successfully for ${targetDate}` 
        : `Journal generated and saved for ${targetDate}`,
      database_operation: journal.is_update ? 'update' : 'create'
    };
    
    console.log(`✅ Journal ${journal.is_update ? 'updated' : 'created'} for user ${userId}`);
    res.json(response);
    
  } catch (error) {
    console.error('❌ Error generating journal:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to generate journal'
    });
  }
});

/**
 * POST /api/journal/generate-all
 * Generate journals for all users for specific date
 */
router.post('/generate-all', async (req, res) => {
  try {
    const { date } = req.body;
    
    console.log(`📚 Batch journal generation requested${date ? ` for ${date}` : ''}`);
    
    if (!journalService.isInitialized) {
      return res.status(503).json({
        success: false,
        error: 'Journal service not initialized'
      });
    }
    
    const result = await journalService.generateAllJournals(date);
    
    res.json({
      success: true,
      data: result
    });
    
  } catch (error) {
    console.error('❌ Error in batch journal generation:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/journal/backfill/:userId
 * Generate journals for a date range (backfilling)
 */
router.post('/backfill/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate } = req.body;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'startDate and endDate are required'
      });
    }
    
    console.log(`📅 Journal backfill requested for user ${userId} from ${startDate} to ${endDate}`);
    
    if (!journalService.isInitialized) {
      return res.status(503).json({
        success: false,
        error: 'Journal service not initialized'
      });
    }
    
    const journals = await journalService.generateJournalsForDateRange(userId, startDate, endDate);
    
    res.json({
      success: true,
      data: {
        generated_count: journals.length,
        journals: journals
      }
    });
    
  } catch (error) {
    console.error('❌ Error in journal backfill:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/journal/:userId/:date
 * Get journal for specific user and date
 */
router.get('/:userId/:date', async (req, res) => {
  try {
    const { userId, date } = req.params;
    
    // Get journal from journals table
    const journal = await getJournalFromDatabase(userId, date);
    
    if (!journal) {
      return res.status(404).json({
        success: false,
        error: 'Journal not found'
      });
    }
    
    res.json({
      success: true,
      data: journal
    });
    
  } catch (error) {
    console.error('❌ Error fetching journal:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/journal/:userId/list
 * Get list of journals for user
 */
router.get('/:userId/list', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 30, offset = 0 } = req.query;
    
    const journals = await getJournalListFromDatabase(userId, parseInt(limit), parseInt(offset));
    
    res.json({
      success: true,
      data: journals
    });
    
  } catch (error) {
    console.error('❌ Error fetching journal list:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/journal/content-preview
 * Generate journal content without saving (preview)
 */
router.post('/content-preview', async (req, res) => {
  try {
    const { userId, date } = req.body;
    
    if (!userId || !date) {
      return res.status(400).json({
        success: false,
        error: 'userId and date are required'
      });
    }
    
    // Get activities for the date
    const activities = await masterActivityService.getActivities({
      user_id: userId,
      startDate: date,
      endDate: date,
      limit: 1000
    });
    
    if (!activities.data || activities.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No activities found for this date'
      });
    }
    
    // Generate content preview
    const journalContent = await journalService.generateJournalContent(activities.data, {
      userId,
      date
    });
    
    res.json({
      success: true,
      data: {
        preview: true,
        ...journalContent,
        activity_count: activities.data.length
      }
    });
    
  } catch (error) {
    console.error('❌ Error generating journal preview:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Helper function to get journal from database
 */
async function getJournalFromDatabase(userId, date) {
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  
  try {
    const { data, error } = await supabase
      .from('journals')
      .select('*')
      .eq('user_id', userId)
      .eq('journal_date', date)
      .single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
      throw new Error(`Database error: ${error.message}`);
    }
    
    return data;
  } catch (error) {
    console.error('Error querying journals table:', error);
    throw error;
  }
}

/**
 * Helper function to get journal list from database
 */
async function getJournalListFromDatabase(userId, limit = 30, offset = 0) {
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  
  try {
    const { data, error } = await supabase
      .from('journals')
      .select('id, journal_date, dominant_emotion, activity_count, created_at')
      .eq('user_id', userId)
      .order('journal_date', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }
    
    return data || [];
  } catch (error) {
    console.error('Error querying journals list:', error);
    throw error;
  }
}

export default router;
