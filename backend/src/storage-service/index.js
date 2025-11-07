/**
 * Storage Service Module
 * Handles data persistence for emotion analysis results
 * 
 * This module:
 * 1. Stores emotion detection results
 * 2. Stores transcripts and audio metadata
 * 3. Supports Supabase and SQLite
 * 4. Provides retrieval and query functions
 */

import { v4 as uuidv4 } from 'uuid';
import { createClient } from '@supabase/supabase-js';
import config from '../config/index.js';

/**
 * Initialize Supabase client (if configured)
 */
let supabaseClient = null;

export const initializeSupabase = async () => {
  try {
    if (config.database.type !== 'supabase') {
      return null;
    }

    console.log('� Initializing Supabase...');

    const supabaseUrl = config.database.supabase.url;
    const supabaseKey = config.database.supabase.serviceRoleKey || config.database.supabase.anonKey;

    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Missing Supabase credentials. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env');
      return null;
    }

    supabaseClient = createClient(supabaseUrl, supabaseKey);

    // Test the connection - use a simpler test that doesn't depend on specific tables
    try {
      const { data, error } = await supabaseClient.from('emotion_analysis').select('count').limit(1);
      if (error) {
        if (error.code === 'PGRST116' || error.message.includes('table') || error.message.includes('schema cache')) {
          console.log('⚠️ emotion_analysis table not found - this is OK if running for the first time');
          console.log('📝 Please run the database migration script to create all required tables');
        } else {
          console.error('❌ Supabase connection test failed:', error.message);
          return null;
        }
      }
    } catch (testError) {
      console.log('⚠️ Connection test failed but continuing - this may be a first-time setup');
      console.log('📝 If you see persistent errors, please run the database migration script');
    }

    console.log('✅ Supabase initialized successfully');
    return supabaseClient;
  } catch (error) {
    console.error('❌ Error initializing Supabase:', error.message);
    return null;
  }
};

/**
 * Initialize SQLite (if configured)
 * TODO: Implement actual SQLite initialization
 */
let sqliteDb = null;

export const initializeSQLite = async () => {
  try {
    if (config.database.type !== 'sqlite') {
      return null;
    }

    console.log('💾 Initializing SQLite...');

    // TODO: Implement SQLite initialization
    // const sqlite3 = require('sqlite3').verbose();
    // sqliteDb = new sqlite3.Database(config.database.sqlite.dbPath);
    
    // Create tables if they don't exist
    // const createTableQuery = `
    //   CREATE TABLE IF NOT EXISTS emotion_analysis (
    //     id TEXT PRIMARY KEY,
    //     userId TEXT,
    //     type TEXT,
    //     input TEXT,
    //     transcript TEXT,
    //     emotion TEXT,
    //     confidence REAL,
    //     scores TEXT,
    //     timestamp TEXT
    //   )
    // `;
    // sqliteDb.run(createTableQuery);

    console.log('✅ SQLite initialized');
    return sqliteDb;
  } catch (error) {
    console.error('❌ Error initializing SQLite:', error.message);
    return null;
  }
};

/**
 * Save analysis result to Supabase
 */
export const saveToSupabase = async (data) => {
  try {
    if (!supabaseClient) {
      await initializeSupabase();
    }

    if (!supabaseClient) {
      throw new Error('Supabase not initialized');
    }

    const recordId = data.id || uuidv4();
    
    // Prepare data for Supabase (FIXED: JSONB fields should be objects, not strings)
    const record = {
      id: recordId,
      user_id: data.userId,
      type: data.type,
      input_text: data.input ? (typeof data.input === 'string' ? data.input : JSON.stringify(data.input)) : null,
      transcript: data.transcript || null,
      emotion: data.emotion,
      confidence: data.confidence,
      scores: data.scores || null,  // FIXED: Keep as object for JSONB
      timestamp: data.timestamp || new Date().toISOString(),
      created_at: new Date().toISOString()
    };

    // Only add audio_features if the column exists and data is provided
    if (data.audioFeatures) {
      record.audio_features = data.audioFeatures;
    }

    const { error } = await supabaseClient
      .from('emotion_analysis')
      .insert(record);

    if (error) {
      throw new Error(`Supabase insert failed: ${error.message}`);
    }

    console.log(`✅ Saved to Supabase: ${recordId}`);
    return recordId;
  } catch (error) {
    console.error('❌ Error saving to Supabase:', error.message);
    throw error;
  }
};

/**
 * Save analysis result to SQLite
 */
