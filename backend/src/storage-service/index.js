/**
 * Storage Service Module
 * Handles data persistence for emotion analysis results
 *
 * This module uses Prisma against Neon (Postgres) for all persistence.
 * It provides retrieval and query functions used throughout the app.
 */

import { v4 as uuidv4 } from 'uuid';
import prisma from '../lib/prisma.js';
import { saveActivity } from './masterActivityService.js';

/**
 * Kept as a no-op for backward compatibility - some modules (e.g.
 * alertLogger.js previously) imported this. It simply returns the shared
 * Prisma client so any lingering callers keep working.
 */
export const initializeSupabase = async () => prisma;

const normalizeMessageRow = (row) => {
  if (!row) {
    return row;
  }

  return {
    id: row.id,
    user_id: row.userId,
    session_id: row.sessionId,
    role: row.role,
    content: row.content,
    message: row.content,
    emotion: row.emotion,
    emotion_detected: row.emotion,
    emotion_confidence: row.emotionConfidence,
    confidence_score: row.emotionConfidence,
    metadata: row.metadata || {},
    audio_url: row.audioUrl,
    audioUrl: row.audioUrl,
    created_at: row.createdAt
  };
};

const normalizeChatSessionRow = (row) => {
  if (!row) {
    return row;
  }

  return {
    id: row.id,
    user_id: row.userId,
    session_title: row.sessionTitle,
    created_at: row.createdAt,
    updated_at: row.updatedAt
  };
};

const normalizeEmergencyContactRow = (row) => {
  if (!row) {
    return row;
  }

  return {
    id: row.id,
    user_id: row.userId,
    contact_name: row.contactName,
    contact_email: row.contactEmail,
    contact_phone: row.contactPhone,
    created_at: row.createdAt,
    updated_at: row.updatedAt
  };
};

const normalizeSafetyAlertRow = (row) => {
  if (!row) {
    return row;
  }

  return {
    id: row.id,
    user_id: row.userId,
    emergency_contact_id: row.emergencyContactId,
    detected_emotion: row.detectedEmotion,
    message_text: row.messageText,
    alert_sent: row.alertSent,
    alert_sent_at: row.alertSentAt,
    created_at: row.createdAt
  };
};

/**
 * Main function: Save analysis result
 * This is the primary export used by routes
 */
export const saveAnalysisResult = async (data) => {
  console.log(`💾 Saving analysis result...`);

  try {
    const recordId = data.id || uuidv4();

    const created = await prisma.emotionAnalysis.create({
      data: {
        id: recordId,
        userId: data.userId,
        type: data.type,
        inputText: data.input
          ? (typeof data.input === 'string' ? data.input : JSON.stringify(data.input))
          : null,
        transcript: data.transcript || null,
        emotion: data.emotion,
        confidence: data.confidence,
        scores: data.scores || null,
        audioFeatures: data.audioFeatures || null,
        timestamp: data.timestamp ? new Date(data.timestamp) : new Date()
      }
    });

    console.log(`✅ Saved analysis result: ${created.id}`);
    return created.id;
  } catch (error) {
    console.error('❌ Failed to save analysis result:', error.message);
    // Don't throw - storage failure shouldn't break the API response
    return null;
  }
};

/**
 * Chat Session and Message Management Functions
 */

/**
 * Create a new chat session
 */
export const createChatSession = async (userId, sessionTitle = 'New Chat') => {
  try {
    const created = await prisma.chatSession.create({
      data: {
        userId,
        sessionTitle
      }
    });

    console.log(`✅ Created chat session: ${created.id}`);
    return normalizeChatSessionRow(created);
  } catch (error) {
    console.error('❌ Error creating chat session:', error.message);
    throw error;
  }
};

/**
 * Save a chat message to a session
 * Also writes to master_user_activity for unified data architecture
 */
