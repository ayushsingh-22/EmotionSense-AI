import safeLog from './utils/logger.js';
/**
 * Main Server Entry Point
 * Initializes Express server and connects all modules
 */

import express from 'express';
import compression from 'compression';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

// Import configuration
import config from './config/index.js';
import { normalizeNodeEnv } from './config/environment.js';
import { resolveTrustProxyHops } from './config/proxy.js';

// Import services

// Import middleware
import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';
import { installLogRedaction } from './utils/logRedaction.js';
import { randomUUID } from 'crypto';
import { bindUserId } from './middleware/auth.js';
import prisma from './lib/prisma.js';
import { createAuthServices } from './auth/index.js';
import { createBackendAuthRouter } from './routes/backendAuthRoutes.js';
import rateLimit from 'express-rate-limit';
import {
  buildCors, securityHeaders, noStore, globalLimiter, authFailureLimiter,
  aiBurstLimiter, aiDailyLimiter
} from './middleware/security.js';

// Import routes
import profileRoutes from './routes/profileRoutes.js';
import textRoutes from './routes/textRoutes.js';
import voiceRoutes from './routes/voiceRoutes.js';
import multiModalRoutes from './routes/multiModalRoutes.js';
import responseRoutes from './routes/responseRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import ttsRoutes from './routes/ttsRoutes.js';
import healthRoutes from './routes/healthRoutes.js';
import emergencyRoutes from './routes/emergencyRoutes.js';
import insightsRoutes from './routes/insightsRoutes.js';
import journalRoutes from './routes/journalRoutes.js';
import activityRoutes from './routes/activityRoutes.js';
import cronRoutes from './routes/cronRoutes.js';
import internalRoutes from './routes/internalRoutes.js';
import { journalService } from './journal-service/index.js';

// Load environment variables
dotenv.config();

// Every console line (including third-party error dumps) is redacted of secrets.
installLogRedaction();

// Get current directory (ES6 module compatibility)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

/**
 * Create required directories if they don't exist
 */
const createRequiredDirectories = () => {
  const directories = [
    join(__dirname, '..', 'temp', 'audio'),
    join(__dirname, '..', 'data'),
    join(__dirname, '..', 'logs')
  ];

  directories.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      safeLog.log(`✅ Created directory: ${dir}`);
    }
  });
};

/**
 * Configure middleware
 */
const configureMiddleware = () => {

  // Skip compression for the SSE streaming route: compression buffers output
  // to build gzip chunks, which defeats real-time token-by-token streaming
  // (the client would receive nothing until the whole response was ready).
  app.use(compression({
    filter: (req, res) => {
      if (req.path === '/api/chat/message/stream') {
        return false;
      }
      return compression.filter(req, res);
    }
  }));

  // Render's Express example trusts one hop; confirm actual ingress before changing it.
  app.set('trust proxy', resolveTrustProxyHops());
  app.disable('x-powered-by');

  app.use(securityHeaders());
  app.use(buildCors());
  app.use(globalLimiter());

  app.use('/api/auth', noStore, rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, standardHeaders: true, legacyHeaders: false }), express.json({ limit: '8kb' }), express.urlencoded({ extended: true, limit: '8kb' }));
  // Authentication bodies are parsed above; other routes retain the global limit.
  const skipForAuth = (parser) => (req, res, next) =>
    (req.path.startsWith('/api/auth/') ? next() : parser(req, res, next));
  app.use(skipForAuth(express.json({ limit: '1mb' })));
  app.use(skipForAuth(express.urlencoded({ extended: true, limit: '1mb' })));
  // Server-generated request id (never trusted from the client): echoed in the
  // X-Request-Id header and in error responses so support can find the log line.
  app.use((req, res, next) => {
    req.id = randomUUID();
    res.setHeader('X-Request-Id', req.id);
    next();
  });
  app.use(requestLogger);

  // TTS output is served as an unguessable-URL capability (<audio src> cannot
  // send Authorization headers). Filenames carry 122 bits of randomness (see
  // utils/voiceHelper.js); directory listing and dotfiles are disabled.
  app.use('/audio', express.static(join(__dirname, '..', 'temp', 'audio'), {
    maxAge: '1h',
    etag: false,
    index: false,
    dotfiles: 'deny',
    redirect: false
  }));
};

