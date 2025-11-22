/**
 * Unified Chat Service
 * Uses master_user_activity as single source of truth for chat data
 * Replaces old storage service functions with unified data architecture
 */

import * as masterActivity from './masterActivityService.js';
import { createClient } from '@supabase/supabase-js';
import config from '../config/index.js';
import logger from '../utils/logger.js';

const supabase = createClient(
  config.database.supabase.url,
  config.database.supabase.serviceRoleKey || config.database.supabase.anonKey
);

/**
 * Get chat sessions for a user from master_user_activity
 * Returns sessions with last message and metadata
 */
export async function getUserChatSessionsUnified(userId) {
  try {
    // Get all activities for user without date restrictions
    const { data: activities, error } = await supabase
      .from('master_user_activity')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    if (!activities || activities.length === 0) {
      return { sessions: [], total: 0 };
    }

    // Group by session_id
    const sessionMap = {};
    activities.forEach(activity => {
      if (!activity.session_id) return;
      
      if (!sessionMap[activity.session_id]) {
        sessionMap[activity.session_id] = {
          id: activity.session_id,
          user_id: activity.user_id,
          messages: [],
          created_at: activity.created_at,
          updated_at: activity.created_at
        };
      }
      
      sessionMap[activity.session_id].messages.push(activity);
      
      // Update timestamps
      if (activity.created_at > sessionMap[activity.session_id].updated_at) {
        sessionMap[activity.session_id].updated_at = activity.created_at;
      }
      if (activity.created_at < sessionMap[activity.session_id].created_at) {
        sessionMap[activity.session_id].created_at = activity.created_at;
      }
    });

    // Convert to sessions array with metadata
    const sessions = Object.values(sessionMap).map(session => {
      // Sort messages by timestamp
      session.messages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      
      // Get last user message for session title
      const userMessages = session.messages.filter(msg => msg.role === 'user');
      const lastUserMessage = userMessages[userMessages.length - 1];
      
      return {
        id: session.id,
        user_id: session.user_id,
        session_title: lastUserMessage ? 
          (lastUserMessage.content.length > 50 ? 
            lastUserMessage.content.substring(0, 50) + '...' : 
            lastUserMessage.content) : 
          'Chat Session',
        created_at: session.created_at,
        updated_at: session.updated_at,
        metadata: {
          messageCount: session.messages.length,
          lastMessage: session.messages[session.messages.length - 1]?.content,
          dominantEmotion: calculateSessionEmotion(session.messages),
          avgMoodScore: calculateSessionMoodScore(session.messages)
        }
      };
    });

    // Sort by updated_at desc
    sessions.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

    return { 
      sessions, 
      total: sessions.length 
    };

  } catch (error) {
    logger.error('Error fetching unified chat sessions:', error);
    throw error;
  }
}

/**
 * Get messages for a specific session from master_user_activity
 */
export async function getChatMessagesUnified(sessionId, userId) {
  try {
    // Get all activities for this session
    const { data: activities, error } = await supabase
      .from('master_user_activity')
      .select('*')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    if (!activities || activities.length === 0) {
      return { messages: [], total: 0 };
    }

    // Convert activities to message format expected by frontend
    const messages = activities.map(activity => ({
      id: activity.message_id,
      session_id: activity.session_id,
      user_id: activity.user_id,
      role: activity.role,
      content: activity.content,
      emotion: activity.primary_emotion,
      emotion_confidence: activity.emotion_confidence,
      metadata: {
        mood_score: activity.mood_score,
        emotion_emoji: activity.primary_emotion_emoji,
        emotion_scores: activity.emotion_scores,
        local_date: activity.local_date,
        belongs_to_journal: activity.belongs_to_journal,
        journal_id: activity.journal_id,
        voice_transcript: activity.voice_transcript,
        ...activity.meta
      },
      audio_url: activity.meta?.audio_url || null,
      created_at: activity.created_at
    }));

    return {
      messages,
      total: messages.length,
      sessionMetadata: {
        dominantEmotion: calculateSessionEmotion(activities),
        avgMoodScore: calculateSessionMoodScore(activities),
        emotionCounts: calculateEmotionCounts(activities)
      }
    };

  } catch (error) {
    logger.error('Error fetching unified chat messages:', error);
    throw error;
  }
}

/**
 * Calculate dominant emotion for a session
 */
function calculateSessionEmotion(messages) {
  if (!messages || messages.length === 0) return 'neutral';
  
  const emotionCounts = {};
  messages.forEach(msg => {
    if (msg.role === 'user' && msg.primary_emotion) {
      emotionCounts[msg.primary_emotion] = (emotionCounts[msg.primary_emotion] || 0) + 1;
    }
  });
  
  return Object.keys(emotionCounts).reduce((a, b) => 
    emotionCounts[a] > emotionCounts[b] ? a : b, 'neutral');
}

/**
 * Calculate average mood score for a session
 */
function calculateSessionMoodScore(messages) {
  if (!messages || messages.length === 0) return 50;
  
  const userMessages = messages.filter(msg => msg.role === 'user');
  if (userMessages.length === 0) return 50;
  
  const totalScore = userMessages.reduce((sum, msg) => sum + (msg.mood_score || 50), 0);
  return Math.round(totalScore / userMessages.length);
}

/**
 * Calculate emotion counts for a session
 */
function calculateEmotionCounts(messages) {
  const counts = {};
  messages.forEach(msg => {
    if (msg.role === 'user' && msg.primary_emotion) {
      counts[msg.primary_emotion] = (counts[msg.primary_emotion] || 0) + 1;
    }
  });
  return counts;
}