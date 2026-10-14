import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import { setTestEnv } from './helpers.js';

setTestEnv();
const sec = await import('../src/middleware/security.js');
const schemas = await import('../src/middleware/schemas.js');

describe('CORS', () => {
  const app = express();
  app.use(sec.buildCors('https://app.example.test,https://mantra-*-team.vercel.app'));
  app.get('/x', (req, res) => res.json({ ok: true }));
  const acao = (origin) =>
    request(app).get('/x').set('Origin', origin).then((r) => r.headers['access-control-allow-origin']);

  test('allows listed origins, reflects exactly', async () => {
    assert.equal(await acao('https://app.example.test'), 'https://app.example.test');
  });
  test('blocks unlisted origins (no ACAO header, no 500)', async () => {
    const r = await request(app).get('/x').set('Origin', 'https://evil.test');
    assert.equal(r.status, 200);
    assert.equal(r.headers['access-control-allow-origin'], undefined);
  });
  test('wildcard matches a single DNS label only', async () => {
    assert.equal(await acao('https://mantra-pr12-team.vercel.app'), 'https://mantra-pr12-team.vercel.app');
    assert.equal(await acao('https://mantra-x.evil.test-team.vercel.app'), undefined);
    assert.equal(await acao('https://mantra-a.b-team.vercel.app'), undefined);
  });
  test('preflight for a blocked origin yields no allow headers', async () => {
    const r = await request(app).options('/x')
      .set('Origin', 'https://evil.test').set('Access-Control-Request-Method', 'POST');
    assert.equal(r.headers['access-control-allow-origin'], undefined);
  });
  test('no Origin header (Android/server) is not blocked by CORS', async () => {
    await request(app).get('/x').expect(200);
  });
  test('credentials are not enabled', async () => {
    const r = await request(app).get('/x').set('Origin', 'https://app.example.test');
    assert.equal(r.headers['access-control-allow-credentials'], undefined);
  });
  test('"*" is never honoured; production + empty list = no cross-origin', () => {
    assert.deepEqual(sec.parseAllowedOrigins('*', 'production'), []);
    assert.deepEqual(sec.parseAllowedOrigins('', 'production'), []);
    assert.ok(sec.parseAllowedOrigins('', 'development').length > 0);
  });
});

describe('Security headers', () => {
  test('helmet headers present, no x-powered-by', async () => {
    const app = express();
    app.disable('x-powered-by');
    app.use(sec.securityHeaders());
    app.get('/x', (req, res) => res.json({}));
    const r = await request(app).get('/x');
    assert.equal(r.headers['x-content-type-options'], 'nosniff');
    assert.equal(r.headers['referrer-policy'], 'no-referrer');
    assert.match(r.headers['content-security-policy'], /default-src 'none'/);
    assert.equal(r.headers['x-powered-by'], undefined);
  });
});

describe('Rate limiting', () => {
  test('per-user AI burst limiter returns 429 and isolates users', async () => {
    process.env.RATE_LIMIT_AI_PER_MIN = '3';
    const app = express();
    app.use((req, res, next) => { req.userId = req.headers['x-test-user']; next(); });
    app.use(sec.aiBurstLimiter());
    app.get('/ai', (req, res) => res.json({ ok: true }));
    for (let i = 0; i < 3; i++) await request(app).get('/ai').set('x-test-user', 'a').expect(200);
    const blocked = await request(app).get('/ai').set('x-test-user', 'a').expect(429);
    assert.equal(blocked.body.code, 'RATE_LIMITED');
    await request(app).get('/ai').set('x-test-user', 'b').expect(200);
    delete process.env.RATE_LIMIT_AI_PER_MIN;
  });

  test('auth-failure limiter counts only failures', async () => {
    process.env.RATE_LIMIT_AUTH_FAILURES_PER_15MIN = '2';
    const app = express();
    app.use(sec.authFailureLimiter());
    app.get('/a', (req, res) => (req.headers['x-ok'] ? res.json({}) : res.status(401).json({})));
    for (let i = 0; i < 5; i++) await request(app).get('/a').set('x-ok', '1').expect(200);
    await request(app).get('/a').expect(401);
    await request(app).get('/a').expect(401);
    await request(app).get('/a').expect(429);
    delete process.env.RATE_LIMIT_AUTH_FAILURES_PER_15MIN;
  });
});

describe('Validation', () => {
  const app = express();
  app.use(express.json());
  app.post('/chat', sec.validate({ body: schemas.chatMessageBody }), (req, res) => res.json(req.body));
  app.post('/tts', sec.validate({ body: schemas.ttsBody }), (req, res) => res.json(req.body));
  app.post('/emerg', sec.validate({ body: schemas.emergencyContactBody }), (req, res) => res.json(req.body));
  app.get('/d/:date', sec.validate({ params: schemas.dateParams }), (req, res) => res.json(req.params));
  app.get('/l', sec.validate({ query: schemas.limitQuery }), (req, res) => res.json(req.query));

  test('chat message: required, string, bounded', async () => {
    await request(app).post('/chat').send({}).expect(400);
    await request(app).post('/chat').send({ message: 123 }).expect(400);
    await request(app).post('/chat').send({ message: '   ' }).expect(400);
    await request(app).post('/chat').send({ message: 'x'.repeat(5001) }).expect(400);
    await request(app).post('/chat').send({ message: 'hi', sessionId: 'x'.repeat(65) }).expect(400);
    const ok = await request(app).post('/chat')
      .send({ message: 'hi', includeAudio: false, memoryLength: 10, extra: 1 }).expect(200);
    assert.equal(ok.body.extra, 1); // legacy clients sending extra fields keep working
  });
  test('tts text bounded (cost control)', async () => {
    await request(app).post('/tts').send({ text: 'x'.repeat(5001) }).expect(400);
    await request(app).post('/tts').send({ text: 'hello' }).expect(200);
  });
  test('emergency contact: email format and lengths', async () => {
    await request(app).post('/emerg').send({ contactName: 'A', contactEmail: 'nope' }).expect(400);
    await request(app).post('/emerg')
      .send({ contactName: 'A', contactEmail: 'a@b.co', contactPhone: '1'.repeat(40) }).expect(400);
    await request(app).post('/emerg').send({ contactName: 'A', contactEmail: 'a@b.co' }).expect(200);
  });
  test('date and limit params', async () => {
    await request(app).get('/d/2024-13-99x').expect(400);
    await request(app).get('/d/2024-05-01').expect(200);
    await request(app).get('/l?limit=100000').expect(400);
    await request(app).get('/l?limit=abc').expect(400);
    await request(app).get('/l?limit=50').expect(200);
  });
  test('error responses carry field paths, not stack traces', async () => {
    const r = await request(app).post('/chat').send({}).expect(400);
    assert.equal(r.body.code, 'VALIDATION_FAILED');
    assert.ok(!JSON.stringify(r.body).includes('node_modules'));
  });
});
