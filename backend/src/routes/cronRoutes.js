/**
 * Cron Routes
 * Secure endpoints for external cron services (e.g., cron-job.org)
 * Used to keep Supabase warm and prevent cold-start latency
 */

import express from 'express';
import { createClient } from '@supabase/supabase-js';
import config from '../config/index.js';

const router = express.Router();

/**
 * Middleware: Validate CRON_SECRET token
 * Rejects requests without valid Bearer token
 */
const validateCronToken = (req, res, next) => {
  const cronSecret = config.cron?.secret;

  if (!cronSecret) {
    console.error('❌ CRON_SECRET not configured');
    return res.status(500).json({ error: 'Cron endpoint misconfigured' });
  }

  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized - Missing token' });
  }

  const token = authHeader.slice(7); // Remove 'Bearer ' prefix

  if (token !== cronSecret) {
    return res.status(401).json({ error: 'Unauthorized - Invalid token' });
  }

  next();
};

/**
 * GET /api/cron/ping
 * 
 * Purpose: Wake Supabase from cold start by executing a real database query.
 * 
 * Security:
 * - Requires Authorization: Bearer <CRON_SECRET> header
 * - Uses service role key (never exposed to frontend)
 * - No session/cookie dependency
 * 
 * Returns:
 * - 200 { status: "alive", db: "connected", timestamp } on success
 * - 401 if token invalid/missing
 * - 500 if Supabase query fails
 */
router.get('/ping', validateCronToken, async (req, res) => {
  const startTime = Date.now();

  try {
    const supabaseUrl = config.database.supabase.url;
    const serviceRoleKey = config.database.supabase.serviceRoleKey;

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('❌ Supabase credentials missing for cron ping');
      return res.status(500).json({ 
        status: 'error', 
        error: 'Database configuration missing' 
      });
    }

    // Create client with service role key (bypasses RLS)
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Execute minimal query to wake Supabase
    // Using emotion_analysis table which exists per storage-service
    const { data, error } = await supabase
      .from('emotion_analysis')
      .select('id')
      .limit(1);

    if (error) {
      // PGRST116 = table/view not found - still means DB is awake
      if (error.code === 'PGRST116') {
        console.log('⚠️ Cron ping: Table not found but DB responded');
        return res.status(200).json({
          status: 'alive',
          db: 'connected',
          note: 'Table not found but database responded',
          latency_ms: Date.now() - startTime,
          timestamp: new Date().toISOString()
        });
      }

      console.error('❌ Cron ping Supabase error:', error.message);
      return res.status(500).json({ 
        status: 'error', 
        error: 'Database query failed',
        details: error.message 
      });
    }

    console.log(`✅ Cron ping successful (${Date.now() - startTime}ms)`);

    return res.status(200).json({
      status: 'alive',
      db: 'connected',
      rows_checked: data?.length || 0,
      latency_ms: Date.now() - startTime,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error('❌ Cron ping exception:', err.message);
    return res.status(500).json({ 
      status: 'error', 
      error: 'Internal server error',
      details: err.message 
    });
  }
});

export default router;
