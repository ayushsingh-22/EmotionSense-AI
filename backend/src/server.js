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
  // Enable gzip compression for better performance
  app.use(compression());

  // Enable CORS for frontend communication
  app.use(cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) return callback(null, true);
      
      // Allow any localhost port
      if (origin.match(/^http:\/\/localhost:\d+$/)) {
        return callback(null, true);
      }
      
      // Allow specific origins from environment variable
      if (process.env.CORS_ORIGIN && origin === process.env.CORS_ORIGIN) {
        return callback(null, true);
      }
      
      // For development, allow any origin
      if (process.env.NODE_ENV === 'development') {
        return callback(null, true);
      }
      
      // Default: reject
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  }));

  // Parse JSON bodies with increased limit
  app.use(express.json({ limit: '10mb' }));

  // Parse URL-encoded bodies
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Request logging
  app.use(requestLogger);

  // Serve audio files from temp directory
  app.use('/audio', express.static(join(__dirname, '..', 'temp', 'audio'), {
    maxAge: '1h',
    etag: false
  }));
};

/**
 * Configure API routes
 */
const configureRoutes = () => {
  // Health check endpoint
  app.use('/api/health', healthRoutes);

  // Text analysis routes
  app.use('/api/analyze/text', textRoutes);

  // Voice analysis routes
  app.use('/api/analyze/voice', voiceRoutes);

  // Multi-modal analysis routes
  app.use('/api/analyze/multimodal', multiModalRoutes);

  // Response generation routes
  app.use('/api/response', responseRoutes);

  // Chat routes
  app.use('/api/chat', chatRoutes);

  // TTS routes
  app.use('/api/tts', ttsRoutes);

  // Emergency contact routes
  app.use('/api/emergency', emergencyRoutes);

  // Insights routes (emotion insights and analytics)
  app.use('/api/insights', insightsRoutes);

  // Activity routes (unified activity data access)
  app.use('/api/activity', activityRoutes);

  // Journal routes (daily auto-journaling)
  app.use('/api/journal', journalRoutes);

  // Root endpoint
  app.get('/', (req, res) => {
    res.json({
      message: 'Emotion Detection Backend API',
      version: '1.0.0',
      status: 'running',
      endpoints: {
        health: '/api/health',
        textAnalysis: '/api/analyze/text',
        voiceAnalysis: '/api/analyze/voice',
        multiModalAnalysis: '/api/analyze/multimodal',
        responseGeneration: '/api/response/generate',
        chat: '/api/chat/message',
        tts: '/api/tts',
        activity: '/api/activity',
        activityHistory: '/api/activity/history/:userId',
        activityInsights: '/api/activity/insights/:userId',
        insightsDaily: '/api/insights/daily',
        insightsWeekly: '/api/insights/weekly',
        insightsStats: '/api/insights/stats',
        insightsTimeline: '/api/insights/timeline/:date',
        journalToday: '/api/journal/today',
        journalList: '/api/journal/list',
        journalGenerate: '/api/journal/generate',
        journalRefresh: '/api/journal/refresh'
      }
    });
  });

  // 404 handler
  app.use('*', (req, res) => {
    res.status(404).json({
      success: false,
      error: 'Endpoint not found'
    });
  });
};

/**
 * Start the server
 */
const startServer = async () => {
  try {
    // Create required directories
    createRequiredDirectories();

    // Initialize Nodemailer for emergency alerts
    console.log('📧 Initializing email service (Nodemailer)...');
    const emailInitialized = await initializeNodemailer();
    if (!emailInitialized) {
      console.log('⚠️ Email service not configured - emergency alerts via email will be disabled');
    }

    // Configure middleware
    configureMiddleware();

    // Configure routes
    configureRoutes();

    // Error handling middleware (must be last)
    app.use(errorHandler);

    // Initialize journal service (non-blocking)
    try {
      console.log('🚀 Initializing Journal Service...');
      await journalService.initialize();
      console.log('✅ Journal Service initialized successfully');
    } catch (error) {
      console.warn('⚠️ Journal service initialization failed (non-critical):', error.message);
    }

    // Start listening
    app.listen(PORT, () => {
      console.log('='.repeat(50));
      console.log('🚀 Emotion Detection Backend Server');
      console.log('='.repeat(50));
      console.log(`📡 Server running on port ${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 API Base URL: http://localhost:${PORT}`);
      console.log(`💚 Health Check: http://localhost:${PORT}/api/health`);
      console.log('='.repeat(50));
      console.log('Available Services:');
      console.log(`  ✓ Text Emotion Detection`);
      console.log(`  ✓ Voice Emotion Detection`);
      console.log(`  ✓ Multi-Modal Analysis`);
      console.log(`  ✓ LLM Response Generation (Gemini + LLaMA fallback)`);
      console.log(`  ✓ TTS Service (${process.env.TTS_ENABLED === 'true' ? 'Enabled' : 'Disabled'})`);
      console.log(`  ✓ Daily Auto-Journaling (Scheduled at 23:30)`);
      console.log('='.repeat(50));
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Graceful shutdown handling
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT. Graceful shutdown...');
  
  try {
    // Stop journal service
    if (journalService.isInitialized) {
      await journalService.shutdown();
    }
    
    console.log('✅ Graceful shutdown complete');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM. Graceful shutdown...');
  
  try {
    // Stop journal service
    if (journalService.isInitialized) {
      await journalService.shutdown();
    }
    
    console.log('✅ Graceful shutdown complete');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
});

// Start the server
startServer();

export default app;