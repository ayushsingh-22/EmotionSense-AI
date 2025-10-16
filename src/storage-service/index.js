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

    // Test the connection
    const { data, error } = await supabaseClient.from('emotion_analysis').select('count').limit(1);
    if (error && error.code !== 'PGRST116') { // PGRST116 is "table doesn't exist" which is OK for first run
      console.error('❌ Supabase connection test failed:', error.message);
      return null;
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
    
    // Prepare data for Supabase
    const record = {
      id: recordId,
      user_id: data.userId,
      type: data.type,
      input_text: data.input ? (typeof data.input === 'string' ? data.input : JSON.stringify(data.input)) : null,
      transcript: data.transcript || null,
      emotion: data.emotion,
      confidence: data.confidence,
      scores: data.scores ? JSON.stringify(data.scores) : null,
      audio_features: data.audioFeatures ? JSON.stringify(data.audioFeatures) : null,
      timestamp: data.timestamp || new Date().toISOString(),
      created_at: new Date().toISOString()
    };

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