/**
 * Configure API routes
 */
const configureRoutes = (authServices) => {
  const backendAuth = createBackendAuthRouter({ prisma, services: authServices });
  // Public: minimal liveness only (see healthRoutes.js).
  app.use('/api/health', healthRoutes);
  // Secret-gated, not user-facing.
  app.use('/api/cron', cronRoutes);
  app.use('/api/internal', internalRoutes);
  app.use('/api/auth', backendAuth.router);

  // Everything below requires a valid bearer token. Failed attempts are
  // rate-limited per IP before verification runs. bindUserId then pins the
  // caller's identity to the token (multipart routes re-run it inside the route,
  // after multer has parsed the form).
  const authed = [authFailureLimiter(), backendAuth.auth, noStore, bindUserId];
  const paidAi = [aiBurstLimiter(), aiDailyLimiter()];

  // Paid LLM / STT / TTS / emotion-model endpoints: authenticated + per-user limits.
  app.use(['/api/profile', '/api/messages/emotion-history'], ...authed);
  app.use('/api', profileRoutes);
  app.use('/api/analyze', ...authed, ...paidAi);
  app.use('/api/response', ...authed, ...paidAi);
  app.use('/api/tts', ...authed, ...paidAi);
  app.use('/api/chat', ...authed);
  app.use(['/api/chat/message', '/api/chat/voice', '/api/chat/transcribe'], ...paidAi);
  app.use('/api/emergency', ...authed);
  app.use('/api/insights', ...authed);
  app.use('/api/activity', ...authed);
  app.use('/api/journal', ...authed);

  app.use('/api/analyze/text', textRoutes);
  app.use('/api/analyze/voice', voiceRoutes);
  app.use('/api/analyze/multimodal', multiModalRoutes);
  app.use('/api/response', responseRoutes);
  app.use('/api/chat', chatRoutes);
  app.use('/api/tts', ttsRoutes);
  app.use('/api/emergency', emergencyRoutes);
  app.use('/api/insights', insightsRoutes);
  app.use('/api/activity', activityRoutes);
  app.use('/api/journal', journalRoutes);

  app.get('/', (req, res) => {
    res.json({
      message: 'Emotion Detection Backend API',
      version: '1.0.0',
      status: 'running'
    });
  });

  app.use('*', (req, res) => {
    res.status(404).json({ success: false, error: 'Endpoint not found' });
  });
};

/**
 * Assemble middleware + routes + error handler (no listening, no side effects
 * beyond router imports). Exported for the automated test-suite.
 */
let built = false;
export const buildApp = (authServices) => {
  if (built) return app;
  configureMiddleware();
  configureRoutes(authServices || createAuthServices({ prisma }));
  app.use(errorHandler);
  built = true;
  return app;
};

/**
 * Start the server
 */
const startServer = async () => {
  try {
    createRequiredDirectories();

    buildApp();

    try {
      safeLog.log('🚀 Journal Service starting...');
      await journalService.initialize();
      safeLog.log('✅ Journal Service Ready');
    } catch (err) {
      safeLog.warn('⚠️ Journal service failed:', err.message);
    }

    app.listen(PORT, () => {
      safeLog.log('='.repeat(50));
      safeLog.log(`🚀 Server Running → http://localhost:${PORT}`);
      safeLog.log(`🌍 NODE ENV → ${normalizeNodeEnv() || 'development'}`);
      safeLog.log(`🔓 CORS Mode → ${process.env.CORS_ORIGIN ? "allow-list" : "default (no cross-origin in production)"}`);
      safeLog.log('='.repeat(50));
    });

  } catch (err) {
    safeLog.error('❌ Boot failed:', err);
    process.exit(1);
  }
};

const isTest = normalizeNodeEnv() === 'test';

if (!isTest) {
process.on('uncaughtException', e => { safeLog.error('💥', e); process.exit(1); });
process.on('unhandledRejection', (r,p) => { safeLog.error('💥', p, r); process.exit(1); });

process.on('SIGINT', async () => {
  safeLog.log('\n🛑 SIGINT — shutting down');
  if (journalService.isInitialized) await journalService.shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  safeLog.log('\n🛑 SIGTERM — shutting down');
  if (journalService.isInitialized) await journalService.shutdown();
  process.exit(0);
});

}

if (!isTest) startServer();
export default app;
