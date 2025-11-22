import express from 'express';
const router = express.Router();
import masterActivityService from '../storage-service/masterActivityService.js';

/**
 * POST /api/activity
 * Insert a new activity into the master table
 */
router.post('/', async (req, res) => {
  try {
    const {
      user_id,
      activity_type,
      content,
      emotion_data,
      metadata,
      session_id
    } = req.body;

    // Validate user_id matches authenticated user (unless service role)
    if (req.user?.role !== 'service_role' && req.user?.id !== user_id) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized: Can only create activities for your own user'
      });
    }

    const activity = await masterActivityService.insertActivity({
      user_id,
      activity_type,
      content,
      emotion_data,
      metadata,
      session_id
    });

    res.status(201).json({
      success: true,
      data: activity,
      message: 'Activity created successfully'
    });

  } catch (error) {
    console.error('POST /api/activity error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/activity/history/:userId
 * Get activities for a user with filtering
 */
router.get('/history/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const {
      startDate,
      endDate,
      activity_type,
      limit = 100,
      offset = 0
    } = req.query;

    // Validate user access
    if (req.user?.role !== 'service_role' && req.user?.id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized: Can only access your own activities'
      });
    }

    // Parse activity_type if it's a comma-separated string
    let activityTypeFilter = activity_type;
    if (typeof activity_type === 'string' && activity_type.includes(',')) {
      activityTypeFilter = activity_type.split(',').map(type => type.trim());
    }

    const result = await masterActivityService.getActivities({
      user_id: userId,
      startDate,
      endDate,
      activity_type: activityTypeFilter,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      data: result.data,
      count: result.count,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: result.data.length === parseInt(limit)
      }
    });

  } catch (error) {
    console.error('GET /api/activity/history/:userId error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/activity/session/:sessionId
 * Get all activities for a specific session
 */
router.get('/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { limit = 100 } = req.query;

    const activities = await masterActivityService.getSessionActivities(
      sessionId,
      parseInt(limit)
    );

    res.json({
      success: true,
      data: activities,
      count: activities.length
    });

  } catch (error) {
    console.error('GET /api/activity/session/:sessionId error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/activity/session/:sessionId/messages
 * Get chat messages for a session (formatted for chat UI)
 */
router.get('/session/:sessionId/messages', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { limit = 100 } = req.query;

    const messages = await masterActivityService.getSessionChatMessages(
      sessionId,
      parseInt(limit)
    );

    res.json({
      success: true,
      data: messages,
      count: messages.length
    });

  } catch (error) {
    console.error('GET /api/activity/session/:sessionId/messages error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/activity/latest/:userId
 * Get latest activities for a user (dashboard view)
 */
router.get('/latest/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 20 } = req.query;

    // Validate user access
    if (req.user?.role !== 'service_role' && req.user?.id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized: Can only access your own activities'
      });
    }

    const activities = await masterActivityService.getLatestActivitiesForUser(
      userId,
      parseInt(limit)
    );

    res.json({
      success: true,
      data: activities,
      count: activities.length
    });

  } catch (error) {
    console.error('GET /api/activity/latest/:userId error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/activity/insights/:userId
 * Get emotion insights for a user
 */
router.get('/insights/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate } = req.query;

    // Validate user access
    if (req.user?.role !== 'service_role' && req.user?.id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized: Can only access your own insights'
      });
    }

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'startDate and endDate are required'
      });
    }

    const insights = await masterActivityService.getEmotionInsights(
      userId,
      startDate,
      endDate
    );

    res.json({
      success: true,
      data: insights
    });

  } catch (error) {
    console.error('GET /api/activity/insights/:userId error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/activity/stats/:userId
 * Get activity statistics for a user
 */
router.get('/stats/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { period = 'week' } = req.query;

    // Validate user access
    if (req.user?.role !== 'service_role' && req.user?.id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized: Can only access your own stats'
      });
    }

    const stats = await masterActivityService.getActivityStats(userId, period);

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('GET /api/activity/stats/:userId error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/activity/:activityId
 * Update an existing activity
 */
router.put('/:activityId', async (req, res) => {
  try {
    const { activityId } = req.params;
    const updates = req.body;

    // Remove fields that shouldn't be updated directly
    delete updates.id;
    delete updates.created_at;
    delete updates.user_id; // Don't allow changing ownership

    const activity = await masterActivityService.updateActivity(activityId, updates);

    res.json({
      success: true,
      data: activity,
      message: 'Activity updated successfully'
    });

  } catch (error) {
    console.error('PUT /api/activity/:activityId error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/activity/:activityId
 * Delete an activity
 */
router.delete('/:activityId', async (req, res) => {
  try {
    const { activityId } = req.params;

    await masterActivityService.deleteActivity(activityId);

    res.json({
      success: true,
      message: 'Activity deleted successfully'
    });

  } catch (error) {
    console.error('DELETE /api/activity/:activityId error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/activity/types
 * Get available activity types
 */
router.get('/types', async (req, res) => {
  try {
    const activityTypes = [
      { value: 'chat_message', label: 'Chat Message', description: 'User message in chat' },
      { value: 'ai_response', label: 'AI Response', description: 'AI assistant response' },
      { value: 'emotion_analysis', label: 'Emotion Analysis', description: 'Text emotion analysis result' },
      { value: 'voice_analysis', label: 'Voice Analysis', description: 'Voice emotion analysis result' },
      { value: 'multimodal_fusion', label: 'Multimodal Fusion', description: 'Combined text + voice analysis' },
      { value: 'journal_emotion', label: 'Journal Emotion', description: 'Daily journal emotion summary' }
    ];

    res.json({
      success: true,
      data: activityTypes
    });

  } catch (error) {
    console.error('GET /api/activity/types error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;