export const saveChatMessage = async (userId, sessionId, role, message, emotionData = null) => {
  try {
    const messageData = {
      userId,
      sessionId,
      role,
      content: message
    };

    if (emotionData && typeof emotionData === 'object') {
      const {
        emotion = null,
        confidence = null,
        audioUrl = null,
        audio_url: legacyAudioUrl = null,
        metadata: existingMetadata = null,
        ...metadataRest
      } = emotionData;

      if (emotion) {
        messageData.emotion = emotion;
      }

      if (confidence !== undefined && confidence !== null) {
        messageData.emotionConfidence = confidence;
      }

      const resolvedAudioUrl = audioUrl || legacyAudioUrl;
      if (resolvedAudioUrl) {
        messageData.audioUrl = resolvedAudioUrl;
      }

      const mergedMetadata = {
        ...(existingMetadata && typeof existingMetadata === 'object' ? existingMetadata : {}),
        ...Object.fromEntries(
          Object.entries(metadataRest).filter(([, value]) => value !== undefined)
        )
      };

      if (Object.keys(mergedMetadata).length > 0) {
        messageData.metadata = mergedMetadata;
      }
    }

    console.log('📋 Attempting to insert message with fields:', Object.keys(messageData));

    const created = await prisma.message.create({ data: messageData });

    const normalized = normalizeMessageRow(created);
    console.log(`✅ Saved chat message: ${normalized.id}`);

    // CRITICAL: Also save to master_user_activity for unified data architecture
    try {
      await saveActivity({
        userId,
        sessionId,
        messageId: created.id,
        content: message,
        role,
        source: 'chat',
        primaryEmotion: emotionData?.emotion || 'neutral',
        emotionConfidence: emotionData?.confidence || 0.5,
        emotionScores: emotionData?.scores || {},
        voiceTranscript: emotionData?.transcript || null,
        meta: {
          audio_url: created.audioUrl,
          metadata: created.metadata
        }
      });

      console.log(`✅ Also saved to master_user_activity`);
    } catch (activityError) {
      console.error('⚠️ Failed to save to master_user_activity (non-critical):', activityError.message);
      // Don't fail the entire operation if master activity save fails
    }

    return normalized;
  } catch (error) {
    console.error('❌ Error saving chat message:', error.message);
    throw error;
  }
};

/**
 * Get chat sessions for a user
 */
export const getUserChatSessions = async (userId) => {
  try {
    const rows = await prisma.chatSession.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' }
    });

    return rows.map(normalizeChatSessionRow);
  } catch (error) {
    console.error('❌ Error fetching chat sessions:', error.message);
    throw error;
  }
};

/**
 * Get messages for a specific chat session
 */
export const getChatMessages = async (userId, sessionId, limit = null) => {
  try {
    const rows = await prisma.message.findMany({
      where: { userId, sessionId },
      orderBy: { createdAt: 'asc' },
      ...(limit ? { take: limit } : {})
    });

    return rows.map(normalizeMessageRow);
  } catch (error) {
    console.error('❌ Error fetching chat messages:', error.message);
    throw error;
  }
};

/**
 * Get recent chat messages for context (for LLM memory)
 */
export const getRecentChatMessages = async (userId, sessionId, limit = 10) => {
  try {
    const rows = await prisma.message.findMany({
      where: { userId, sessionId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        userId: true,
        sessionId: true,
        role: true,
        content: true,
        emotion: true,
        emotionConfidence: true,
        metadata: true,
        audioUrl: true,
        createdAt: true
      }
    });

    // Return in chronological order (oldest first) for context
    return rows.map(normalizeMessageRow).reverse();
  } catch (error) {
    console.error('❌ Error fetching recent chat messages:', error.message);
    throw error;
  }
};

/**
 * Update session title
 */
export const updateChatSessionTitle = async (userId, sessionId, newTitle) => {
  try {
    const result = await prisma.chatSession.updateMany({
      where: { userId, id: sessionId },
      data: { sessionTitle: newTitle }
    });

    if (result.count === 0) {
      throw new Error('Session not found');
    }

    const updated = await prisma.chatSession.findUnique({ where: { id: sessionId } });

    console.log(`✅ Updated session title: ${sessionId}`);
    return normalizeChatSessionRow(updated);
  } catch (error) {
    console.error('❌ Error updating session title:', error.message);
    throw error;
  }
};

/**
 * Delete a chat session and all its messages
 */
