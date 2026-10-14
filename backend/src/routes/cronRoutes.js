/**
 * Cron Routes
 * Secure endpoints for external cron services (e.g., cron-job.org)
 * Used to keep Neon warm and prevent cold-start latency
 */

import express from 'express';
import prisma from '../lib/prisma.js';
import config from '../config/index.js';
import { requireCronSecret } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/cron/ping
 *
 * Purpose: Wake Neon from cold start by executing a real database query.
 *
 * Security:
 * - Requires Authorization: Bearer <CRON_SECRET> header
 * - Uses the Prisma client (server-side only, never exposed to frontend)
 * - No session/cookie dependency
 *
 * Returns:
 * - 200 { status: "alive", db: "connected", timestamp } on success
 * - 401 if token invalid/missing
 * - 500 if the Neon query fails
 */
router.get('/ping', requireCronSecret, async (req, res) => {
  const startTime = Date.now();

  try {
    // Execute a minimal query to wake Neon. Any successful query - even one
    // returning zero rows - means the database is alive.
    const row = await prisma.emotionAnalysis.findFirst({ select: { id: true } });

    console.log(`✅ Cron ping successful (${Date.now() - startTime}ms)`);

    return res.status(200).json({
      status: 'alive',
      db: 'connected',
      rows_checked: row ? 1 : 0,
      latency_ms: Date.now() - startTime,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error('❌ Cron ping exception:', err.message);
    return res.status(500).json({
      status: 'error',
      error: 'Internal server error',
      requestId: req.id
    });
  }
});

export default router;
