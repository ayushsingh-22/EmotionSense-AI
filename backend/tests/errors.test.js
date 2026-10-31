import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import util from 'node:util';
import { fileURLToPath } from 'node:url';
import express from 'express';
import request from 'supertest';
import { setTestEnv } from './helpers.js';

setTestEnv();
const { errorHandler, ApiError, asyncHandler } = await import('../src/middleware/errorHandler.js');
const { safePublicMessage, isSafePublicMessage } = await import('../src/utils/publicError.js');
const redaction = await import('../src/utils/logRedaction.js');

const PRISMA_LEAK =
  'Invalid `prisma.user.findUnique()` invocation: Can\'t reach database server at `ep-secret-host-pooler.c-4.neon.tech:5432` ' +
  'postgresql://neondb_owner:SuperSecretPw123@ep-secret-host.neon.tech/neondb?sslmode=require';

const makeApp = () => {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { req.id = 'req-test-1'; next(); });
  app.get('/boom', () => { throw new Error(PRISMA_LEAK); });
  app.get('/boom-async', asyncHandler(async () => { throw new Error(PRISMA_LEAK); }));
  app.get('/api-error-400', () => { throw new ApiError(400, 'Invalid file type. Allowed types: wav, mp3'); });
  app.get('/api-error-500', () => { throw new ApiError(500, PRISMA_LEAK); });
  app.get('/client-404', () => { const e = new Error('Session not found'); e.statusCode = 404; throw e; });
  app.get('/client-400-internal', () => { const e = new Error(PRISMA_LEAK); e.statusCode = 400; throw e; });
  app.post('/echo', (req, res) => res.json(req.body));
  app.use(errorHandler);
  return app;
};

describe('errorHandler never discloses internal error text', () => {
  const app = makeApp();
  const leaks = (body) => /prisma|postgres|neondb|SuperSecretPw|ep-secret|invocation|neon\.tech/i.test(JSON.stringify(body));

  test('unknown/internal errors -> 500 generic + requestId', async () => {
    for (const p of ['/boom', '/boom-async']) {
      const r = await request(app).get(p).expect(500);
      assert.equal(r.body.error, 'Internal server error');
      assert.equal(r.body.requestId, 'req-test-1');
      assert.equal(r.body.success, false);
      assert.ok(!leaks(r.body), `leak in ${p}: ${JSON.stringify(r.body)}`);
      assert.equal(r.body.stack, undefined);
    }
  });
  test('ApiError 4xx keeps its deliberate user-facing message', async () => {
    const r = await request(app).get('/api-error-400').expect(400);
    assert.equal(r.body.error, 'Invalid file type. Allowed types: wav, mp3');
  });
  test('ApiError 5xx is still generic', async () => {
    const r = await request(app).get('/api-error-500').expect(500);
    assert.equal(r.body.error, 'Internal server error');
    assert.ok(!leaks(r.body));
  });
  test('4xx with an allow-listed message passes through; with internal text it is replaced', async () => {
    assert.equal((await request(app).get('/client-404').expect(404)).body.error, 'Session not found');
    const r = await request(app).get('/client-400-internal').expect(400);
    assert.equal(r.body.error, 'Bad request');
    assert.ok(!leaks(r.body));
  });
  test('malformed JSON -> 400 without echoing the payload or parser internals', async () => {
    const r = await request(app).post('/echo').set('Content-Type', 'application/json').send('{"a": SECRET_TOKEN_123,').expect(400);
    assert.equal(r.body.error, 'Invalid JSON in request body');
    assert.ok(!JSON.stringify(r.body).includes('SECRET_TOKEN_123'));
  });
  test('stack traces are only returned with NODE_ENV=development AND EXPOSE_ERROR_DETAILS=true', async () => {
    process.env.EXPOSE_ERROR_DETAILS = 'true';
    const r = await request(app).get('/boom').expect(500); // NODE_ENV=test -> still no stack
    assert.equal(r.body.stack, undefined);
    delete process.env.EXPOSE_ERROR_DETAILS;
  });
});