export const saveToSQLite = async (data) => {
  try {
    if (!sqliteDb) {
      await initializeSQLite();
    }

    if (!sqliteDb) {
      throw new Error('SQLite not initialized');
    }

    const recordId = data.id || uuidv4();

    // TODO: Implement actual SQLite save
    // const query = `
    //   INSERT INTO emotion_analysis (id, userId, type, input, transcript, emotion, confidence, scores, timestamp)
    //   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    // `;
    // const params = [
    //   recordId,
    //   data.userId,
    //   data.type,
    //   JSON.stringify(data.input),
    //   data.transcript || null,
    //   data.emotion,
    //   data.confidence,
    //   JSON.stringify(data.scores),
    //   data.timestamp
    // ];
    // sqliteDb.run(query, params);

    console.log(`✅ Saved to SQLite: ${recordId}`);
    return recordId;
  } catch (error) {
    console.error('❌ Error saving to SQLite:', error.message);
    throw error;
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
    if (!supabaseClient) {
      await initializeSupabase();
    }

    if (!supabaseClient) {
      throw new Error('Supabase not initialized');
    }

    const { data, error } = await supabaseClient
      .from('chat_sessions')
      .insert({
        user_id: userId,
        session_title: sessionTitle
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create session: ${error.message}`);
    }

    console.log(`✅ Created chat session: ${data.id}`);
    return data;
  } catch (error) {
    console.error('❌ Error creating chat session:', error.message);
    throw error;
  }
};

/**
 * Save a chat message to a session
 */
export const saveChatMessage = async (userId, sessionId, role, message, emotionData = null) => {
  try {
    if (!supabaseClient) {
      await initializeSupabase();
    }

    if (!supabaseClient) {
      throw new Error('Supabase not initialized');
    }

    const messageData = {
      user_id: userId,
      session_id: sessionId,
      role: role, // 'user' or 'assistant'
      message: message
    };

    // Add emotion data if provided
    if (emotionData) {
      messageData.emotion_detected = emotionData.emotion;
      messageData.confidence_score = emotionData.confidence;
    }

    const { data, error } = await supabaseClient
      .from('chat_messages')
      .insert(messageData)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to save message: ${error.message}`);
    }

    console.log(`✅ Saved chat message: ${data.id}`);
    return data;
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
    if (!supabaseClient) {
      await initializeSupabase();
    }

    if (!supabaseClient) {
      throw new Error('Supabase not initialized');
    }

    const { data, error } = await supabaseClient
      .from('chat_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch sessions: ${error.message}`);
    }

    return data || [];
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
    if (!supabaseClient) {
      await initializeSupabase();
    }

    if (!supabaseClient) {
      throw new Error('Supabase not initialized');
    }

    let query = supabaseClient
      .from('chat_messages')
      .select('*')
      .eq('user_id', userId)
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch messages: ${error.message}`);
    }

    return data || [];
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
    if (!supabaseClient) {
      await initializeSupabase();
    }

    if (!supabaseClient) {
      throw new Error('Supabase not initialized');
    }

    const { data, error } = await supabaseClient
      .from('chat_messages')
      .select('role, message, emotion_detected, confidence_score, created_at')
      .eq('user_id', userId)
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to fetch recent messages: ${error.message}`);
    }

    // Return in chronological order (oldest first) for context
    return (data || []).reverse();
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
    if (!supabaseClient) {
      await initializeSupabase();
    }

    if (!supabaseClient) {
      throw new Error('Supabase not initialized');
    }

    const { data, error } = await supabaseClient
      .from('chat_sessions')
      .update({ session_title: newTitle })
      .eq('user_id', userId)
      .eq('id', sessionId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update session title: ${error.message}`);
    }

    console.log(`✅ Updated session title: ${sessionId}`);
    return data;
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
    if (!supabaseClient) {
      await initializeSupabase();
    }

    if (!supabaseClient) {
      throw new Error('Supabase not initialized');
    }

    // Delete messages first (due to foreign key constraint)
    const { error: messagesError } = await supabaseClient
      .from('chat_messages')
      .delete()
      .eq('user_id', userId)
      .eq('session_id', sessionId);

    if (messagesError) {
      throw new Error(`Failed to delete messages: ${messagesError.message}`);
    }

    // Delete session
    const { error: sessionError } = await supabaseClient
      .from('chat_sessions')
      .delete()
      .eq('user_id', userId)
      .eq('id', sessionId);

    if (sessionError) {
      throw new Error(`Failed to delete session: ${sessionError.message}`);
    }

    console.log(`✅ Deleted chat session: ${sessionId}`);
    return true;
  } catch (error) {
    console.error('❌ Error deleting chat session:', error.message);
    throw error;
  }
};

/**
 * Main function: Save analysis result
 * This is the primary export used by routes
 */
export const saveAnalysisResult = async (data) => {
  console.log(`💾 Saving analysis result...`);

  try {
    let recordId;

    // Save to configured database
    switch (config.database.type) {
      case 'supabase':
        recordId = await saveToSupabase(data);
        break;
      case 'sqlite':
        recordId = await saveToSQLite(data);
        break;
      default:
        console.warn(`⚠️  Unknown database type: ${config.database.type}, skipping save`);
        recordId = null;
    }

    return recordId;
  } catch (error) {
    console.error('❌ Failed to save analysis result:', error.message);
    // Don't throw - storage failure shouldn't break the API response
    return null;
  }
};

/**
 * Retrieve analysis results by user ID
 */
export const getAnalysisResultsByUser = async (userId, limit = 10) => {
  console.log(`🔍 Retrieving analysis results for user: ${userId}`);

  try {
    let results = [];

    if (config.database.type === 'supabase' && supabaseClient) {
      const { data, error } = await supabaseClient
        .from('emotion_analysis')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (error) {
        throw new Error(`Supabase query failed: ${error.message}`);
      }

      // Transform snake_case to camelCase for consistency
      results = data.map(row => ({
        id: row.id,
        userId: row.user_id,
        type: row.type,
        input: row.input_text,
        transcript: row.transcript,
        emotion: row.emotion,
        confidence: row.confidence,
        scores: row.scores ? JSON.parse(row.scores) : null,
        audioFeatures: row.audio_features ? JSON.parse(row.audio_features) : null,
        timestamp: row.timestamp,
        createdAt: row.created_at
      }));
    } else if (config.database.type === 'sqlite' && sqliteDb) {
      // TODO: Implement SQLite query
      // const query = `SELECT * FROM emotion_analysis WHERE userId = ? ORDER BY timestamp DESC LIMIT ?`;
      // results = await new Promise((resolve, reject) => {
      //   sqliteDb.all(query, [userId, limit], (err, rows) => {
      //     if (err) reject(err);
      //     else resolve(rows);
      //   });
      // });
    }

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
    let result = null;

    if (config.database.type === 'supabase' && supabaseClient) {
      const { data, error } = await supabaseClient
        .from('emotion_analysis')
        .select('*')
        .eq('id', recordId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw new Error(`Supabase query failed: ${error.message}`);
      }

      if (data) {
        // Transform snake_case to camelCase for consistency
        result = {
          id: data.id,
          userId: data.user_id,
          type: data.type,
          input: data.input_text,
          transcript: data.transcript,
          emotion: data.emotion,
          confidence: data.confidence,
          scores: data.scores ? JSON.parse(data.scores) : null,
          audioFeatures: data.audio_features ? JSON.parse(data.audio_features) : null,
          timestamp: data.timestamp,
          createdAt: data.created_at
        };
      }
    } else if (config.database.type === 'sqlite' && sqliteDb) {
      // TODO: Implement SQLite query
      // const query = `SELECT * FROM emotion_analysis WHERE id = ?`;
      // result = await new Promise((resolve, reject) => {
      //   sqliteDb.get(query, [recordId], (err, row) => {
      //     if (err) reject(err);
      //     else resolve(row);
      //   });
      // });
    }

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
    const cutoffTimestamp = cutoffDate.toISOString();

    let deletedCount = 0;

    if (config.database.type === 'supabase' && supabaseClient) {
      const { data, error } = await supabaseClient
        .from('emotion_analysis')
        .delete()
        .lt('timestamp', cutoffTimestamp)
        .select('id');

      if (error) {
        throw new Error(`Supabase deletion failed: ${error.message}`);
      }

      deletedCount = data ? data.length : 0;
    } else if (config.database.type === 'sqlite' && sqliteDb) {
      // TODO: Implement SQLite deletion
      // const query = `DELETE FROM emotion_analysis WHERE timestamp < ?`;
      // deletedCount = await new Promise((resolve, reject) => {
      //   sqliteDb.run(query, [cutoffTimestamp], function(err) {
      //     if (err) reject(err);
      //     else resolve(this.changes);
      //   });
      // });
    }

    console.log(`✅ Deleted ${deletedCount} old results`);
    return deletedCount;
  } catch (error) {
    console.error('❌ Error deleting old results:', error.message);
    throw error;
  }
};
