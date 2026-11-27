import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import express from 'express';
import request from 'supertest';
import { createBackendAuthRouter } from '../src/routes/backendAuthRoutes.js';
import { createPasswordService } from '../src/auth/passwordService.js';
import { createGmailEmail } from '../src/auth/gmailEmail.js';
import { createResendEmail, createEmailAdapter } from '../src/auth/emailService.js';

const EMAIL = 'otp-recipient@invalid.test', SENDER = 'sender@invalid.test';
// Fake Google endpoints: the token endpoint answers with `token`, the send endpoint with `send`.
const google = ({ token = { status: 200, body: { access_token: 'fake-access', expires_in: 3600 } }, send = { status: 200 } } = {}) => async (url) => {
  const r = url.includes('oauth2') ? token : send;
  return { ok: r.status < 400, status: r.status, json: async () => r.body ?? {} };
};
function app(email) {
  const prisma = { user: { create: async ({ data }) => ({ id: 'u1', ...data, emailVerifiedAt: null }), findUnique: async () => null } };
  const services = { passwords: createPasswordService({ cost: 4 }), tokens: {}, sessions: {}, challenges: { issue: async () => ({ code: '424242' }) }, email };
  const a = express(); a.use((req, _r, n) => { req.id = randomUUID(); n(); });
  a.use('/api/auth', express.json(), createBackendAuthRouter({ prisma, services }).router);
  return a;
}
async function registerAndCapture(email) {
  const lines = []; const log = console.log, error = console.error;
  console.log = l => lines.push(JSON.parse(String(l))); console.error = l => lines.push(JSON.parse(String(l)));
  let res;
  try {
    res = await request(app(email)).post('/api/auth/register').send({ email: EMAIL, password: 'twelve-chars-ok!', name: 'Otp User', isAdult: true });
    const until = Date.now() + 5000; // delivery runs after the response is sent
    while (Date.now() < until && !lines.some(l => /^auth email (sent|delivery failed)$/.test(l.event))) await new Promise(r => setTimeout(r, 20));
  } finally { console.log = log; console.error = error; }
  return { res, lines };
}
const gmail = fetchImpl => createGmailEmail({ clientId: 'cid', clientSecret: 'cs', refreshToken: 'rt', sender: SENDER, fetchImpl, sleep: async () => {} });

test('expired Gmail refresh token (invalid_grant): user still gets the neutral 202, logs say exactly why', async () => {
  const { res, lines } = await registerAndCapture(gmail(google({ token: { status: 400, body: { error: 'invalid_grant' } } })));
  assert.equal(res.status, 202, 'registration acknowledgement never reveals delivery state');
  const failed = lines.find(l => l.event === 'auth email delivery failed');
  assert.deepEqual({ level: failed.level, code: failed.code, provider: failed.provider }, { level: 'error', code: 'EMAIL_AUTH_INVALID', provider: 'google' });
  assert.match(failed.requestId, /^[0-9a-f-]{36}$/);
  assert.ok(lines.some(l => l.event === 'gmail refresh token invalid'));
  const all = JSON.stringify(lines);
  for (const secret of [EMAIL, SENDER, '424242', 'Otp User', 'fake-access']) assert.ok(!all.includes(secret), `log contains ${secret}`);
});

test('successful Gmail send logs "auth email sent" with provider and request id only', async () => {
  const { res, lines } = await registerAndCapture(gmail(google()));
  assert.equal(res.status, 202);
  const sent = lines.find(l => l.event === 'auth email sent');
  assert.deepEqual(Object.keys(sent).sort(), ['event', 'level', 'provider', 'requestId']);
  assert.ok(!JSON.stringify(lines).includes(EMAIL));
});

test('each delivery failure maps to a specific safe code', async () => {
  const code = async adapter => { try { await adapter.send({ to: EMAIL, subject: 's', text: 't' }); return 'sent'; } catch (e) { return e.reasonCode; } };
  assert.equal(await code(gmail(google({ token: { status: 400, body: { error: 'invalid_grant' } } }))), 'EMAIL_AUTH_INVALID');
  assert.equal(await code(gmail(google({ token: { status: 503 } }))), 'EMAIL_AUTH_UNAVAILABLE');
  assert.equal(await code(gmail(google({ send: { status: 400 } }))), 'EMAIL_REJECTED');
  assert.equal(await code(gmail(google({ send: { status: 429 } }))), 'EMAIL_RATE_LIMITED');
  assert.equal(await code(gmail(async () => { throw new TypeError('offline'); })), 'EMAIL_NETWORK_ERROR');
  assert.equal(await code(createGmailEmail({ fetchImpl: google() })), 'EMAIL_NOT_CONFIGURED');
  const resend = status => createResendEmail({ apiKey: 'k', from: SENDER, fetchImpl: async () => ({ ok: status < 400, status }) });
  assert.equal(await code(resend(403)), 'EMAIL_AUTH_INVALID'); assert.equal(await code(resend(422)), 'EMAIL_REJECTED'); assert.equal(await code(resend(200)), 'sent');
  assert.equal(await code(createResendEmail({})), 'EMAIL_NOT_CONFIGURED');
  assert.equal(await code(createEmailAdapter({ env: { EMAIL_PROVIDER: 'carrier-pigeon' } })), 'EMAIL_NOT_CONFIGURED');
});
