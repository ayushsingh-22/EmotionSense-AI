/**
 * Security middleware: strict CORS, security headers, rate limiting, validation.
 */
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

/* ------------------------------- CORS --------------------------------- */

const DEV_DEFAULT_ORIGINS = ['http://localhost:3000', 'http://127.0.0.1:3000'];

/**
 * CORS_ORIGIN is a comma-separated allow-list. `*` inside an entry matches ONE
 * DNS label ([a-z0-9-]+), e.g. `https://mantra-*-myteam.vercel.app`.
 * A bare `*` is never honoured (it was the previous default). In production an
 * empty list means "no cross-origin browser access".
 * Requests without an Origin header (Android, curl, server-to-server) are not
 * CORS requests; they are protected by bearer-token auth instead.
 */
export const parseAllowedOrigins = (raw, nodeEnv = process.env.NODE_ENV) => {
  const entries = (raw || '').split(',').map((s) => s.trim()).filter(Boolean)
    .filter((e) => e !== '*');
  const list = entries.length > 0 ? entries : (nodeEnv === 'production' ? [] : DEV_DEFAULT_ORIGINS);
  return list.map((pattern) => {
    if (!pattern.includes('*')) return { exact: pattern.replace(/\/$/, '') };
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[a-z0-9-]+');
    return { regex: new RegExp(`^${escaped}$`) };
  });
};

export const buildCors = (raw = process.env.CORS_ORIGIN) => {
  const matchers = parseAllowedOrigins(raw);
  return cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      const ok = matchers.some((m) => (m.exact ? m.exact === origin : m.regex.test(origin)));
      // Not allowed: omit CORS headers (browser blocks it) instead of throwing a 500.
      return cb(null, ok);
    },
    // Bearer tokens in the Authorization header; no cookies cross this boundary.
    credentials: false,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    maxAge: 600
  });
};

/* ------------------------------ Headers -------------------------------- */

export const securityHeaders = () => helmet({
  // This is a JSON/audio API, not an HTML app.
  contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
  // Frontend on another origin plays /audio/* files.
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  referrerPolicy: { policy: 'no-referrer' },
  hsts: process.env.NODE_ENV === 'production'
    ? { maxAge: 15552000, includeSubDomains: true }
    : false
});

export const noStore = (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
};

/* ---------------------------- Rate limiting ---------------------------- */

const num = (name, fallback) => {
  const v = parseInt(process.env[name], 10);
  return Number.isFinite(v) && v > 0 ? v : fallback;
};

const json429 = (message) => ({ success: false, error: message, code: 'RATE_LIMITED' });

const base = {
  standardHeaders: true,
  legacyHeaders: false
};

const byUserOrIp = (req) => (req.userId ? `u:${req.userId}` : req.ip);

/** Coarse per-IP ceiling for everything. */
export const globalLimiter = () => rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit: num('RATE_LIMIT_GLOBAL_PER_15MIN', 1000),
  message: json429('Too many requests, please slow down'),
  skip: (req) => req.path === '/api/health' || req.path === '/api/health/'
});

/** Counts only FAILED auth attempts per IP (brute-force / token-guessing). */
export const authFailureLimiter = () => rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit: num('RATE_LIMIT_AUTH_FAILURES_PER_15MIN', 60),
  skipSuccessfulRequests: true,
  message: json429('Too many failed authentication attempts')
});

/** Paid AI/STT/TTS/emotion endpoints: per authenticated user, burst + daily. */
export const aiBurstLimiter = () => rateLimit({
  ...base,
  windowMs: 60 * 1000,
  limit: num('RATE_LIMIT_AI_PER_MIN', 20),
  keyGenerator: byUserOrIp,
  message: json429('AI request limit reached; wait a minute and retry')
});

export const aiDailyLimiter = () => rateLimit({
  ...base,
  windowMs: 24 * 60 * 60 * 1000,
  limit: num('RATE_LIMIT_AI_PER_DAY', 500),
  keyGenerator: byUserOrIp,
  message: json429('Daily AI usage limit reached')
});

/** Writes that trigger notifications (emergency contact edits). */
export const sensitiveWriteLimiter = () => rateLimit({
  ...base,
  windowMs: 60 * 60 * 1000,
  limit: num('RATE_LIMIT_SENSITIVE_PER_HOUR', 20),
  keyGenerator: byUserOrIp,
  message: json429('Too many changes, try again later')
});

/* ---------------------------- Validation ------------------------------- */

/**
 * validate({ body, query, params }) with zod schemas. Unknown keys are kept
 * (schemas use .passthrough()) so legacy clients keep working; known keys are
 * type- and length-checked and replaced by their parsed values.
 */
export const validate = (schemas) => (req, res, next) => {
  for (const part of ['params', 'query', 'body']) {
    const schema = schemas[part];
    if (!schema) continue;
    const result = schema.safeParse(req[part] ?? {});
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        code: 'VALIDATION_FAILED',
        details: result.error.issues.slice(0, 10).map((i) => ({
          field: [part, ...i.path].join('.'),
          message: i.message
        }))
      });
    }
    if (part === 'body') req.body = result.data;
    else Object.assign(req[part], result.data);
  }
  return next();
};
