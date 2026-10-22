/**
 * Firebase identity routes.
 *
 *   POST /api/auth/firebase/exchange   PUBLIC (no API JWT yet), body { idToken }
 *   GET  /api/identity/me              authenticated (Phase 2A requireAuth chain)
 *
 * The exchange route:
 *   1. is invisible (404) unless FIREBASE_EXCHANGE_ENABLED=true;
 *   2. answers 503 unless the Phase 2B.2 identity schema is present in the connected database;
 *   3. is rate limited per IP (all requests + failures) and per verified Firebase UID;
 *   4. accepts only a small JSON body {"idToken": "<Firebase ID token>"};
 *   5. verifies the token with the Firebase Admin SDK BEFORE touching the application database;
 *   6. resolves or safely provisions the canonical Neon user (never auto-links by email);
 *   7. mints the usual 5-minute API JWT with sub = users.id.
 * It never logs tokens or e-mail addresses, and never returns internal error text.
 */
import express from 'express';
import rateLimit from 'express-rate-limit';
import { createHash } from 'node:crypto';
import prisma from '../lib/prisma.js';
import { mintApiToken } from '../middleware/auth.js';
import {
  verifyFirebaseIdToken, isExchangeEnabled, getFirebaseAuth, TokenRejected, VerifierUnavailable
} from '../identity/firebaseVerifier.js';
import { resolveFirebaseIdentity, getIdentityProfile } from '../identity/identityService.js';
import { createSchemaReadiness } from '../identity/schemaReadiness.js';
import { createKeyedLimiter } from '../identity/keyedLimiter.js';

const MAX_BODY = '8kb';
const num = (name, fallback) => {
  const v = parseInt(process.env[name], 10);
  return Number.isFinite(v) && v > 0 ? v : fallback;
};
const sha = (v) => createHash('sha256').update(String(v)).digest('hex');

const fail = (res, status, code, error, req) => res.status(status).json({
  success: false, error, code, ...(req?.id ? { requestId: req.id } : {})
});

const UNAVAILABLE = 'Sign-in with this method is temporarily unavailable.';
const MESSAGES = {
  email_not_verified: { status: 403, code: 'EMAIL_NOT_VERIFIED', error: 'Please verify your email address with your sign-in provider and try again.' },
  unsupported_method: { status: 403, code: 'UNSUPPORTED_SIGN_IN_METHOD', error: 'This sign-in method is not supported.' },
  invalid_email: { status: 403, code: 'EMAIL_NOT_VERIFIED', error: 'Please verify your email address with your sign-in provider and try again.' },
  disabled: { status: 403, code: 'IDENTITY_DISABLED', error: 'This account cannot sign in.' },
  // The caller has just proven ownership of this e-mail, so telling them an account exists is not an enumeration leak.
  link_required: { status: 409, code: 'ACCOUNT_LINK_REQUIRED', error: 'An account with this email already exists. It must be linked before you can sign in this way.' }
};

/** Dependencies are injectable so tests can use mocks; defaults wire the real services. */
export const buildDefaultDeps = () => ({
  verifyToken: verifyFirebaseIdToken,
  resolveIdentity: (claims) => resolveFirebaseIdentity(prisma, claims),
  mintToken: mintApiToken,
  isEnabled: () => isExchangeEnabled(),
  isConfigured: () => {
    try { getFirebaseAuth(); return true; } catch (error) {
      console.error(`❌ Firebase Admin not configured (${error instanceof VerifierUnavailable ? error.reason : 'unexpected'})`);
      return false;
    }
  },
  isReady: createSchemaReadiness(prisma),
  prisma
});

