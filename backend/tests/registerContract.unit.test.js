import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import express from 'express';
import request from 'supertest';
import { createBackendAuthRouter, NAME_MAX_LENGTH } from '../src/routes/backendAuthRoutes.js';
import { createPasswordService } from '../src/auth/passwordService.js';
import { readAuthConfig } from '../src/auth/authConfig.js';
import { PASSWORD_MIN_LENGTH_CONTRACT } from '../src/auth/index.js';
import { requestLogger, routeTemplate } from '../src/middleware/requestLogger.js';
import { safeRoute } from '../src/utils/logger.js';

const contract = JSON.parse(fs.readFileSync(new URL('../../contracts/auth-register.json', import.meta.url), 'utf8'));
const EMAIL = 'contract-user@invalid.test', PASSWORD = 'contract-pass-x9q!';

function app() {
  const passwords = createPasswordService({ cost: 4 }); // real rules, default minimum
  const prisma = { user: { create: async ({ data }) => ({ id: 'u1', ...data, emailVerifiedAt: null }), findUnique: async () => null } };
  const services = { passwords, tokens: {}, sessions: {}, challenges: { issue: async () => ({ code: '000000' }) }, email: { send: async () => {} } };
  const a = express();
  a.use((req, res, next) => { req.id = randomUUID(); res.setHeader('X-Request-Id', req.id); next(); });
  a.use(requestLogger);
  a.use('/api/auth', express.json({ limit: '8kb' }), createBackendAuthRouter({ prisma, services }).router);
  return a;
}
async function capture(fn) {
  const lines = []; const log = console.log, error = console.error;
  console.log = l => lines.push(String(l)); console.error = l => lines.push(String(l));
  try { await fn(); await new Promise(r => setImmediate(r)); } finally { console.log = log; console.error = error; }
  return lines.map(l => { try { return JSON.parse(l); } catch { return { unparsable: l }; } });
}
const body = over => ({ email: EMAIL, password: PASSWORD, name: 'Contract User', isAdult: true, ...over });

test('backend limits equal the shared contract (and the website constants checked on the other side)', () => {
  assert.equal(PASSWORD_MIN_LENGTH_CONTRACT, contract.passwordMinLength);
  assert.equal(readAuthConfig({}).passwordMinLength, contract.passwordMinLength, 'AUTH_PASSWORD_MIN_LENGTH default');
  assert.equal(createPasswordService({ cost: 4 }).minLength, contract.passwordMinLength);
  assert.equal(NAME_MAX_LENGTH, contract.nameMaxLength);
  const p = createPasswordService({ cost: 4 });
  assert.equal(p.check('x'.repeat(contract.passwordMinLength - 1)), 'PASSWORD_TOO_SHORT');
  assert.equal(p.check('x'.repeat(contract.passwordMinLength)), null);
  assert.equal(p.check('x'.repeat(contract.passwordMaxBytes + 1)), 'PASSWORD_TOO_LONG');
});

test('the exact body the Next route forwards is accepted; unknown fields are ignored (version skew)', async () => {
  const sample = { email: EMAIL, password: PASSWORD, name: 'Contract User', isAdult: true };
  assert.deepEqual(Object.keys(sample).sort(), Object.keys(contract.nextRouteToBackend).sort());
  for (const [k, type] of Object.entries(contract.nextRouteToBackend)) assert.equal(typeof sample[k], type, k);
  const res = await request(app()).post('/api/auth/register').send(sample);
  assert.equal(res.status, contract.successStatus);
  const skew = await request(app()).post('/api/auth/register').send({ ...sample, futureField: 'x', marketingOptIn: true });
  assert.equal(skew.status, contract.successStatus, 'a newer website sending extra fields must not break an older API');
});

