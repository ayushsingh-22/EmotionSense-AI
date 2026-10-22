/**
 * Account-linking routes (Phase 2B.5B.2). Mounted at /api/auth/firebase/link, next to the public exchange route.
 *
 *   POST /api/auth/firebase/link/start     { idToken, password, consent: true }   -> one-time challenge
 *   POST /api/auth/firebase/link/complete  { idToken, challenge, consent: true }  -> link + normal 5-minute API JWT
 *
 * These routes are PUBLIC in the Phase 2A sense (the caller has no API JWT: the exchange answered 409
 * ACCOUNT_LINK_REQUIRED). The credentials are the Firebase ID token (both steps) plus the web password (start). They are
 * deliberately NOT under /api/identity, so the authenticated namespace keeps its blanket requireAuth chain; this router
 * is terminal (it never falls through to another router) and does not authenticate anything except its two paths.
 *
 *   1. invisible (404) unless ACCOUNT_LINKING_ENABLED === 'true' AND FIREBASE_EXCHANGE_ENABLED === 'true';
 *   2. 503 unless Firebase Admin is configured and the identity + link-challenge schema is present;
 *   3. per-IP (all + failures), per verified Firebase UID, and per target account (password failures) rate limits;
 *   4. small strict JSON bodies (8 KB, unknown fields rejected: no client userId / uid / project / emailVerified);
 *   5. the API JWT is minted only after the link transaction committed.
 * Logs carry reason codes and request ids only: never passwords, tokens, challenges, e-mails or provider subjects.
 */
import express from 'express';
import rateLimit from 'express-rate-limit';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { mintApiToken } from '../middleware/auth.js';
import {
  verifyFirebaseIdToken, isExchangeEnabled, getFirebaseAuth, TokenRejected, VerifierUnavailable
} from '../identity/firebaseVerifier.js';
import { createLinkSchemaReadiness } from '../identity/schemaReadiness.js';
import { createKeyedLimiter } from '../identity/keyedLimiter.js';
import { createLinkStore } from '../identity/linkStore.js';
import {
  isLinkingEnabled, checkLinkClaims, startLink, completeLink, CHALLENGE_RE, CHALLENGE_TTL_SECONDS,
  DEFAULT_MAX_AUTH_AGE_SECONDS
} from '../identity/linkService.js';

const MAX_BODY = '8kb';
const WINDOW_MS = 15 * 60 * 1000;
const num = (name, fallback) => {
  const v = parseInt(process.env[name], 10);
  return Number.isFinite(v) && v > 0 ? v : fallback;
};
const sha = (v) => createHash('sha256').update(String(v)).digest('hex');
const notFound = (res) => res.status(404).json({ success: false, error: 'Endpoint not found' });
const fail = (res, status, code, error, req) => res.status(status).json({
  success: false, error, code, ...(req?.id ? { requestId: req.id } : {})
});

const UNAVAILABLE = 'Account linking is temporarily unavailable.';
const TOO_MANY = 'Too many attempts. Please try again later.';
const MESSAGES = {
  unsupported_method: { status: 403, code: 'UNSUPPORTED_SIGN_IN_METHOD', error: 'This sign-in method is not supported.' },
  email_not_verified: { status: 403, code: 'EMAIL_NOT_VERIFIED', error: 'Please verify your email address with your sign-in provider and try again.' },
  reauth_required: { status: 401, code: 'REAUTHENTICATION_REQUIRED', error: 'Please sign in again, then retry linking.' },
  disabled: { status: 403, code: 'IDENTITY_DISABLED', error: 'This account cannot sign in.' },
  already_linked: { status: 409, code: 'IDENTITY_ALREADY_LINKED', error: 'This sign-in is already connected to an account. Please sign in again.' },
  // One answer for: no account with this e-mail, account without a password, wrong password.
  proof_failed: { status: 401, code: 'LINK_PROOF_FAILED', error: 'The password is incorrect.' },
  // One answer for: unknown, tampered, expired, already used, other identity, password changed since start.
  invalid_challenge: { status: 400, code: 'LINK_CHALLENGE_INVALID', error: 'This linking request has expired or was already used. Please start again.' }
};

