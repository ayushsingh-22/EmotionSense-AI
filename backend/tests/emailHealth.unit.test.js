import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import express from 'express';
import request from 'supertest';
import { createInternalRouter } from '../src/routes/internalRoutes.js';
import { createGmailEmail } from '../src/auth/gmailEmail.js';
import { createResendEmail, createEmailAdapter } from '../src/auth/emailService.js';
import { checkEmailProvider, logEmailProviderCheck } from '../src/auth/emailHealth.js';
import { createGuardedEmergencySender } from '../src/utils/emergencyEmail.js';

const CRON = 'synthetic-cron-secret-0123456789abcdef';
const SECRETS = { clientSecret: 'synthetic-client-secret', refreshToken: 'synthetic-refresh-token', sender: 'sender@invalid.test', access: 'synthetic-access-token' };
// Fake Google: records every URL so tests prove no message is ever sent by the health check.
function google({ token = { status: 200, body: { access_token: SECRETS.access, expires_in: 3600 } }, send = { status: 200 }, hang = false } = {}) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push(url);
    if (hang) await new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted'))));
    const r = url.includes('oauth2') ? token : send;
    return { ok: r.status < 400, status: r.status, json: async () => r.body ?? {} };
  };
  return { calls, fetchImpl };
}
const gmail = (g, extra = {}) => createGmailEmail({ clientId: 'cid', clientSecret: SECRETS.clientSecret, refreshToken: SECRETS.refreshToken, sender: SECRETS.sender, fetchImpl: g.fetchImpl, sleep: async () => {}, timeoutMs: 50, ...extra });
const appWith = (email, opts) => { const a = express(); a.use('/api/internal', createInternalRouter({ runNightly: async () => {} }, { email, ...opts })); return a; };
async function capture(fn) {
  const lines = []; const log = console.log, error = console.error;
  console.log = l => lines.push(JSON.parse(String(l))); console.error = l => lines.push(JSON.parse(String(l)));
  try { return { result: await fn(), lines }; } finally { console.log = log; console.error = error; }
}
const withCron = async (value, fn) => { const saved = process.env.CRON_SECRET; if (value === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = value; try { return await fn(); } finally { if (saved === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = saved; } };
const get = (app, secret) => { const r = request(app).get('/api/internal/email-health'); return secret === undefined ? r : r.set('Authorization', `Bearer ${secret}`); };
const assertClean = text => { for (const s of [...Object.values(SECRETS), CRON]) assert.ok(!text.includes(s), 'secret, token or address leaked'); };

test('email-health requires CRON_SECRET: unset → 404, missing or wrong → 401, and never touches the provider', async () => {
  const g = google();
  await withCron(undefined, async () => assert.equal((await get(appWith(gmail(g)), CRON)).status, 404));
  await withCron(CRON, async () => {
    for (const bad of [undefined, 'wrong', CRON + 'x', CRON.slice(0, -1)]) assert.equal((await get(appWith(gmail(g)), bad)).status, 401);
  });
  assert.equal(g.calls.length, 0);
});

test('healthy provider: 200 {"ok":true}, one fresh token refresh, no email sent, no-store, clean log', async () => {
  const g = google();
  await withCron(CRON, async () => {
    const app = appWith(gmail(g));
    const { result: res, lines } = await capture(() => get(app, CRON));
    assert.equal(res.status, 200); assert.deepEqual(res.body, { ok: true });
    assert.equal(res.headers['cache-control'], 'no-store');
    assert.deepEqual(g.calls, ['https://oauth2.googleapis.com/token'], 'only the OAuth refresh endpoint is called');
    const line = lines.find(l => l.event === 'email provider check');
    assert.deepEqual(line, { level: 'info', event: 'email provider check', ok: true, provider: 'google', trigger: 'endpoint' });
    // A second check refreshes again (a cached access token can outlive a revoked refresh token).
    await get(app, CRON);
    assert.equal(g.calls.filter(u => u.includes('oauth2')).length, 2);
    assert.ok(!g.calls.some(u => u.includes('messages/send')));
    assertClean(JSON.stringify(res.body) + JSON.stringify(lines));
  });
});

test('failures: 503 with only {ok:false, code} for each cause; logs carry the same code and nothing secret', async () => {
  const cases = [
    [gmail(google({ token: { status: 400, body: { error: 'invalid_grant', error_description: 'Token has been expired or revoked.' } } })), 'EMAIL_AUTH_INVALID'],
    [gmail(google({ token: { status: 503 } })), 'EMAIL_AUTH_UNAVAILABLE'],
    [gmail(google({ hang: true })), 'EMAIL_TIMEOUT'],
    [gmail({ fetchImpl: async () => { throw new TypeError('offline'); } }), 'EMAIL_NETWORK_ERROR'],
    [createGmailEmail({ fetchImpl: google().fetchImpl }), 'EMAIL_NOT_CONFIGURED'],
    [createEmailAdapter({ env: { EMAIL_PROVIDER: 'none' } }), 'EMAIL_NOT_CONFIGURED'],
    [undefined, 'EMAIL_NOT_CONFIGURED']
  ];
  await withCron(CRON, async () => {
    for (const [email, code] of cases) {
      const { result: res, lines } = await capture(() => get(appWith(email), CRON));
      assert.equal(res.status, 503, code); assert.deepEqual(res.body, { ok: false, code }, code);
      const line = lines.find(l => l.event === 'email provider check');
      assert.equal(line.ok, false); assert.equal(line.code, code); assert.equal(line.trigger, 'endpoint'); assert.equal(line.level, 'error');
      assertClean(res.text + JSON.stringify(lines));
      assert.ok(!res.text.includes('expired or revoked'), 'provider messages are not echoed');
    }
  });
});

test('email-health is rate-limited (10 per 15 min), counting wrong-secret attempts too', async () => {
  await withCron(CRON, async () => {
    const app = appWith(gmail(google()));
    for (let i = 0; i < 10; i++) assert.notEqual((await get(app, i % 2 ? CRON : 'wrong')).status, 429);
    const limited = await get(app, CRON);
    assert.equal(limited.status, 429); assert.deepEqual(limited.body, { ok: false, code: 'RATE_LIMITED' });
  });
});

test('startup check: same result shape and an "email provider check" line with trigger startup; wired in server.js', async () => {
  assert.deepEqual(await checkEmailProvider(gmail(google())), { ok: true });
  assert.deepEqual(await checkEmailProvider(createResendEmail({ apiKey: 'k', from: 'f@invalid.test' })), { ok: true });
  assert.deepEqual(await checkEmailProvider(createResendEmail({})), { ok: false, code: 'EMAIL_NOT_CONFIGURED' });
  const r = await checkEmailProvider(gmail(google({ token: { status: 400, body: { error: 'invalid_grant' } } })));
  const { lines } = await capture(() => logEmailProviderCheck(r, { provider: 'google', trigger: 'startup' }));
  assert.deepEqual(lines[0], { level: 'error', event: 'email provider check', ok: false, provider: 'google', trigger: 'startup', code: 'EMAIL_AUTH_INVALID' });
  const server = fs.readFileSync(new URL('../src/server.js', import.meta.url), 'utf8');
  assert.match(server, /createInternalRouter\(undefined, \{ email: authServices\.email \}\)/);
  assert.match(server, /setImmediate\(\(\) => \{ checkEmailProvider\(services\?\.email\)\.then\(result => logEmailProviderCheck\(result, \{ provider: services\?\.email\?\.provider, trigger: 'startup' \}\)\)\.catch\(\(\) => \{\}\); \}\);\s*\n\s*app\.listen/, 'non-blocking, before listen returns');
});

// Fake DB for the guarded emergency sender: contact + consent allow the send; records alert_log updates.
function emergencyDb() {
  const updates = [];
  const contact = { notifyEnabled: true, contactEmail: 'contact@invalid.test' };
  const base = {
    $queryRaw: async () => [],
    emergencyContact: { findUnique: async () => contact },
    userConsent: { findFirst: async () => ({ granted: true, purpose: 'emergency_alert_sharing', noticeVersion: 'emergency-alert-v1', recordedAt: new Date() }) },
    alertLog: { create: async () => ({ id: 'alert-1' }), updateMany: async args => { updates.push(args.data); return { count: 1 }; } }
  };
  return { db: { ...base, $transaction: async fn => fn(base) }, updates };
}
const person = { id: 'user-1', full_name: 'Synthetic Person' }, target = { contact_email: 'contact@invalid.test' };

test('emergency alert: send failure logs the structured reason (no PII) and alertSent stays false', async () => {
  const { db, updates } = emergencyDb();
  const g = google({ token: { status: 400, body: { error: 'invalid_grant' } } });
  const send = createGuardedEmergencySender({ db, email: gmail(g), sleep: async () => {} });
  const { result, lines } = await capture(() => send(person, target));
  assert.equal(result, false);
  assert.deepEqual(updates, [{ additionalData: { status: 'failed', alertSent: false } }]);
  const line = lines.find(l => l.event === 'emergency alert delivery failed');
  assert.deepEqual(line, { level: 'error', event: 'emergency alert delivery failed', code: 'EMAIL_AUTH_INVALID', provider: 'google' });
  const all = JSON.stringify(lines);
  for (const pii of ['contact@invalid.test', 'Synthetic', 'user-1', 'struggling']) assert.ok(!all.includes(pii), `log contains ${pii}`);
  assert.ok(!g.calls.some(u => u.includes('messages/send')), 'nothing was delivered');
});

test('emergency alert: a successful send records alertSent true; a rejected send records false with EMAIL_REJECTED', async () => {
  const ok = emergencyDb();
  assert.equal(await createGuardedEmergencySender({ db: ok.db, email: gmail(google()), sleep: async () => {} })(person, target), true);
  assert.deepEqual(ok.updates, [{ additionalData: { status: 'accepted', alertSent: true } }]);
  const bad = emergencyDb();
  const { result, lines } = await capture(() => createGuardedEmergencySender({ db: bad.db, email: gmail(google({ send: { status: 400 } })), sleep: async () => {} })(person, target));
  assert.equal(result, false);
  assert.deepEqual(bad.updates, [{ additionalData: { status: 'failed', alertSent: false } }]);
  assert.equal(lines.find(l => l.event === 'emergency alert delivery failed').code, 'EMAIL_REJECTED');
});
