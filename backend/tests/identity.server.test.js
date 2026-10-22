/**
 * Server-level wiring tests against the REAL Express app (all routers). No database queries are
 * made (every request here is answered before any DB access) and no provider is reachable.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { setTestEnv, mintToken, bearer } from './helpers.js';

if (process.env.NODE_ENV === 'production') throw new Error('Refusing to run with NODE_ENV=production');
setTestEnv({
  RATE_LIMIT_AUTH_FAILURES_PER_15MIN: '10000',
  GEMINI_API_KEY: 'test-placeholder-not-a-real-key', GEMINI_API_KEY1: '', GEMINI_API_KEY2: '', GROQ_API_KEY: '',
  GOOGLE_TTS_API_KEY: '', SARVAM_API_KEY: '', MURF_API_KEY: '', HUGGINGFACE_API_KEY: '', OPENAI_API_KEY: '',
  EMAIL_ENABLED: 'false', GMAIL_EMAIL: '', GMAIL_APP_PASSWORD: '', ENABLE_EMERGENCY_ALERTS: 'false',
  RATE_LIMIT_EXCHANGE_PER_15MIN: '1000', RATE_LIMIT_EXCHANGE_FAILURES_PER_15MIN: '1000'
});
// Blank (not delete): server.js runs dotenv.config(), which re-fills DELETED keys from .env but never overrides defined ones.
for (const k of ['FIREBASE_EXCHANGE_ENABLED', 'FIREBASE_PROJECT_ID', 'FIREBASE_SERVICE_ACCOUNT_JSON_BASE64', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY']) process.env[k] = '';

const { buildApp } = await import('../src/server.js');
const app = buildApp();
const send = (body = { idToken: 'a.b.c' }) => request(app).post('/api/auth/firebase/exchange').set('Content-Type', 'application/json').send(body);

describe('exchange route wiring', () => {
  before(() => { delete process.env.FIREBASE_EXCHANGE_ENABLED; });
  after(() => { delete process.env.FIREBASE_EXCHANGE_ENABLED; });

  test('feature flag unset: the route does not exist (404), same as any unknown route', async () => {
    const res = await send();
    assert.equal(res.status, 404);
    assert.deepEqual(res.body, { success: false, error: 'Endpoint not found' });
  });
  test('flag set but Firebase Admin NOT configured: fail closed with a generic 503 (no variable names or values)', async () => {
    process.env.FIREBASE_EXCHANGE_ENABLED = 'true';
    const res = await send({ idToken: 'aaaaaaaaaaaaaaaaaaaaaaaa.bbbbbbbbbbbbbbbbbbbbbb.cccccccccccccccc' });
    assert.equal(res.status, 503);
    assert.equal(res.body.code, 'IDENTITY_UNAVAILABLE');
    assert.ok(!/FIREBASE|credential|project|key/i.test(JSON.stringify(res.body)));
    assert.ok(res.body.requestId);
  });
  test('the route needs no API bearer token and ignores a bogus one', async () => {
    process.env.FIREBASE_EXCHANGE_ENABLED = 'true';
    const res = await request(app).post('/api/auth/firebase/exchange').set('Authorization', 'Bearer garbage').set('Content-Type', 'application/json').send({});
    assert.equal(res.status, 400); // validation, not 401
  });
  test('request bodies are capped at 8kb on this route (not the global 1mb)', async () => {
    process.env.FIREBASE_EXCHANGE_ENABLED = 'true';
    const res = await send({ idToken: 'x'.repeat(20000) });
    assert.equal(res.status, 413);
  });
  test('only the exchange path is public: siblings and other methods are not', async () => {
    process.env.FIREBASE_EXCHANGE_ENABLED = 'true';
    await request(app).post('/api/auth/firebase/anything-else').send({}).expect(404);
    await request(app).post('/api/auth/firebase').send({}).expect(404);
    await request(app).get('/api/auth/firebase/exchange').expect(405);
  });
});

describe('existing and new authenticated routes remain protected', () => {
  for (const path of ['/api/chat/sessions', '/api/journal', '/api/emergency', '/api/insights/daily', '/api/activity', '/api/identity/me', '/api/tts/voices']) {
    test(`GET ${path} without a token -> 401`, async () => {
      const res = await request(app).get(path);
      assert.equal(res.status, 401, path);
      assert.equal(res.body.code, 'UNAUTHENTICATED');
    });
  }
  test('a token with a wrong audience / issuer / secret is rejected on /api/identity/me', async () => {
    await request(app).get('/api/identity/me').set(bearer(await mintToken('u', { aud: 'other' }))).expect(401);
    await request(app).get('/api/identity/me').set(bearer(await mintToken('u', { iss: 'evil' }))).expect(401);
    await request(app).get('/api/identity/me').set(bearer(await mintToken('u', { secret: 'x'.repeat(40) }))).expect(401);
  });
  test('a Firebase-looking ID token is NOT accepted as an API bearer token', async () => {
    const fake = `${Buffer.from('{"alg":"RS256","kid":"k"}').toString('base64url')}.${Buffer.from('{"sub":"u","aud":"p","iss":"https://securetoken.google.com/p"}').toString('base64url')}.c2ln`;
    await request(app).get('/api/identity/me').set(bearer(fake)).expect(401);
    await request(app).get('/api/journal').set(bearer(fake)).expect(401);
  });
});