export const deleteChatSession = async (userId, sessionId) => {
  try {
    // Delete messages first (due to foreign key constraint)
    await prisma.message.deleteMany({
      where: { userId, sessionId }
    });

    // Delete session
    await prisma.chatSession.deleteMany({
      where: { userId, id: sessionId }
    });

    console.log(`✅ Deleted chat session: ${sessionId}`);
    return true;
  } catch (error) {
    console.error('❌ Error deleting chat session:', error.message);
    throw error;
  }
};

const transformAnalysisRow = (row) => ({
  id: row.id,
  userId: row.userId,
  type: row.type,
  input: row.inputText,
  transcript: row.transcript,
  emotion: row.emotion,
  confidence: row.confidence,
  scores: row.scores ?? {},
  audioFeatures: row.audioFeatures ?? null,
  timestamp: row.timestamp,
  createdAt: row.createdAt
});

/**
 * Retrieve analysis results by user ID
 */
export const getAnalysisResultsByUser = async (userId, limit = 10) => {
  console.log(`🔍 Retrieving analysis results for user: ${userId}`);

  try {
    const rows = await prisma.emotionAnalysis.findMany({
      where: { userId },
      orderBy: { timestamp: 'desc' },
      take: limit
    });

    const results = rows.map(transformAnalysisRow);

    console.log(`✅ Retrieved ${results.length} results`);
    return results;
  } catch (error) {
    console.error('❌ Error retrieving analysis results:', error.message);
    throw error;
  }
};

/**
 * Retrieve analysis result by ID
 */
export const getAnalysisResultById = async (recordId) => {
  console.log(`🔍 Retrieving analysis result: ${recordId}`);

  try {
    const row = await prisma.emotionAnalysis.findUnique({ where: { id: recordId } });

    const result = row ? transformAnalysisRow(row) : null;

    if (result) {
      console.log(`✅ Found result: ${recordId}`);
    } else {
      console.log(`⚠️  Result not found: ${recordId}`);
    }

    return result;
  } catch (error) {
    console.error('❌ Error retrieving analysis result:', error.message);
    throw error;
  }
};

/**
 * Delete old analysis results (cleanup)
 */
export const deleteOldResults = async (daysOld = 30) => {
  console.log(`🗑️  Deleting results older than ${daysOld} days...`);

  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await prisma.emotionAnalysis.deleteMany({
      where: { timestamp: { lt: cutoffDate } }
    });

    console.log(`✅ Deleted ${result.count} old results`);
    return result.count;
  } catch (error) {
    console.error('❌ Error deleting old results:', error.message);
    throw error;
  }
};

/**
 * User Profile Management Functions
 */

/**
 * Get user profile by user ID
 * @param {string} userId - User ID (UUID)
 * @returns {Promise<Object|null>} - User profile object or null
 */
export const getUserProfile = async (userId) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      return null;
    }

    // There's no separate `profiles`/auth table anymore - `User` has
    // everything (including email) natively.
    return {
      id: user.id,
      email: user.email,
      full_name: user.fullName,
      avatar_url: user.avatarUrl,
      created_at: user.createdAt,
      updated_at: user.updatedAt
    };
  } catch (error) {
    console.error('❌ Error fetching user profile:', error.message);
    return null;
  }
};

/**
 * Emergency Contact Management Functions
 */

/**
 * Get emergency contact for a user
 */
export const getEmergencyContact = async (userId) => {
  try {
    const row = await prisma.emergencyContact.findUnique({ where: { userId } });
    return row ? normalizeEmergencyContactRow(row) : null;
  } catch (error) {
    console.error('❌ Error fetching emergency contact:', error.message);
    return null;
  }
};

/**
 * Check if user has an emergency contact
 */
export const hasEmergencyContact = async (userId) => {
  try {
    const count = await prisma.emergencyContact.count({ where: { userId } });
    return count > 0;
  } catch (error) {
    console.error('❌ Error checking emergency contact:', error.message);
    return false;
  }
};

/**
 * Create or update emergency contact
 */
export const createOrUpdateEmergencyContact = async (userId, contactName, contactEmail, contactPhone = null) => {
  try {
    const saved = await prisma.emergencyContact.upsert({
      where: { userId },
      update: {
        contactName,
        contactEmail,
        contactPhone
      },
      create: {
        userId,
        contactName,
        contactEmail,
        contactPhone
      }
    });

    console.log(`✅ Emergency contact saved for user: ${userId}`);
    return normalizeEmergencyContactRow(saved);
  } catch (error) {
    console.error('❌ Error saving emergency contact:', error.message);
    throw error;
  }
};

