import express from 'express';
import rateLimit from 'express-rate-limit';
import { requireCronSecret } from '../middleware/auth.js';
import cronScheduler from '../journal-service/cronScheduler.js';
import logger from '../utils/logger.js';
import { checkEmailProvider, logEmailProviderCheck } from '../auth/emailHealth.js';

/**
 * Internal, CRON_SECRET-protected endpoints (constant-time comparison in requireCronSecret).
 * `email` is the auth email adapter; without one, email-health reports EMAIL_NOT_CONFIGURED.
 */
export function createInternalRouter(scheduler = cronScheduler, { email, emailCheckTimeoutMs } = {}) {
  const router = express.Router();
  router.post('/journal/run', rateLimit({ windowMs: 60_000, limit: 5, standardHeaders: true, legacyHeaders: false }), requireCronSecret, (_req, res) => {
    setImmediate(() => { scheduler.runNightly().catch(error => logger.error(error)); });
    return res.status(202).json({ accepted: true });
  });
  router.get('/client-ip', rateLimit({ windowMs: 60_000, limit: 5, standardHeaders: true, legacyHeaders: false }), requireCronSecret, (req, res) => {
    const entries = (req.get('x-forwarded-for') || '').split(',').map(value => value.trim()).filter(Boolean).length;
    return res.json({ ip: req.ip, forwardedForEntries: entries, trustProxyHops: req.app.get('trust proxy') });
  });
  // OAuth/config check ONLY (no email is sent). The limiter runs before the secret check,
  // so failed secret guesses are limited too. Daily cron use needs one call per day.
  router.get('/email-health',
    rateLimit({ windowMs: 15 * 60_000, limit: 10, standardHeaders: true, legacyHeaders: false, handler: (_req, res) => { res.set('Cache-Control', 'no-store'); res.status(429).json({ ok: false, code: 'RATE_LIMITED' }); } }),
    (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); },
    requireCronSecret,
    async (_req, res) => {
      const result = await checkEmailProvider(email, emailCheckTimeoutMs ? { timeoutMs: emailCheckTimeoutMs } : undefined);
      logEmailProviderCheck(result, { provider: email?.provider, trigger: 'endpoint' });
      return res.status(result.ok ? 200 : 503).json(result.ok ? { ok: true } : { ok: false, code: result.code });
    });
  return router;
}
export default createInternalRouter();
