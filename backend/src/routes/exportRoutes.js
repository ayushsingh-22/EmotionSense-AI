// Phase 2C-6: POST /api/me/export — re-authenticated download of the caller's own data.
import express from 'express';
import rateLimit from 'express-rate-limit';
import safeLog from '../utils/logger.js';
import { buildUserExport, exportFilename, ExportTooLargeError, EXPORT_MAX_BYTES } from '../wellbeing/dataExport.js';

export const EXPORT_DAILY_LIMIT = 3;
export const EXPORT_FAILURE_LIMIT = 5;
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const ROUTE = '/api/me/export';

// Identical to change-password's failure response so a wrong password and an
// invalid session are indistinguishable.
const invalidCredentials = res => res.status(401).json({ success: false, error: 'Invalid credentials or session', code: 'UNAUTHENTICATED' });
const fail = (res, status, code, message) => res.status(status).json({ error: { code, message } });
const audit = (log, req, event, code) => log.info({ event, route: ROUTE, requestId: req.id, ...(code ? { code } : {}) });

/**
 * `passwords` is the auth password service (verify only). Limits are per user
 * id, in memory (one Render instance; see PHASE_2C_PLAN.md §2):
 *   - `dailyLimit` successful exports per rolling 24 h;
 *   - `failureLimit` failed attempts (wrong password, too large, outage) per hour.
 */
export function createExportRouter({ db, passwords, maxBytes = EXPORT_MAX_BYTES, dailyLimit = EXPORT_DAILY_LIMIT, failureLimit = EXPORT_FAILURE_LIMIT, log = safeLog, clock = () => new Date() }) {
  if (!db || !passwords) throw new Error('createExportRouter requires db and passwords');
  const router = express.Router();
  const limited = (req, res, _next, options) => {
    const reset = req.rateLimit?.resetTime instanceof Date ? Math.max(1, Math.ceil((req.rateLimit.resetTime.getTime() - Date.now()) / 1000)) : Math.ceil(options.windowMs / 1000);
    res.set('Retry-After', String(reset));
    audit(log, req, 'data export rate limited', 'RATE_LIMITED');
    return fail(res, 429, 'RATE_LIMITED', 'Too many export requests. Please try again later.');
  };
  const common = { standardHeaders: true, legacyHeaders: false, keyGenerator: req => req.userId, handler: limited };
  // Counts only successful downloads (status < 400).
  const daily = rateLimit({ ...common, windowMs: DAY_MS, limit: dailyLimit, skipFailedRequests: true });
  // Counts only failures, bounding password guessing and expensive retries.
  const failures = rateLimit({ ...common, windowMs: HOUR_MS, limit: failureLimit, skipSuccessfulRequests: true });

  router.post('/', (req, res, next) => (req.userId ? next() : invalidCredentials(res)), daily, failures, async (req, res) => {
    const body = req.body;
    // Only { password } is accepted: no user id, filter or format can be supplied.
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(k => k !== 'password') || Object.keys(req.query || {}).length) {
      audit(log, req, 'data export denied', 'VALIDATION_FAILED');
      return fail(res, 400, 'INVALID_REQUEST', 'Invalid request');
    }
    try {
      // A missing verifier fails closed (throws -> 503), never skips re-authentication.
      if (typeof passwords.verify !== 'function') throw new Error('Password verifier unavailable');
      const user = await db.user.findUnique({ where: { id: req.userId }, select: { passwordHash: true } });
      if (!(await passwords.verify(body.password, user?.passwordHash)).valid) {
        audit(log, req, 'data export denied', 'UNAUTHENTICATED');
        return invalidCredentials(res);
      }
      const now = clock();
      const result = await buildUserExport(db, req.userId, { maxBytes, now });
      if (!result) { audit(log, req, 'data export denied', 'UNAUTHENTICATED'); return invalidCredentials(res); }
      res.set({
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${exportFilename(now)}"`,
        'Cache-Control': 'no-store',
        'Pragma': 'no-cache',
        'X-Content-Type-Options': 'nosniff'
      });
      audit(log, req, 'data export completed');
      return res.status(200).send(result.text);
    } catch (error) {
      if (error instanceof ExportTooLargeError) {
        audit(log, req, 'data export too large', 'EXPORT_TOO_LARGE');
        const mb = Math.round(maxBytes / (1024 * 1024));
        return fail(res, 413, 'EXPORT_TOO_LARGE', `Your data is larger than the ${mb} MB export limit, so no file was created. Please contact support to receive your data.`);
      }
      audit(log, req, 'data export failed', typeof error?.code === 'string' ? error.code : undefined);
      res.set('Retry-After', '5');
      return fail(res, 503, 'SERVICE_UNAVAILABLE', 'Service temporarily unavailable');
    }
  });
  return router;
}
