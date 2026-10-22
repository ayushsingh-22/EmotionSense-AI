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

// Import services
import { initializeNodemailer } from './utils/nodemailerHelper.js';

// Import middleware
import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';
import { installLogRedaction } from './utils/logRedaction.js';
import { randomUUID } from 'crypto';
import { requireAuth, bindUserId, assertAuthConfigured } from './middleware/auth.js';
import {
  buildCors, securityHeaders, noStore, globalLimiter, authFailureLimiter,
  aiBurstLimiter, aiDailyLimiter
} from './middleware/security.js';

// Import routes
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
import { createFirebaseExchangeRouter, createIdentityMeRouter } from './routes/identityRoutes.js';
import { createAccountLinkRouter } from './routes/accountLinkRoutes.js';
import { isLinkingEnabled } from './identity/linkService.js';
import { isExchangeEnabled, assertFirebaseConfigured } from './identity/firebaseVerifier.js';
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
      console.log(`✅ Created directory: ${dir}`);
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

  // Render terminates TLS behind exactly one proxy hop; needed for correct
  // client IPs (rate limiting) and req.secure.
  app.set('trust proxy', parseInt(process.env.TRUST_PROXY_HOPS || '1', 10));
  app.disable('x-powered-by');

  app.use(securityHeaders());
  app.use(buildCors());
  app.use(globalLimiter());

  // The Firebase exchange route parses its own, much smaller JSON body (8kb).
  const skipForExchange = (parser) => (req, res, next) =>
    (req.path.startsWith('/api/auth/firebase/') ? next() : parser(req, res, next));
  app.use(skipForExchange(express.json({ limit: '1mb' })));
  app.use(skipForExchange(express.urlencoded({ extended: true, limit: '1mb' })));
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
const configureRoutes = () => {
  // Public: minimal liveness only (see healthRoutes.js).
  app.use('/api/health', healthRoutes);
  // Secret-gated, not user-facing.
  app.use('/api/cron', cronRoutes);
  // Public by design (the caller has no API token yet; the Firebase ID token IS the credential).
  // Registered explicitly BEFORE the authenticated chain below and limited to this one path.
  // Invisible (404) unless FIREBASE_EXCHANGE_ENABLED=true; refuses (503) on a database without
  // the Phase 2B.2 identity schema.
  app.use('/api/auth/firebase/exchange', createFirebaseExchangeRouter());
  // Same model for account linking (Firebase ID token + web password; no API token exists yet). Terminal router limited
  // to /start and /complete. Invisible (404) unless ACCOUNT_LINKING_ENABLED=true AND FIREBASE_EXCHANGE_ENABLED=true;
  // refuses (503) on a database without the identity + link-challenge schema.
  app.use('/api/auth/firebase/link', createAccountLinkRouter());

  // Everything below requires a valid bearer token. Failed attempts are
  // rate-limited per IP before verification runs. bindUserId then pins the
  // caller's identity to the token (multipart routes re-run it inside the route,
  // after multer has parsed the form).
  const authed = [authFailureLimiter(), requireAuth, noStore, bindUserId];
  const paidAi = [aiBurstLimiter(), aiDailyLimiter()];

  // Paid LLM / STT / TTS / emotion-model endpoints: authenticated + per-user limits.
  app.use('/api/analyze', ...authed, ...paidAi);
  app.use('/api/response', ...authed, ...paidAi);
  app.use('/api/tts', ...authed, ...paidAi);
  app.use('/api/chat', ...authed);
  app.use(['/api/chat/message', '/api/chat/voice', '/api/chat/transcribe'], ...paidAi);
  app.use('/api/emergency', ...authed);
  app.use('/api/insights', ...authed);
  app.use('/api/activity', ...authed);
  app.use('/api/journal', ...authed);
  app.use('/api/identity', ...authed);

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
  app.use('/api/identity', createIdentityMeRouter());

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
export const buildApp = () => {
  if (built) return app;
  configureMiddleware();
  configureRoutes();
  app.use(errorHandler);
  built = true;
  return app;
};

/**
 * Start the server
 */
const startServer = async () => {
  try {
    assertAuthConfigured();
    if (isExchangeEnabled()) {
      // Enabled but misconfigured must fail the boot, not every request.
      assertFirebaseConfigured();
      console.log('✅ Firebase identity exchange enabled');
    }
    if (isLinkingEnabled()) {
      console.log(isExchangeEnabled()
        ? '✅ Account linking enabled'
        : '⚠️ ACCOUNT_LINKING_ENABLED is set but FIREBASE_EXCHANGE_ENABLED is not: account linking stays disabled');
    }
    createRequiredDirectories();

    console.log('📧 Initializing email...');
    const ok = await initializeNodemailer();
    if (!ok) console.log('⚠️ Email disabled');

    buildApp();

    try {
      console.log('🚀 Journal Service starting...');
      await journalService.initialize();
      console.log('✅ Journal Service Ready');
    } catch (err) {
      console.warn('⚠️ Journal service failed:', err.message);
    }

    app.listen(PORT, () => {
      console.log('='.repeat(50));
      console.log(`🚀 Server Running → http://localhost:${PORT}`);
      console.log(`🌍 NODE ENV → ${process.env.NODE_ENV}`);
      console.log(`🔓 CORS Mode → ${process.env.CORS_ORIGIN ? "allow-list" : "default (no cross-origin in production)"}`);
      console.log('='.repeat(50));
    });

  } catch (err) {
    console.error('❌ Boot failed:', err);
    process.exit(1);
  }
};

const isTest = process.env.NODE_ENV === 'test';

if (!isTest) {
process.on('uncaughtException', e => { console.error('💥', e); process.exit(1); });
process.on('unhandledRejection', (r,p) => { console.error('💥', p, r); process.exit(1); });

process.on('SIGINT', async () => {
  console.log('\n🛑 SIGINT — shutting down');
  if (journalService.isInitialized) await journalService.shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 SIGTERM — shutting down');
  if (journalService.isInitialized) await journalService.shutdown();
  process.exit(0);
});

}

if (!isTest) startServer();
export default app;
