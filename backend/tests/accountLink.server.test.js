/**
 * Account-linking wiring tests against the REAL Express app (all routers). Every request here is answered before any
 * database query (flag gate, validation or the Firebase-configuration gate) and no provider is reachable.
 */
import { test, describe, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { setTestEnv, mintToken, bearer } from './helpers.js';

if (process.env.NODE_ENV === 'production') throw new Error('Refusing to run with NODE_ENV=production');
setTestEnv({
  RATE_LIMIT_AUTH_FAILURES_PER_15MIN: '10000',
  GEMINI_API_KEY: 'test-placeholder-not-a-real-key', GEMINI_API_KEY1: '', GEMINI_API_KEY2: '', GROQ_API_KEY: '',
  GOOGLE_TTS_API_KEY: '', SARVAM_API_KEY: '', MURF_API_KEY: '', HUGGINGFACE_API_KEY: '', OPENAI_API_KEY: '',
  EMAIL_ENABLED: 'false', GMAIL_EMAIL: '', GMAIL_APP_PASSWORD: '', ENABLE_EMERGENCY_ALERTS: 'false',
  RATE_LIMIT_LINK_PER_15MIN: '1000', RATE_LIMIT_LINK_FAILURES_PER_15MIN: '1000'
});
// Blank (not delete): server.js runs dotenv.config(), which re-fills DELETED keys from .env but never overrides defined ones.
for (const k of ['ACCOUNT_LINKING_ENABLED', 'FIREBASE_EXCHANGE_ENABLED', 'FIREBASE_PROJECT_ID', 'FIREBASE_SERVICE_ACCOUNT_JSON_BASE64', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY']) process.env[k] = '';

const { buildApp } = await import('../src/server.js');
const app = buildApp();
const ID_TOKEN = 'aaaaaaaaaaaaaaaaaaaaaaaa.bbbbbbbbbbbbbbbbbbbbbb.cccccccccccccccc';
const send = (path, body) => request(app).post(`/api/auth/firebase/link/${path}`).set('Content-Type', 'application/json').send(body);
const START = { idToken: ID_TOKEN, password: 'irrelevant', consent: true };
const COMPLETE = { idToken: ID_TOKEN, challenge: 'A'.repeat(43), consent: true };
const flags = (linking, exchange) => { process.env.ACCOUNT_LINKING_ENABLED = linking; process.env.FIREBASE_EXCHANGE_ENABLED = exchange; };

beforeEach(() => flags('', ''));
after(() => flags('', ''));

describe('feature flag (default off, exact "true" only, requires the exchange flag too)', () => {
  const cases = [['', ''], ['', 'true'], ['true', ''], ['TRUE', 'true'], ['1', 'true'], ['yes', 'true'], ['true ', 'true']];
  for (const [linking, exchange] of cases) {
    test(`ACCOUNT_LINKING_ENABLED=${JSON.stringify(linking)} FIREBASE_EXCHANGE_ENABLED=${JSON.stringify(exchange)} -> 404`, async () => {
      flags(linking, exchange);
      for (const [p, b] of [['start', START], ['complete', COMPLETE]]) {
        const res = await send(p, b);
        assert.equal(res.status, 404, p);
        assert.deepEqual(res.body, { success: false, error: 'Endpoint not found' });
      }
    });
  }
  test('both flags exactly "true" but Firebase Admin not configured -> fail closed 503, nothing leaked', async () => {
    flags('true', 'true');
    for (const [p, b] of [['start', START], ['complete', COMPLETE]]) {
      const res = await send(p, b);
      assert.equal(res.status, 503, p); assert.equal(res.body.code, 'IDENTITY_UNAVAILABLE');
      assert.ok(!/FIREBASE|credential|project|key/i.test(JSON.stringify(res.body)));
    }
  });
});

describe('scoping: a narrow public surface, the authenticated namespace untouched', () => {
  test('enabled: only POST /start and /complete; siblings are 404, other methods 405', async () => {
    flags('true', 'true');
    assert.equal((await request(app).get('/api/auth/firebase/link/start')).status, 405);
    assert.equal((await request(app).post('/api/auth/firebase/link/anything').send({})).status, 404);
    assert.equal((await request(app).post('/api/auth/firebase/link').send({})).status, 404);
  });
  test('body cap is 8kb on these routes (not the global 1mb), and consent is required', async () => {
    flags('true', 'true');
    assert.equal((await send('start', { ...START, password: 'p'.repeat(20000) })).status, 413);
    assert.equal((await send('start', { ...START, consent: false })).body.code, 'CONSENT_REQUIRED');
  });
  test('an API bearer token does not authenticate a link request', async () => {
    flags('true', 'true');
    const res = await request(app).post('/api/auth/firebase/link/start').set(bearer(await mintToken('some-user')))
      .set('Content-Type', 'application/json').send({ password: 'x', consent: true });
    assert.equal(res.status, 400);
  });
  test('/api/identity/* stays fully authenticated (no public link path was added there)', async () => {
    flags('true', 'true');
    for (const p of ['/api/identity/me', '/api/identity/link/start', '/api/identity/link/complete']) {
      const res = await request(app).post(p).set('Content-Type', 'application/json').send(START);
      assert.equal(res.status, 401, p); assert.equal(res.body.code, 'UNAUTHENTICATED');
    }
    assert.equal((await request(app).get('/api/identity/me')).status, 401);
  });
  test('the exchange route keeps its behaviour (still gated by its own flag only)', async () => {
    flags('true', '');
    assert.equal((await request(app).post('/api/auth/firebase/exchange').set('Content-Type', 'application/json').send({ idToken: ID_TOKEN })).status, 404);
    flags('', 'true');
    const res = await request(app).post('/api/auth/firebase/exchange').set('Content-Type', 'application/json').send({ idToken: ID_TOKEN });
    assert.equal(res.status, 503); assert.equal(res.body.code, 'IDENTITY_UNAVAILABLE');
  });
});
