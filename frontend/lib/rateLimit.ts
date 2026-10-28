import { createHash } from 'node:crypto';

/**
 * Rate limiting for the PUBLIC auth surface (NextAuth credentials login and
 * /api/auth/register), which runs on Vercel serverless/fluid functions.
 *
 * HONEST SCOPE — read before relying on it:
 *  - The default store is IN-MEMORY and therefore PER FUNCTION INSTANCE. Vercel can
 *    run many instances and recycles them, so this layer alone does NOT give a
 *    global guarantee. It still blunts naive single-instance brute force, adds a
 *    fixed delay-free cost to automated probing, and protects local/dev.
 *  - Global, reliable enforcement needs a shared store. The store is pluggable
 *    (setRateLimitStore) so a shared backend can be added without touching the
 *    routes, and Vercel Firewall rate-limit rules should be enabled on
 *    /api/auth/* regardless (see docs/PHASE2A_RELEASE_RUNBOOK.md, section 9).
 *  - Keys are salted hashes of the email/IP so no raw identifiers sit in memory
 *    or in any store.
 */

export interface RateLimitStore {
  /** Count one hit in the fixed window identified by key; returns the new count and when it resets. */
  hit(key: string, windowMs: number): Promise<{ count: number; resetAt: number }>;
  reset(key: string): Promise<void>;
}

const MAX_KEYS = 20_000;

export class MemoryRateLimitStore implements RateLimitStore {
  private readonly buckets = new Map<string, { count: number; resetAt: number }>();

  async hit(key: string, windowMs: number) {
    const now = Date.now();
    if (this.buckets.size >= MAX_KEYS) this.sweep(now);
    let bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      this.buckets.set(key, bucket);
    }
    bucket.count += 1;
    return { count: bucket.count, resetAt: bucket.resetAt };
  }

  async reset(key: string) {
    this.buckets.delete(key);
  }

  private sweep(now: number) {
    for (const [k, v] of this.buckets) if (v.resetAt <= now) this.buckets.delete(k);
    // Still full of live keys (an attack): drop the oldest entries to stay bounded.
    if (this.buckets.size >= MAX_KEYS) {
      let drop = Math.ceil(MAX_KEYS * 0.1);
      for (const k of this.buckets.keys()) { this.buckets.delete(k); if (--drop <= 0) break; }
    }
  }
}

let store: RateLimitStore = new MemoryRateLimitStore();
export const setRateLimitStore = (s: RateLimitStore) => { store = s; };

export interface RateLimitResult { allowed: boolean; remaining: number; retryAfterSec: number }

export async function consume(key: string, opts: { limit: number; windowMs: number }): Promise<RateLimitResult> {
  const { count, resetAt } = await store.hit(key, opts.windowMs);
  return {
    allowed: count <= opts.limit,
    remaining: Math.max(0, opts.limit - count),
    retryAfterSec: Math.max(1, Math.ceil((resetAt - Date.now()) / 1000))
  };
}

export const resetKey = (key: string) => store.reset(key);

/* ------------------------------ identifiers ------------------------------ */

const SALT = () => process.env.NEXTAUTH_SECRET || 'rl-dev-salt';

/** Stable, non-reversible key part for an email or IP. */
export const hashPart = (value: string) =>
  createHash('sha256').update(`${SALT()}:${value}`).digest('hex').slice(0, 32);

type HeaderBag = Headers | Record<string, string | string[] | undefined> | undefined;
const header = (h: HeaderBag, name: string): string | undefined => {
  if (!h) return undefined;
  if (typeof (h as Headers).get === 'function') return (h as Headers).get(name) ?? undefined;
  const v = (h as Record<string, string | string[] | undefined>)[name];
  return Array.isArray(v) ? v[0] : v;
};

/**
 * Client IP. On Vercel, x-vercel-forwarded-for / x-real-ip are set by the platform
 * edge (not client-controllable); x-forwarded-for is the fallback for local runs.
 */
export function clientIp(h: HeaderBag): string {
  const raw =
    header(h, 'x-vercel-forwarded-for') ||
    header(h, 'x-real-ip') ||
    header(h, 'x-forwarded-for') ||
    'unknown';
  return raw.split(',')[0].trim().slice(0, 64) || 'unknown';
}

/* --------------------------------- limits -------------------------------- */

const num = (name: string, fallback: number) => {
  const v = parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(v) && v > 0 ? v : fallback;
};

export const authLimits = () => ({
  loginPerIp: { limit: num('AUTH_RL_LOGIN_IP_PER_15MIN', 30), windowMs: 15 * 60_000 },
  loginPerAccount: { limit: num('AUTH_RL_LOGIN_ACCOUNT_PER_15MIN', 8), windowMs: 15 * 60_000 },
  registerPerIp: { limit: num('AUTH_RL_REGISTER_IP_PER_HOUR', 5), windowMs: 60 * 60_000 },
  registerPerEmail: { limit: num('AUTH_RL_REGISTER_EMAIL_PER_HOUR', 3), windowMs: 60 * 60_000 }
});
