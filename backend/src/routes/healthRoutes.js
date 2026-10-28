/**
 * Health Check Routes
 * Endpoints for monitoring server and service health
 */

import { requireCronSecret } from '../middleware/auth.js';
import express from 'express';
import config from '../config/index.js';
import { getEmailConfigStatus } from '../utils/nodemailerHelper.js';

const router = express.Router();

/**
 * GET /api/health
 * Basic health check
 */
router.get('/', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.server.nodeEnv,
    // Lets deploy verification prove the authenticated build is the one live.
    release: 'phase2a-auth-1',
    commit: /^[a-f0-9]{7,40}$/i.test(process.env.RENDER_GIT_COMMIT || '') ? process.env.RENDER_GIT_COMMIT.slice(0, 7) : 'unknown'
  });
});

/**
 * GET /api/health/detailed
 * Detailed health check with service status
 */
router.get('/detailed', requireCronSecret, (req, res) => {
  const services = {
    gemini: !!config.gemini.apiKey,
    llama: config.llama.enabled,
    huggingface: !!config.huggingface.apiKey,
    stt: config.stt.provider,
    tts: config.tts.enabled,
    database: config.database.type
  };

  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.server.nodeEnv,
    services: services,
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB'
    }
  });
});

/**
 * GET /api/health/email
 * Check email service status
 */
router.get('/email', requireCronSecret, (req, res) => {
  const emailStatus = getEmailConfigStatus();

  res.json({
    success: true,
    email: emailStatus,
    timestamp: new Date().toISOString()
  });
});

export default router;