/**
 * Delete emergency contact
 */
export const deleteEmergencyContact = async (userId) => {
  try {
    await prisma.emergencyContact.deleteMany({ where: { userId } });

    console.log(`✅ Emergency contact deleted for user: ${userId}`);
    return true;
  } catch (error) {
    console.error('❌ Error deleting emergency contact:', error.message);
    throw error;
  }
};

/**
 * Log safety alert event
 */
export const logSafetyAlert = async (userId, detectedEmotion, messageText, emergencyContactId = null, alertSent = false) => {
  try {
    const created = await prisma.safetyAlert.create({
      data: {
        userId,
        emergencyContactId,
        detectedEmotion,
        messageText,
        alertSent,
        alertSentAt: alertSent ? new Date() : null
      }
    });

    console.log(`✅ Safety alert logged for user: ${userId}`);
    return normalizeSafetyAlertRow(created);
  } catch (error) {
    console.error('❌ Error logging safety alert:', error.message);
    return null;
  }
};

const transformDailySummaryRow = (row) => ({
  id: row.id,
  userId: row.userId,
  date: row.date,
  dominantEmotion: row.dominantEmotion,
  emotionDistribution: row.emotionDistribution ?? {},
  moodScore: row.moodScore !== null && row.moodScore !== undefined ? Number(row.moodScore) : null,
  totalEntries: row.totalEntries ?? 0,
  timeSegments: row.timeSegments ?? [],
  trendPoints: row.trendPoints ?? [],
  compassPoints: row.compassPoints ?? [],
  emotionFlow: row.emotionFlow ?? [],
  segmentSummary: row.segmentSummary ?? [],
  keyMoments: row.keyMoments ?? [],
  summaryText: row.summaryText,
  eJournalEntry: row.eJournalEntry,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt
});

const transformWeeklySummaryRow = (row) => ({
  id: row.id,
  userId: row.userId,
  weekStart: row.weekStart,
  weekEnd: row.weekEnd,
  dominantEmotion: row.dominantEmotion,
  weeklyArc: row.weeklyArc ?? [],
  averageMoodScore: row.averageMoodScore !== null && row.averageMoodScore !== undefined ? Number(row.averageMoodScore) : null,
  keyHighlights: row.keyHighlights ?? [],
  weeklyMomentFlow: row.weeklyMomentFlow ?? [],
  weeklyReflection: row.weeklyReflection,
  weeklySummaryText: row.weeklySummaryText,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt
});

export const getEmotionAnalysisByDateRange = async (userId, startISO, endISO) => {
  const rows = await prisma.emotionAnalysis.findMany({
    where: {
      userId,
      timestamp: { gte: new Date(startISO), lte: new Date(endISO) }
    },
    orderBy: { timestamp: 'asc' }
  });

  return rows.map(transformAnalysisRow);
};

export const getUserMessagesByDateRange = async (userId, startISO, endISO) => {
  const rows = await prisma.message.findMany({
    where: {
      userId,
      createdAt: { gte: new Date(startISO), lte: new Date(endISO) }
    },
    orderBy: { createdAt: 'asc' }
  });

  return rows.map(normalizeMessageRow);
};

export const getEarliestUserMessageDate = async (userId) => {
  const row = await prisma.message.findFirst({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    select: { createdAt: true }
  });

  return row?.createdAt || null;
};

export const replaceEmotionFlowSegments = async (userId, dateISO, segments = []) => {
  await prisma.emotionFlowSegment.deleteMany({
    where: { userId, date: dateISO }
  });

  if (!segments.length) {
    return [];
  }

  const payload = segments.map((segment) => ({
    id: segment.id || uuidv4(),
    userId,
    date: dateISO,
    segment: segment.segment?.toLowerCase() || null,
    dominantEmotion: segment.dominantEmotion || segment.emotion || null,
    intensity: segment.intensity ?? null,
    summary: segment.summary || null
  }));

  await prisma.emotionFlowSegment.createMany({ data: payload });

  return payload.map((row) => ({
    id: row.id,
    user_id: row.userId,
    date: row.date,
    segment: row.segment,
    dominant_emotion: row.dominantEmotion,
    intensity: row.intensity,
    summary: row.summary
  }));
};

