#!/usr/bin/env node
/**
 * Read-only post-deploy verification for the Phase 2A security release.
 * Needs no credentials. Every probe is either a GET/OPTIONS or a POST with an
 * empty body to an endpoint that the OLD (unauthenticated) backend would reject
 * as invalid input, so running it can never trigger paid AI work or mutate data
 * — even if it is accidentally pointed at a not-yet-upgraded backend.
 *
 * Usage:
 *   node scripts/verify-deployment.mjs \
 *     --backend  https://<render-service>.onrender.com \
 *     --frontend https://<production-domain> \
 *     --origin   https://<production-domain>
 *
 * Exit code 0 = all checks passed; 1 = at least one failed.
 * Run it (a) against the backend BEFORE cutting traffic assumptions, and (b)
 * any time you suspect a rollback landed on the old build.
 */
import { SignJWT } from 'jose';
import { randomUUID } from 'node:crypto';

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1]?.replace(/\/$/, '') : undefined;
};
const BACKEND = arg('backend');
const FRONTEND = arg('frontend');
const ORIGIN = arg('origin') || FRONTEND;
if (!BACKEND) {
  console.error('Usage: node scripts/verify-deployment.mjs --backend <url> [--frontend <url>] [--origin <url>]');
  process.exit(2);
}

let failed = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failed += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
};
const call = async (url, init = {}) => {
  try {
    return await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(60000), ...init });
  } catch (e) {
    return { status: 0, headers: new Headers(), json: async () => ({}), error: e.message };
  }
};

const U = randomUUID();
console.log(`\nBackend: ${BACKEND}\n`);

// 1. Which build is live?
const health = await call(`${BACKEND}/api/health`);
const body = await health.json().catch(() => ({}));
check('backend reachable', health.status === 200, `status ${health.status}`);
check('authenticated build is live (health.release = phase2a-auth-1)', body.release === 'phase2a-auth-1',
  body.release ? `release ${body.release}` : 'no release marker -> OLD build');

// 2. Anonymous callers must be rejected everywhere (read-only probes only).
const anon = [
  ['GET', `/api/chat/sessions?userId=${U}`],
  ['GET', `/api/emergency/${U}`],
  ['GET', `/api/journal/list?userId=${U}`],
  ['GET', `/api/journal/status`],
  ['GET', `/api/insights/stats?userId=${U}`],
  ['GET', `/api/activity/history/${U}`],
  ['GET', `/api/health/detailed`],
  ['GET', `/api/health/email`],
  ['GET', `/api/emergency/email/status`],
  ['GET', `/api/cron/ping`],
  ['POST', `/api/tts`],
  ['POST', `/api/emergency/save`]
];
for (const [method, path] of anon) {
  const r = await call(`${BACKEND}${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: method === 'POST' ? '{}' : undefined
  });
  check(`anonymous ${method} ${path.split('?')[0].replace(U, ':id')} -> 401`, r.status === 401, `status ${r.status}`);
}

// 3. Forged / wrong-secret token must be rejected.
const forged = await new SignJWT({ sid: randomUUID() })
  .setProtectedHeader({ alg: 'HS256' }).setSubject(U).setIssuer('mindhaven-auth').setAudience('mindhaven-api').setJti(randomUUID())
  .setIssuedAt().setExpirationTime('5m')
  .sign(new TextEncoder().encode(`forged-${randomUUID()}-${randomUUID()}`));
const f = await call(`${BACKEND}/api/chat/sessions`, { headers: { Authorization: `Bearer ${forged}` } });
check('forged token (wrong secret) -> 401', f.status === 401, `status ${f.status}`);

// 4. CORS + headers.
const evil = await call(`${BACKEND}/api/chat/sessions`, {
  method: 'OPTIONS',
  headers: { Origin: 'https://evil.example', 'Access-Control-Request-Method': 'GET' }
});
check('CORS: hostile origin gets no Access-Control-Allow-Origin', !evil.headers.get('access-control-allow-origin'));
if (ORIGIN) {
  const good = await call(`${BACKEND}/api/chat/sessions`, {
    method: 'OPTIONS',
    headers: { Origin: ORIGIN, 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'authorization' }
  });
  check(`CORS: production origin ${ORIGIN} is allowed`, good.headers.get('access-control-allow-origin') === ORIGIN,
    `got ${good.headers.get('access-control-allow-origin')}`);
}
check('security headers (nosniff, no x-powered-by)',
  health.headers.get('x-content-type-options') === 'nosniff' && !health.headers.get('x-powered-by'));

// 5. Frontend session endpoint.
if (FRONTEND) {
  console.log(`\nFrontend: ${FRONTEND}\n`);
  const c = await call(`${FRONTEND}/api/auth/csrf`);
  check('frontend NextAuth reachable (/api/auth/csrf)', c.status === 200, `status ${c.status}`);
}

console.log(`\n${failed === 0 ? 'ALL CHECKS PASSED' : `${failed} CHECK(S) FAILED`}`);
process.exit(failed === 0 ? 0 : 1);
