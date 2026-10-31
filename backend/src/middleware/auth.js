// Ownership and internal-service guards. Bearer authentication is handled by backend auth.
import { createHash, timingSafeEqual } from 'crypto';

const unauthorized = (res, message = 'Authentication required') =>
  res.status(401).json({ success: false, error: message, code: 'UNAUTHENTICATED' });

const CLIENT_ID_KEYS = ['userId', 'user_id'];

/**
 * Binds the request to the authenticated user.
 *  - A client-supplied userId/user_id (body, query) that differs from the token
 *    subject is rejected with 403 (the client is confused or attacking).
 *  - A missing one is filled in from the token, so legacy handlers that read
 *    `req.body.userId` / `req.query.userId` now receive the verified identity.
 * Must run AFTER requireAuth, and AFTER multer for multipart routes (multer
 * populates req.body late).
 */
export const bindUserId = (req, res, next) => {
  if (!req.userId) return unauthorized(res);

  for (const bag of ['body', 'query']) {
    if (bag === 'body' && (req.body === undefined || req.body === null)) req.body = {};
    const target = req[bag];
    if (!target || typeof target !== 'object') continue;
    for (const key of CLIENT_ID_KEYS) {
      if (target[key] !== undefined && target[key] !== req.userId) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: user mismatch',
          code: 'USER_MISMATCH'
        });
      }
    }
    target.userId = req.userId;
  }
  // Legacy activity routes use snake_case.
  if (req.body && typeof req.body === 'object' && req.originalUrl.startsWith('/api/activity')) {
    req.body.user_id = req.userId;
  }
  return next();
};

/** router.param('userId') guard: a :userId path segment must be the caller. */
export const requireSelfParam = (req, res, next, value) => {
  if (value !== req.userId) {
    return res.status(403).json({
      success: false,
      error: 'Forbidden: user mismatch',
      code: 'USER_MISMATCH'
    });
  }
  return next();
};

const digest = (value) => createHash('sha256').update(String(value)).digest();

/** Constant-time check for the shared CRON_SECRET bearer token. */
export const requireCronSecret = (req, res, next) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return res.status(404).json({ success: false, error: 'Endpoint not found' });
  }
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token || !timingSafeEqual(digest(token), digest(secret))) {
    return unauthorized(res, 'Unauthorized');
  }
  return next();
};


