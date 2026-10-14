/**
 * End-to-end abuse-protection checks against a RUNNING local Next.js server
 * (NextAuth credentials + /api/auth/register) backed by the DEVELOPMENT database.
 *
 *   # start the app with small limits so the test can trip them:
 *   AUTH_RL_REGISTER_IP_PER_HOUR=8 AUTH_RL_REGISTER_EMAIL_PER_HOUR=3 \
 *   AUTH_RL_LOGIN_ACCOUNT_PER_15MIN=4 AUTH_RL_LOGIN_IP_PER_15MIN=40 npx next start -p 3000
 *   BASE=http://localhost:3000 node tests/auth-abuse.e2e.mjs
 *
 * Refuses to run against anything but localhost. Creates throwaway users
 * (phase2a-e2e-*@example.invalid) and deletes them through the app's own
 * account-deletion route.
 */
import { randomUUID } from 'node:crypto';

const BASE = process.env.BASE || 'http://localhost:3000';
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) throw new Error('Refusing to run against a non-local server');

let failed = 0;
const check = (name, ok, extra = '') => {
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? `  (${extra})` : ''}`);
};

const post = (path, body, headers = {}) =>
  fetch(BASE + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body)
  });

const jar = () => {
  let cookies = {};
  return {
    absorb(res) {
      for (const c of res.headers.getSetCookie?.() ?? []) {
        const [pair] = c.split(';');
        const i = pair.indexOf('=');
        cookies[pair.slice(0, i)] = pair.slice(i + 1);
      }
    },
    header() { return Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; '); },
    clear() { cookies = {}; }
  };
};

async function login(email, password, c, ip) {
  const extra = ip ? { 'x-forwarded-for': ip } : {};
  let r = await fetch(`${BASE}/api/auth/csrf`, { headers: { cookie: c.header(), ...extra } });
  c.absorb(r);
  const { csrfToken } = await r.json();
  r = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: 'POST',
    redirect: 'manual',
    headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: c.header(), ...extra },
    body: new URLSearchParams({ csrfToken, email, password, json: 'true' })
  });
  c.absorb(r);
  const body = await r.json().catch(() => ({}));
  const s = await (await fetch(`${BASE}/api/auth/session`, { headers: { cookie: c.header(), ...extra } })).json();
  return { session: s?.user ?? null, url: body?.url ?? '' };
}

const id = randomUUID();
const email = `phase2a-e2e-${id}@example.invalid`;
const good = `Sturdy-${id.slice(0, 8)}-passphrase`;
const c1 = jar();
let created = false;

try {
  console.log('--- password policy (new registrations)');
  let r = await post('/api/auth/register', { email, password: 'short1', fullName: 'E2E' });
  check('weak/short password rejected (400)', r.status === 400, `status ${r.status}`);
  r = await post('/api/auth/register', { email: `phase2a-e2e-${randomUUID()}@example.invalid`, password: 'password123' });
  check('common password rejected (400)', r.status === 400);
  r = await post('/api/auth/register', { email: 'not-an-email', password: good });
  check('invalid email rejected (400)', r.status === 400);
  r = await post('/api/auth/register', '{"email": "x", ');
  check('malformed JSON -> 400 not 500', r.status === 400);
  r = await post('/api/auth/register', { email, password: 'x'.repeat(2000) });
  check('oversized password rejected without hashing 2KB', r.status === 400 || r.status === 413);

  console.log('--- registration and enumeration surface');
  r = await post('/api/auth/register', { email: email.replace('@example.invalid', '@EXAMPLE.invalid'), password: good, fullName: 'E2E Tester' });
  const reg = await r.json();
  created = r.status === 201;
  check('valid registration succeeds (201); email stored lower-cased', r.status === 201 && reg.user?.email === email, `status ${r.status}`);
  r = await post('/api/auth/register', { email, password: good });
  const dup1 = await r.json();
  r = await post('/api/auth/register', { email: email.replace('phase2a', 'PHASE2A'), password: good });
  const dup2 = await r.json();
  check(
    'duplicate email (exact and different case) -> identical neutral 409 without "already exists"',
    r.status === 409 && dup1.error === dup2.error && !/already exists/i.test(dup1.error),
    String(dup1.error).slice(0, 40)
  );
  check('registration responses are not cacheable', r.headers.get('cache-control') === 'no-store');

  console.log('--- login behaviour');
  let res = await login(email, good, c1);
  check('login works with the original credentials', res.session?.email === email);
  c1.clear();
  res = await login(email.replace('@example.invalid', '@EXAMPLE.INVALID'), good, c1, '10.0.0.5');
  check('login is case-insensitive on email (legacy mixed-case accounts keep working)', res.session?.email === email);
  c1.clear();
  const unknown = await login(`nobody-${randomUUID()}@example.invalid`, good, jar(), '10.0.0.6');
  const wrong = await login(email, 'definitely-the-wrong-password', jar(), '10.0.0.7');
  const u1 = unknown.url.split('?')[0];
  const u2 = wrong.url.split('?')[0];
  check('unknown user and wrong password give the identical outcome', !unknown.session && !wrong.session && u1 === u2, `${u1} vs ${u2}`);

  console.log('--- throttling (per-account counter trips regardless of correct password)');
  const lock = jar();
  let lastUrl = '';
  for (let i = 0; i < 6; i++) {
    const x = await login(email, `wrong-password-${i}`, lock, `10.0.1.${i}`);
    lastUrl = x.url;
  }
  check('after repeated failures the account is throttled (TooManyAttempts)', /TooManyAttempts/.test(lastUrl), lastUrl.split('?')[1]?.slice(0, 40));
  const stillLocked = await login(email, good, jar(), '10.0.2.1');
  check('even the correct password is refused while throttled (no oracle)', !stillLocked.session);
  const other = await login(`other-${randomUUID()}@example.invalid`, 'whatever-password', jar(), '10.0.2.2');
  check('throttling one account does not block others', !/TooManyAttempts/.test(other.url));

  console.log('--- registration throttling');
  let tripped = false;
  for (let i = 0; i < 12 && !tripped; i++) {
    r = await post('/api/auth/register', { email: `phase2a-e2e-${randomUUID()}@example.invalid`, password: 'password123' }, { 'x-forwarded-for': '10.9.9.9' });
    tripped = r.status === 429;
    if (tripped) check('register IP throttle returns 429 with Retry-After', !!r.headers.get('retry-after'));
  }
  check('register IP throttle trips under a burst', tripped);
} finally {
  if (created) {
    // The account may still be throttled; clean up directly through the app only if a session can be established.
    const c = jar();
    const sess = await login(email, good, c, '10.7.7.7');
    if (!sess.session) {
      console.log(`NOTE: account is still throttled; remove it manually or restart the server: ${email}`);
    } else {
      const d = await fetch(`${BASE}/api/account`, { method: 'DELETE', headers: { cookie: c.header() } });
      check('cleanup: throwaway user deleted', d.status === 200);
    }
  }
}
console.log(failed ? `\n${failed} CHECK(S) FAILED` : '\nALL CHECKS PASSED');
process.exit(failed ? 1 : 0);