describe('server log lines are redacted end-to-end', () => {
  test('console.error from the error handler never writes the connection string or password', async () => {
    redaction.installLogRedaction();
    const captured = [];
    const realWrite = process.stderr.write.bind(process.stderr);
    process.stderr.write = (chunk, ...rest) => { captured.push(String(chunk)); return true; };
    try {
      await request(makeApp()).get('/boom').expect(500);
    } finally {
      process.stderr.write = realWrite;
    }
    const logged = captured.join('');
    assert.ok(!/findUnique|invocation|Can\'t reach database/.test(logged), 'arbitrary diagnostic text is omitted');
    assert.ok(!logged.includes('SuperSecretPw123'), 'password must not be logged');
    assert.ok(!/neondb_owner:/.test(logged), 'connection string credentials must not be logged');
  });
});

describe('safePublicMessage allow-list', () => {
  test('allows deliberate validation messages only', () => {
    for (const m of ['user_id is required', 'user_id and session_id are required', 'user_id, startDate, and endDate are required',
      'Session not found', 'Activity not found', 'No updatable fields provided', 'Invalid role. Must be one of: user, assistant',
      'No chat messages found for 2025-01-01']) assert.ok(isSafePublicMessage(m), m);
    for (const m of [PRISMA_LEAK, 'connect ECONNREFUSED 10.0.0.1:5432', 'Unique constraint failed on the fields: (`email`)',
      "Cannot read properties of undefined (reading 'id')", '', undefined, 'x'.repeat(400)]) assert.ok(!isSafePublicMessage(m), String(m).slice(0, 40));
  });
  test('falls back for everything else', () => {
    assert.equal(safePublicMessage(new Error(PRISMA_LEAK), 'Invalid request'), 'Invalid request');
    assert.equal(safePublicMessage(new Error('Session not found'), 'x'), 'Session not found');
    assert.equal(safePublicMessage(null, 'fb'), 'fb');
  });
});

describe('log redaction keeps diagnostics but strips secrets', () => {
  test('pattern-based: connection strings, bearer tokens, key params, JWTs, provider keys', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyIn0.abcdefghijklmnop';
    const dirty = [
      'failed postgresql://neondb_owner:SuperSecretPw123@ep-x.neon.tech/neondb?sslmode=require',
      'Authorization: Bearer abcdef1234567890abcdef',
      'GET https://api.example.com/v1/models?key=AIzaSyA1234567890123456789012345678901&alt=json',
      `token ${jwt}`, 'gsk_abcdefghijklmnopqrstuvwxyz0123', 'sk-abcdefghijklmnopqrstuvwxyz012345'
    ].join('\n');
    const clean = redaction.redact(dirty);
    for (const secret of ['SuperSecretPw123', 'abcdef1234567890abcdef', 'AIzaSyA1234567890123456789012345678901', jwt,
      'gsk_abcdefghijklmnopqrstuvwxyz0123', 'sk-abcdefghijklmnopqrstuvwxyz012345']) {
      assert.ok(!clean.includes(secret), `still contains ${secret.slice(0, 12)}…`);
    }
    assert.ok(clean.includes('failed'), 'diagnostic context is preserved');
  });
  test('value-based: any configured secret env value is removed, even inside a nested error object', () => {
    process.env.TEST_PROVIDER_API_KEY = 'plain-looking-secret-value-42';
    redaction.refreshSecrets();
    const axiosLikeError = Object.assign(new Error('Request failed with status code 401'), {
      config: { url: 'https://provider.example/v1', headers: { 'x-api-key': 'plain-looking-secret-value-42' } }
    });
    const text = redaction.redact(util.inspect(axiosLikeError, { depth: 4 }));
    assert.ok(!text.includes('plain-looking-secret-value-42'));
    assert.ok(text.includes('Request failed with status code 401'), 'message preserved');
    delete process.env.TEST_PROVIDER_API_KEY;
    redaction.refreshSecrets();
  });
  test('non-secret env values are not treated as secrets', () => {
    process.env.PUBLIC_LABEL = 'hello-world-label';
    redaction.refreshSecrets();
    assert.equal(redaction.redact('say hello-world-label'), 'say hello-world-label');
    delete process.env.PUBLIC_LABEL;
  });
});

describe('static guard: route handlers must not put raw error text into responses', () => {
  const routesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'routes');
  const files = fs.readdirSync(routesDir).filter((f) => f.endsWith('.js') && !f.includes('_old'));
  const FORBIDDEN = [
    /(details|error|message)\s*:\s*(error|err|e)\.(message|stack)\b/,
    /\$\{\s*(error|err|e)\.(message|stack)\s*\}[^\n]*(res\.|json|send)/,
    /groqError|sarvamError\.message|transcriptionResult\.error\s*$/m
  ];
  for (const file of files) {
    test(`${file} has no raw error.message / provider error in responses`, () => {
      const lines = fs.readFileSync(path.join(routesDir, file), 'utf8').split('\n');
      const offenders = lines
        .map((l, i) => ({ l, n: i + 1 }))
        .filter(({ l }) => !/console\.|logger\.|safeLog\./.test(l) && FORBIDDEN.some((re) => re.test(l)));
      assert.deepEqual(offenders, [], `raw error text in response at: ${offenders.map((o) => `${file}:${o.n}`).join(', ')}`);
    });
  }
});
