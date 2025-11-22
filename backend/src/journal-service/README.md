/**
 * Journal Service README
 * 
 * This service provides daily auto-journaling functionality based on emotional events.
 * 
 * FEATURES:
 * - Automatic nightly journal generation at 23:30 IST
 * - Manual journal generation via API
 * - Emotion pattern analysis (time segments, trends, mood scores)
 * - AI-powered reflection using existing LLM service
 * - Integration with existing emotion detection and chat systems
 * 
 * USAGE:
 * 
 * 1. Automatic Generation (via cron):
 *    - Runs every night at 23:30
 *    - Generates journals for all active users from previous day
 *    - Skips if journal already exists
 * 
 * 2. Manual Generation (via API):
 *    POST /api/journal/generate
 *    Body: { userId: "xxx", date: "2025-11-16" (optional) }
 * 
 * 3. Retrieve Journals:
 *    GET /api/journal/today?userId=xxx
 *    GET /api/journal/list?userId=xxx&limit=30
 *    GET /api/journal/2025-11-16?userId=xxx
 * 
 * DEPENDENCIES:
 * - llm-service (for journal text generation)
 * - storage-service (Supabase access)
 * - Daily_journals table (already exists)
 * - Emotions table (for emotion data)
 * - Messages table (for conversation context)
 * 
 * CONFIGURATION:
 * - No new environment variables required
 * - Uses existing LLM configuration (Gemini/LLaMA)
 * - Scheduler timezone: Asia/Kolkata (configurable in journalScheduler.js)
 * 
 * ERROR HANDLING:
 * - Graceful failures (doesn't crash server)
 * - Logs all errors to console
 * - Returns null if insufficient data
 * - Continues batch generation even if individual journals fail
 */