const idToken = z.string().min(20).max(4096);
const consent = z.literal(true);
const START_SCHEMA = z.object({ idToken, password: z.string().min(1).max(1024), consent }).strict();
const COMPLETE_SCHEMA = z.object({ idToken, challenge: z.string().regex(CHALLENGE_RE), consent }).strict();

/** Dependencies are injectable so tests can use mocks / fake stores; defaults wire the real services. */
export const buildDefaultLinkDeps = () => {
  const store = createLinkStore(prisma);
  return {
    isEnabled: () => isLinkingEnabled() && isExchangeEnabled(),
    isConfigured: () => {
      try { getFirebaseAuth(); return true; } catch (error) {
        console.error(`❌ Firebase Admin not configured (${error instanceof VerifierUnavailable ? error.reason : 'unexpected'})`);
        return false;
      }
    },
    isReady: createLinkSchemaReadiness(prisma),
    verifyToken: verifyFirebaseIdToken,
    startLink: (claims, email, password) => startLink(store, claims, email, password),
    completeLink: (claims, email, challenge) => completeLink(store, claims, email, challenge),
    mintToken: mintApiToken,
    now: () => Date.now()
  };
};

export const createAccountLinkRouter = (deps = buildDefaultLinkDeps(), limits = {}) => {
  const {
    ipPer15Min = num('RATE_LIMIT_LINK_PER_15MIN', 30),
    failuresPer15Min = num('RATE_LIMIT_LINK_FAILURES_PER_15MIN', 15),
    uidPer15Min = num('RATE_LIMIT_LINK_PER_UID_PER_15MIN', 15),
    passwordFailuresPer15Min = num('RATE_LIMIT_LINK_PASSWORD_FAILURES_PER_15MIN', 5),
    maxAuthAgeSeconds = Math.min(3600, Math.max(60, num('ACCOUNT_LINK_MAX_AUTH_AGE_SECONDS', DEFAULT_MAX_AUTH_AGE_SECONDS)))
  } = limits;
  const now = deps.now || (() => Date.now());

  const rl = (extra) => rateLimit({
    standardHeaders: true, legacyHeaders: false, windowMs: WINDOW_MS,
    message: { success: false, error: TOO_MANY, code: 'RATE_LIMITED' },
    ...extra
  });
  // Shared by both steps: one budget per IP for the whole linking flow.
  const ipLimiter = rl({ limit: ipPer15Min });
  const failureLimiter = rl({ limit: failuresPer15Min, skipSuccessfulRequests: true, requestWasSuccessful: (req, res) => ![400, 401, 403].includes(res.statusCode) });
  const uidLimiter = createKeyedLimiter({ windowMs: WINDOW_MS, limit: uidPer15Min });
  const passwordLimiter = createKeyedLimiter({ windowMs: WINDOW_MS, limit: passwordFailuresPer15Min });

  const limited = (res, req, limiter, key) => {
    res.setHeader('Retry-After', String(limiter.retryAfterSec(key)));
    return fail(res, 429, 'RATE_LIMITED', TOO_MANY, req);
  };
  const refuse = (res, req, phase, status) => {
    const m = MESSAGES[status];
    if (!m) throw new Error(`unhandled link status: ${status}`);
    console.warn(`🔒 Account link ${phase} refused (${status}) [${req.id ?? '-'}]`);
    return fail(res, m.status, m.code, m.error, req);
  };

  /** Body checks shared by both steps. Returns parsed data or null after responding. Never echoes values. */
  const parseBody = (req, res, schema) => {
    const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : null;
    if (!body || body.consent !== true) return fail(res, 400, 'CONSENT_REQUIRED', 'Please confirm that you want to link these accounts.', req) && null;
    const parsed = schema.safeParse(body);
    if (!parsed.success) return fail(res, 400, 'VALIDATION_FAILED', 'Invalid request', req) && null;
    return parsed.data;
  };

  /** Fresh Firebase proof shared by both steps. Returns { claims, email } or null after responding. */
  const proveFirebase = async (req, res, phase, token) => {
    if (deps.isConfigured && !deps.isConfigured()) return fail(res, 503, 'IDENTITY_UNAVAILABLE', UNAVAILABLE, req) && null;
    if (!(await deps.isReady())) return fail(res, 503, 'IDENTITY_UNAVAILABLE', UNAVAILABLE, req) && null;
    let claims;
    try {
      claims = await deps.verifyToken(token);
    } catch (error) {
      if (error instanceof TokenRejected) {
        console.warn(`🔒 Account link ${phase} rejected (${error.reason}) [${req.id ?? '-'}]`);
        return fail(res, 401, 'INVALID_FIREBASE_TOKEN', 'The sign-in token is invalid or has expired.', req) && null;
      }
      const reason = error instanceof VerifierUnavailable ? error.reason : 'unexpected';
      console.error(`❌ Firebase verification unavailable (${reason}) [${req.id ?? '-'}]`);
      return fail(res, 503, 'IDENTITY_UNAVAILABLE', UNAVAILABLE, req) && null;
    }
    const uidKey = sha(`link:${claims.projectId}:${claims.uid}`);
    if (!uidLimiter.take(uidKey)) return limited(res, req, uidLimiter, uidKey) && null;
    const check = checkLinkClaims(claims, { nowMs: now(), maxAuthAgeSeconds });
    if (check.status !== 'ok') return refuse(res, req, phase, check.status) && null;
    return { claims, email: check.email };
  };

  const router = express.Router();
  router.use((req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  // Not enabled => the routes do not exist.
  router.use((req, res, next) => (deps.isEnabled() ? next() : notFound(res)));
  router.use((req, res, next) => {
    const path = req.path.replace(/\/+$/, '');
    if (path !== '/start' && path !== '/complete') return notFound(res);
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return fail(res, 405, 'METHOD_NOT_ALLOWED', 'Method not allowed', req);
    }
    return next();
  });
  router.use(
    ipLimiter,
    failureLimiter,
    (req, res, next) => (req.is('application/json') ? next() : fail(res, 415, 'UNSUPPORTED_MEDIA_TYPE', 'Content-Type must be application/json', req)),
    express.json({ limit: MAX_BODY, strict: true, type: 'application/json' })
  );

  router.post('/start', async (req, res, next) => {
    try {
      const body = parseBody(req, res, START_SCHEMA);
      if (!body) return undefined;
      const caller = await proveFirebase(req, res, 'start', body.idToken);
      if (!caller) return undefined;

      // Password guessing budget per TARGET account. Keyed by the caller's own verified e-mail, so it reveals nothing.
      const accountKey = sha(`link:acct:${caller.email}`);
      if (passwordLimiter.isLimited(accountKey)) return limited(res, req, passwordLimiter, accountKey);

      const result = await deps.startLink(caller.claims, caller.email, body.password);
      if (result.status === 'proof_failed') passwordLimiter.take(accountKey);
      if (result.status !== 'ok') return refuse(res, req, 'start', result.status);

      const expiresAt = new Date(result.expiresAt).getTime();
      const expiresIn = Math.max(0, Math.min(CHALLENGE_TTL_SECONDS, Math.floor((expiresAt - now()) / 1000)));
      console.log(`🔗 Account link challenge issued [${req.id ?? '-'}]`);
      return res.status(201).json({ success: true, challenge: result.challenge, expiresAt, expiresIn });
    } catch (error) {
      return next(error); // central handler: generic message + request id, redacted log
    }
  });

  router.post('/complete', async (req, res, next) => {
    try {
      const body = parseBody(req, res, COMPLETE_SCHEMA);
      if (!body) return undefined;
      const caller = await proveFirebase(req, res, 'complete', body.idToken);
      if (!caller) return undefined;

      const result = await deps.completeLink(caller.claims, caller.email, body.challenge);
      if (result.status !== 'ok') return refuse(res, req, 'complete', result.status);

      // Only now, after the link committed, is a canonical API token issued (sub = the ORIGINAL users.id).
      const { token, expiresAt, expiresIn } = await deps.mintToken(result.user.id, result.user.email);
      console.log(`🔗 Account linked${result.reconciled ? ' (reconciled)' : ''} [${req.id ?? '-'}]`);
      return res.status(200).json({
        success: true, token, tokenType: 'Bearer', expiresAt, expiresIn, linked: true, user: result.user
      });
    } catch (error) {
      return next(error);
    }
  });

  // Terminal: nothing under this mount point ever reaches another router.
  router.use((req, res) => notFound(res));
  return router;
};
