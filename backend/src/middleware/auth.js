/**
 * Authentication & identity binding for the Express API.
 *
 * The Next.js frontend (Vercel) signs a short-lived HS256 bearer token
 * server-side after validating the NextAuth session (frontend/lib/backendAuth.ts,
 * served via /api/backend-token). This module verifies that token and is the
 * ONLY source of the caller's identity: `req.userId` / `req.user.id`.
 *
 * Token contract (must match frontend/lib/backendAuth.ts):
 *   alg = HS256 (pinned)   iss = "mantra-web"   aud = "mantra-api"
 *   sub = users.id         exp <= 5 minutes
 *
 * Secret: API_JWT_SECRET (dedicated, >= 32 chars, must differ from
 * NEXTAUTH_SECRET). No fallback.
 */
import { createHash, timingSafeEqual } from 'crypto';
import { jwtVerify, SignJWT } from 'jose';

export const TOKEN_ISSUER = 'mantra-web';
export const TOKEN_AUDIENCE = 'mantra-api';
const MIN_SECRET_LENGTH = 32;

let cachedSecretSource = null;
let cachedKey = null;

const getSecretKey = () => {
  // Dedicated signing secret only. There is deliberately NO fallback to
  // NEXTAUTH_SECRET: a leaked or rotated NextAuth secret must not also mint or
  // invalidate API tokens, and the two must never be the same value.
  const secret = process.env.API_JWT_SECRET;
  if (!secret) {
    throw new Error('API_JWT_SECRET is not configured on the backend');
  }
  if (secret.length < MIN_SECRET_LENGTH) {
    throw new Error(`API_JWT_SECRET must be at least ${MIN_SECRET_LENGTH} characters`);
  }
  if (process.env.NEXTAUTH_SECRET && secret === process.env.NEXTAUTH_SECRET) {
    throw new Error('API_JWT_SECRET must differ from NEXTAUTH_SECRET');
  }
  if (cachedSecretSource !== secret) {
    cachedKey = new TextEncoder().encode(secret);
    cachedSecretSource = secret;
  }
  return cachedKey;
};

export const TOKEN_TTL_SECONDS = 5 * 60;

/**
 * Mints a short-lived API token for an identity that was ALREADY authenticated
 * elsewhere (the Firebase exchange route). Same contract as the web tokens signed
 * by frontend/lib/backendAuth.ts: HS256, iss "mantra-web", aud "mantra-api",
 * sub = canonical users.id, 5-minute expiry, optional email claim.
 * `userId` must be users.id, never a provider subject.
 */
export const mintApiToken = async (userId, email) => {
  if (typeof userId !== 'string' || userId.length === 0 || userId.length > 128) {
    throw new Error('mintApiToken: invalid user id');
  }
  const token = await new SignJWT({ email: email ?? undefined })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(userId)
    .setIssuer(TOKEN_ISSUER)
    .setAudience(TOKEN_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_TTL_SECONDS}s`)
    .sign(getSecretKey());
  return { token, expiresAt: Date.now() + TOKEN_TTL_SECONDS * 1000, expiresIn: TOKEN_TTL_SECONDS };
};

/** Throws at boot if auth cannot work, instead of failing every request. */
export const assertAuthConfigured = () => {
  getSecretKey();
};

const unauthorized = (res, message = 'Authentication required') =>
  res.status(401).json({ success: false, error: message, code: 'UNAUTHENTICATED' });

export const requireAuth = async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
    if (!token) return unauthorized(res, 'Missing Authorization bearer token');

    const { payload } = await jwtVerify(token, getSecretKey(), {
      algorithms: ['HS256'],
      issuer: TOKEN_ISSUER,
      audience: TOKEN_AUDIENCE,
      requiredClaims: ['sub', 'exp'],
      clockTolerance: 5,
      maxTokenAge: '15m'
    });

    if (typeof payload.sub !== 'string' || payload.sub.length === 0 || payload.sub.length > 128) {
      return unauthorized(res, 'Invalid token');
    }

    req.userId = payload.sub;
    req.userEmail = typeof payload.email === 'string' ? payload.email : null;
    // Compatibility with legacy handlers that check req.user.id. No elevated
    // roles exist: the "service_role" bypass in older code can never match.
    req.user = { id: payload.sub, role: 'user' };
    return next();
  } catch (error) {
    if (/not configured|at least|must differ/.test(error.message)) {
      console.error('❌ Auth misconfigured:', error.message);
      return res.status(500).json({ success: false, error: 'Server auth misconfigured' });
    }
    // Never log the token itself.
    console.warn(`🔒 Auth rejected (${error.code || error.name}) ${req.method} ${req.path}`);
    return unauthorized(res, 'Invalid or expired token');
  }
};

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

export default requireAuth;