export const createFirebaseExchangeRouter = (deps = buildDefaultDeps(), limits = {}) => {
  const {
    ipPer15Min = num('RATE_LIMIT_EXCHANGE_PER_15MIN', 60),
    failuresPer15Min = num('RATE_LIMIT_EXCHANGE_FAILURES_PER_15MIN', 20),
    uidPer15Min = num('RATE_LIMIT_EXCHANGE_PER_UID_PER_15MIN', 30)
  } = limits;

  const rl = (extra) => rateLimit({
    standardHeaders: true, legacyHeaders: false, windowMs: 15 * 60 * 1000,
    message: { success: false, error: 'Too many sign-in attempts. Please try again later.', code: 'RATE_LIMITED' },
    ...extra
  });
  const ipLimiter = rl({ limit: ipPer15Min });
  // Counts only client faults (bad body / bad token / forbidden): outages and 409s do not eat the budget.
  const failureLimiter = rl({ limit: failuresPer15Min, skipSuccessfulRequests: true, requestWasSuccessful: (req, res) => ![400, 401, 403].includes(res.statusCode) });
  const uidLimiter = createKeyedLimiter({ windowMs: 15 * 60 * 1000, limit: uidPer15Min });

  const router = express.Router();
  router.use((req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });

  // Not enabled => the route does not exist.
  router.use((req, res, next) => (deps.isEnabled()
    ? next()
    : res.status(404).json({ success: false, error: 'Endpoint not found' })));

  router.all('/', (req, res, next) => {
    if (req.method === 'POST') return next();
    res.setHeader('Allow', 'POST');
    return fail(res, 405, 'METHOD_NOT_ALLOWED', 'Method not allowed', req);
  });

  router.post(
    '/',
    ipLimiter,
    failureLimiter,
    (req, res, next) => (req.is('application/json') ? next() : fail(res, 415, 'UNSUPPORTED_MEDIA_TYPE', 'Content-Type must be application/json', req)),
    express.json({ limit: MAX_BODY, strict: true, type: 'application/json' }),
    async (req, res, next) => {
      try {
        const idToken = req.body && typeof req.body === 'object' ? req.body.idToken : undefined;
        if (typeof idToken !== 'string' || idToken.length === 0 || idToken.length > 4096) {
          return fail(res, 400, 'VALIDATION_FAILED', 'idToken is required', req);
        }

        // Fail closed when Firebase Admin is not configured (no partial behaviour, no detail leaked).
        if (deps.isConfigured && !deps.isConfigured()) return fail(res, 503, 'IDENTITY_UNAVAILABLE', UNAVAILABLE, req);
        // Never reach Firebase or the identity tables on a database that lacks the migration.
        if (!(await deps.isReady())) return fail(res, 503, 'IDENTITY_UNAVAILABLE', UNAVAILABLE, req);

        let claims;
        try {
          claims = await deps.verifyToken(idToken);
        } catch (error) {
          if (error instanceof TokenRejected) {
            console.warn(`🔒 Firebase exchange rejected (${error.reason}) [${req.id ?? '-'}]`);
            return fail(res, 401, 'INVALID_FIREBASE_TOKEN', 'The sign-in token is invalid or has expired.', req);
          }
          const reason = error instanceof VerifierUnavailable ? error.reason : 'unexpected';
          console.error(`❌ Firebase verification unavailable (${reason}) [${req.id ?? '-'}]`);
          return fail(res, 503, 'IDENTITY_UNAVAILABLE', UNAVAILABLE, req);
        }

        // Per-identity throttle, applied only after the token is proven genuine.
        const uidKey = sha(`${claims.projectId}:${claims.uid}`);
        if (!uidLimiter.take(uidKey)) {
          res.setHeader('Retry-After', String(uidLimiter.retryAfterSec(uidKey)));
          return fail(res, 429, 'RATE_LIMITED', 'Too many sign-in attempts. Please try again later.', req);
        }

        const result = await deps.resolveIdentity(claims);
        if (result.status !== 'ok') {
          const m = MESSAGES[result.status];
          if (!m) throw new Error(`unhandled identity status: ${result.status}`);
          console.warn(`🔒 Firebase exchange refused (${result.status}) [${req.id ?? '-'}]`);
          return fail(res, m.status, m.code, m.error, req);
        }

        const { token, expiresAt, expiresIn } = await deps.mintToken(result.user.id, result.user.email);
        return res.status(200).json({
          success: true,
          token,
          tokenType: 'Bearer',
          expiresAt,
          expiresIn,
          provisioned: result.provisioned,
          user: result.user
        });
      } catch (error) {
        return next(error); // central handler: generic message + request id, redacted log
      }
    }
  );
  return router;
};

/** GET /api/identity/me — mounted behind [authFailureLimiter, requireAuth, noStore, bindUserId]. */
export const createIdentityMeRouter = (deps = { prisma }) => {
  const router = express.Router();
  router.get('/me', async (req, res, next) => {
    try {
      // Identity comes ONLY from the verified API token; nothing the client sent is used.
      const profile = await getIdentityProfile(deps.prisma, req.userId);
      if (!profile) return fail(res, 404, 'USER_NOT_FOUND', 'Account not found', req);
      return res.json({ success: true, user: profile });
    } catch (error) {
      return next(error);
    }
  });
  return router;
};
