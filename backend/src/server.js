/**
 * Main Server Entry Point
 * Initializes Express server and connects all modules
 */

import express from 'express';
import cors from 'cors';
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
import { journalService } from './journal-service/index.js';

// Load environment variables
dotenv.config();

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

  /* ===================== SIMPLE CORS ===================== */
  // CORS_ORIGIN is a comma-separated allow-list, e.g.:
  //   http://localhost:3000,https://your-app.vercel.app
  // Entries may include a single `*` wildcard segment (matched as a regex),
  // e.g. `https://*.vercel.app` to cover Vercel's per-branch preview
  // deployments without listing each one — those get a new subdomain per
  // deploy that can't be known in advance.
  const rawOrigins = process.env.CORS_ORIGIN || "";

  let allowedOrigins = [];
  if (!rawOrigins.trim() || rawOrigins.trim() === "*") {
    allowedOrigins = "*"; // allow all
    console.log("🌍 CORS: All origins allowed (*)");
  } else {
    allowedOrigins = rawOrigins.split(",").map(o => o.trim()).filter(Boolean);
    console.log("🌍 CORS Allowed Origins:", allowedOrigins);
  }

  const originMatchers = allowedOrigins === "*" ? "*" : allowedOrigins.map((pattern) => {
    if (!pattern.includes("*")) {
      return { exact: pattern };
    }
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
    return { regex: new RegExp(`^${escaped}$`) };
  });

  app.use(cors({
    origin: originMatchers === "*" ? true : (origin, cb) => {
      if (!origin) return cb(null, true);
      const allowed = originMatchers.some((m) => (m.exact ? m.exact === origin : m.regex.test(origin)));
      if (allowed) return cb(null, true);
      return cb(new Error(`❌ CORS BLOCKED → ${origin}`));
    },
    credentials: true,
    methods: ["GET","POST","PUT","DELETE","OPTIONS"],
    allowedHeaders: ["Content-Type","Authorization","X-Requested-With"]
  }));
  /* ======================================================== */

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(requestLogger);

  app.use('/audio', express.static(join(__dirname, '..', 'temp', 'audio'), {
    maxAge: '1h',
    etag: false
  }));
};

/**
 * Configure API routes
 */
const configureRoutes = () => {
  app.use('/api/health', healthRoutes);
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
  app.use('/api/cron', cronRoutes);

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
 * Start the server
 */
const startServer = async () => {
  try {
    createRequiredDirectories();

    console.log('📧 Initializing email...');
    const ok = await initializeNodemailer();
    if (!ok) console.log('⚠️ Email disabled');

    configureMiddleware();
    configureRoutes();

    app.use(errorHandler);

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
      console.log(`🔓 CORS Mode → ${process.env.CORS_ORIGIN || "* (default)"}`);
      console.log('='.repeat(50));
    });

  } catch (err) {
    console.error('❌ Boot failed:', err);
    process.exit(1);
  }
};

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

startServer();
export default app;