test('each validation failure returns its specific, account-independent code', async () => {
  const cases = [
    [{ isAdult: false }, 'ADULT_CONFIRMATION_REQUIRED'], [{ isAdult: 'true' }, 'ADULT_CONFIRMATION_REQUIRED'], [{ isAdult: undefined }, 'ADULT_CONFIRMATION_REQUIRED'],
    [{ email: 'not-an-email' }, 'INVALID_EMAIL'],
    [{ name: 'n'.repeat(contract.nameMaxLength + 1) }, 'NAME_TOO_LONG'],
    [{ password: 'x'.repeat(contract.passwordMinLength - 2) }, 'PASSWORD_TOO_SHORT'], // the production failure: a 10-character password
    [{ password: 'x'.repeat(contract.passwordMinLength - 1) }, 'PASSWORD_TOO_SHORT'],
    [{ password: undefined }, 'PASSWORD_TOO_SHORT'],
    [{ password: 'é'.repeat(37) }, 'PASSWORD_TOO_LONG']
  ];
  const seen = new Set();
  for (const [over, code] of cases) {
    const res = await request(app()).post('/api/auth/register').send(body(over));
    assert.equal(res.status, contract.validationStatus, code);
    assert.deepEqual(res.body, { error: 'Invalid request', code }, code);
    seen.add(code);
  }
  assert.deepEqual([...seen].sort(), [...contract.errorCodes].sort(), 'every contract code is produced, and no others');
  // Exactly-at-limit values are accepted.
  assert.equal((await request(app()).post('/api/auth/register').send(body({ name: 'n'.repeat(contract.nameMaxLength), password: 'x'.repeat(contract.passwordMinLength) }))).status, 202);
});

test('a rejected register logs event + route + status + code, and never the email or password', async () => {
  const lines = await capture(() => request(app()).post('/api/auth/register').send(body({ password: 'Tr0ub4dor&3' })));
  const rejection = lines.find(l => l.event === 'auth register rejected');
  assert.ok(rejection, 'rejection event logged');
  assert.equal(rejection.route, '/api/auth/register'); assert.equal(rejection.status, 400); assert.equal(rejection.code, 'PASSWORD_TOO_SHORT'); assert.equal(rejection.method, 'POST');
  assert.match(rejection.requestId, /^[0-9a-f-]{36}$/);
  const http = lines.find(l => l.event === 'http request');
  assert.ok(http, 'request line logged');
  assert.deepEqual({ method: http.method, route: http.route, status: http.status, level: http.level }, { method: 'POST', route: '/api/auth/register', status: 400, level: 'warn' });
  assert.equal(http.requestId, rejection.requestId, 'both lines share the request id');
  assert.ok(Number.isInteger(http.durationMs));
  const all = JSON.stringify(lines);
  for (const secret of [EMAIL, 'contract-user', 'Tr0ub4dor&3', 'Contract User']) assert.ok(!all.includes(secret), `log contains ${secret}`);
  assert.ok(lines.every(l => !l.unparsable), 'every line is JSON');
});

test('request lines carry route templates, never raw URLs, ids or emails', async () => {
  const a = express();
  a.use((req, _res, next) => { req.id = randomUUID(); next(); });
  a.use(requestLogger);
  const r = express.Router(); r.get('/journals/:id', (_q, s) => s.sendStatus(204)); a.use('/api/me', r);
  const lines = await capture(async () => {
    await request(a).get('/api/me/journals/0f0e1d2c-aaaa-4bbb-8ccc-123456789abc?email=x@y.invalid');
    await request(a).get('/nowhere/alice@example.invalid');
  });
  const routes = lines.filter(l => l.event === 'http request').map(l => l.route);
  assert.deepEqual(routes, ['/api/me/journals/:id', '/unrouted']);
  assert.ok(!JSON.stringify(lines).includes('0f0e1d2c') && !JSON.stringify(lines).includes('@'));
  assert.equal(routeTemplate({ baseUrl: '/api/auth', route: { path: '/register' } }), '/api/auth/register');
  for (const bad of ['/api/me/journals/0f0e1d2c-aaaa-4bbb-8ccc-123456789abc', '/u/alice@example.invalid', '/x?y=1', '/orders/123456', 'relative']) assert.equal(safeRoute(bad), null, bad);
});