export const getDailyEmotionSummary = async (userId, dateISO) => {
  const row = await prisma.dailyEmotionSummary.findUnique({
    where: { userId_date: { userId, date: dateISO } }
  });

  return row ? transformDailySummaryRow(row) : null;
};

export const upsertDailyEmotionSummary = async (payload) => {
  const data = {
    dominantEmotion: payload.dominantEmotion,
    emotionDistribution: payload.emotionDistribution || {},
    moodScore: payload.moodScore,
    totalEntries: payload.totalEntries ?? 0,
    timeSegments: payload.timeSegments || [],
    trendPoints: payload.trendPoints || [],
    compassPoints: payload.compassPoints || [],
    emotionFlow: payload.emotionFlow || [],
    segmentSummary: payload.segmentSummary || [],
    keyMoments: payload.keyMoments || [],
    summaryText: payload.summaryText || null,
    eJournalEntry: payload.eJournalEntry || null
  };

  const saved = await prisma.dailyEmotionSummary.upsert({
    where: { userId_date: { userId: payload.userId, date: payload.date } },
    create: {
      id: payload.id || uuidv4(),
      userId: payload.userId,
      date: payload.date,
      ...data
    },
    update: data
  });

  return transformDailySummaryRow(saved);
};

export const listDailyEmotionSummaries = async (userId, limit = 3650) => {
  const rows = await prisma.dailyEmotionSummary.findMany({
    where: { userId },
    orderBy: { date: 'desc' },
    ...(limit < 10000 ? { take: limit } : {})
  });

  return rows.map(transformDailySummaryRow);
};

export const getWeeklyEmotionSummary = async (userId, weekStartISO, weekEndISO) => {
  const row = await prisma.weeklyEmotionSummary.findUnique({
    where: { userId_weekStart_weekEnd: { userId, weekStart: weekStartISO, weekEnd: weekEndISO } }
  });

  return row ? transformWeeklySummaryRow(row) : null;
};

export const upsertWeeklyEmotionSummary = async (payload) => {
  const data = {
    dominantEmotion: payload.dominantEmotion,
    weeklyArc: payload.weeklyArc || [],
    averageMoodScore: payload.averageMoodScore,
    keyHighlights: payload.keyHighlights || [],
    weeklyMomentFlow: payload.weeklyMomentFlow || [],
    weeklyReflection: payload.weeklyReflection || null,
    weeklySummaryText: payload.weeklySummaryText || null
  };

  const saved = await prisma.weeklyEmotionSummary.upsert({
    where: {
      userId_weekStart_weekEnd: {
        userId: payload.userId,
        weekStart: payload.weekStart,
        weekEnd: payload.weekEnd
      }
    },
    create: {
      id: payload.id || uuidv4(),
      userId: payload.userId,
      weekStart: payload.weekStart,
      weekEnd: payload.weekEnd,
      ...data
    },
    update: data
  });

  return transformWeeklySummaryRow(saved);
};

export const listWeeklyEmotionSummaries = async (userId, limit = 500) => {
  const rows = await prisma.weeklyEmotionSummary.findMany({
    where: { userId },
    orderBy: { weekStart: 'desc' },
    ...(limit < 10000 ? { take: limit } : {})
  });

  return rows.map(transformWeeklySummaryRow);
};

export const getRecentKeyMoments = async (userId, lookbackDays = 30) => {
  const summaries = await listDailyEmotionSummaries(userId, lookbackDays + 5);

  const moments = summaries.flatMap((summary) =>
    (summary.emotionFlow || []).map((flow, index) => ({
      id: flow.id || `${summary.date}-${flow.segment || index}`,
      emotion: flow.emotion,
      intensity: flow.intensity,
      timestamp: summary.date,
      excerpt: flow.summary,
      timeOfDay: flow.segment,
      date: summary.date,
      summaryId: summary.id
    }))
  );

  return moments.sort((a, b) => {
    const intensityA = typeof a.intensity === 'number' ? a.intensity : 0;
    const intensityB = typeof b.intensity === 'number' ? b.intensity : 0;
    return intensityB - intensityA;
  });
};
