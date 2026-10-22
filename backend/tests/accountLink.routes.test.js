/**
 * POST /api/auth/firebase/link/start + /complete: HTTP-contract and security tests (Phase 2B.5B.2).
 * Real router, real link service, real bcrypt and real API-token minting; Firebase verification is MOCKED and the
 * database is the in-memory FakeLinkDb. No database, no network, no Firebase.
 */
import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { jwtVerify } from 'jose';
import { setTestEnv, TEST_SECRET, mintToken, bearer } from './helpers.js';
import { FakeLinkDb } from './fakeLinkDb.js';

setTestEnv({ NODE_ENV: 'test' });
const { requireAuth, bindUserId, mintApiToken } = await import('../src/middleware/auth.js');
const { errorHandler } = await import('../src/middleware/errorHandler.js');
const { createAccountLinkRouter } = await import('../src/routes/accountLinkRoutes.js');
const { createFirebaseExchangeRouter } = await import('../src/routes/identityRoutes.js');
const { TokenRejected, VerifierUnavailable } = await import('../src/identity/firebaseVerifier.js');
const { startLink, completeLink } = await import('../src/identity/linkService.js');
const { resolveFirebaseIdentity } = await import('../src/identity/identityService.js');

const PROJECT = 'mantra-test-project';
const PASSWORD = 'Sup3r-Secret-Web-Password!';
const HASH = bcrypt.hashSync(PASSWORD, 4);
const CANONICAL = 'canonical-web-user-id-0001';
const EMAIL = 'private.owner@example.invalid';
const UID = 'firebase-uid-SECRET-XYZ789';
// Token strings the mocked verifier understands; long enough for the schema, never real tokens.
const T = (name) => `test-id-token-${name}-${'x'.repeat(24)}`;

let db; let nowMs; let tokens; let calls;
const claimsFor = (o = {}) => ({ uid: UID, projectId: PROJECT, email: EMAIL, emailVerified: true, signInProvider: 'google.com', authTime: Math.floor(nowMs / 1000) - 20, name: null, picture: null, ...o });

const makeDeps = (over = {}) => {
  const store = db.store();
  return {
    isEnabled: () => true,
    isConfigured: () => true,
    isReady: async () => { calls.ready += 1; return true; },
    verifyToken: async (t) => {
      calls.verify += 1;
      const v = tokens[t];
      if (!v) throw new TokenRejected('auth/argument-error');
      if (v instanceof Error) throw v;
      return v;
    },
    startLink: (c, e, p) => { calls.start += 1; return startLink(store, c, e, p); },
    completeLink: (c, e, ch) => { calls.complete += 1; return completeLink(store, c, e, ch); },
    mintToken: mintApiToken,
    now: () => nowMs,
    ...over
  };
};
const makeApp = (deps = makeDeps(), limits) => {
  const app = express();
  app.set('trust proxy', 1);
  app.use((req, res, next) => { req.id = 'req-link-test'; next(); });
  app.use('/api/auth/firebase/link', createAccountLinkRouter(deps, limits));
  app.use('/api/auth/firebase/exchange', createFirebaseExchangeRouter({
    isEnabled: () => true, isConfigured: () => true, isReady: async () => true,
    verifyToken: deps.verifyToken, resolveIdentity: (c) => resolveFirebaseIdentity(db.prisma(), c), mintToken: mintApiToken
  }));
  const who = express.Router();
  who.get('/who', (req, res) => res.json({ userId: req.userId }));
  app.use('/api/identity', express.json(), requireAuth, bindUserId, who);
  app.use(errorHandler);
  return app;
};
const post = (app, path, body, ip = '203.0.113.10') => request(app).post(`/api/auth/firebase/link/${path}`)
  .set('X-Forwarded-For', ip).set('Content-Type', 'application/json').send(body);
const startBody = (o = {}) => ({ idToken: T('good'), password: PASSWORD, consent: true, ...o });
const completeBody = (challenge, o = {}) => ({ idToken: T('good'), challenge, consent: true, ...o });

let logged = [];
const orig = {};
before(() => { for (const k of ['log', 'warn', 'error']) { orig[k] = console[k]; console[k] = (...a) => { logged.push(a.map(String).join(' ')); }; } });
after(() => { for (const k of ['log', 'warn', 'error']) console[k] = orig[k]; });

beforeEach(() => {
  db = new FakeLinkDb();
  nowMs = db.nowMs;
  db.addUser({ id: CANONICAL, email: 'Private.Owner@example.invalid', passwordHash: HASH, fullName: 'Owner' });
  tokens = { [T('good')]: claimsFor() };
  calls = { ready: 0, verify: 0, start: 0, complete: 0 };
});

describe('feature flag and availability', () => {
  test('disabled: both routes are a plain 404 and nothing runs', async () => {
    const app = makeApp(makeDeps({ isEnabled: () => false }));
    for (const p of ['start', 'complete']) {
      const res = await post(app, p, startBody());
      assert.equal(res.status, 404);
      assert.deepEqual(res.body, { success: false, error: 'Endpoint not found' });
    }
    assert.deepEqual(calls, { ready: 0, verify: 0, start: 0, complete: 0 });
    assert.equal(db.state.challenges.length, 0);
  });
  test('Firebase Admin not configured -> 503 generic; schema missing -> 503, Firebase never called', async () => {
    let res = await post(makeApp(makeDeps({ isConfigured: () => false })), 'start', startBody());
    assert.equal(res.status, 503); assert.equal(res.body.code, 'IDENTITY_UNAVAILABLE');
    res = await post(makeApp(makeDeps({ isReady: async () => false })), 'start', startBody());
    assert.equal(res.status, 503); assert.equal(calls.verify, 0);
  });
  test('Firebase outage -> 503 (not a client fault)', async () => {
    tokens[T('good')] = new VerifierUnavailable('timeout');
    const res = await post(makeApp(), 'start', startBody());
    assert.equal(res.status, 503); assert.equal(res.body.code, 'IDENTITY_UNAVAILABLE');
  });
  test('only POST /start and POST /complete exist; everything else is 404/405 and never reaches other routers', async () => {
    const app = makeApp();
    assert.equal((await request(app).get('/api/auth/firebase/link/start')).status, 405);
    assert.equal((await post(app, 'other', {})).status, 404);
    assert.equal((await request(app).post('/api/auth/firebase/link').send({})).status, 404);
    assert.equal((await post(app, 'start/', startBody())).status, 201, 'trailing slash tolerated');
  });
});

describe('end-to-end: ACCOUNT_LINK_REQUIRED -> start -> complete -> exchange', () => {
  test('links to the ORIGINAL canonical id, returns a normal API token, and the exchange then resolves it', async () => {
    const app = makeApp();
    const ex1 = await request(app).post('/api/auth/firebase/exchange').set('Content-Type', 'application/json').send({ idToken: T('good') });
    assert.equal(ex1.status, 409); assert.equal(ex1.body.code, 'ACCOUNT_LINK_REQUIRED');

    const s = await post(app, 'start', startBody());
    assert.equal(s.status, 201);
    assert.deepEqual(Object.keys(s.body).sort(), ['challenge', 'expiresAt', 'expiresIn', 'success']);
    assert.equal(s.body.expiresIn, 300);
    assert.equal(s.body.expiresAt, nowMs + 300_000);
    assert.equal(s.headers['cache-control'], 'no-store');
    assert.ok(!('token' in s.body), 'no API token before the link is committed');

    const c = await post(app, 'complete', completeBody(s.body.challenge));
    assert.equal(c.status, 200);
    assert.equal(c.body.linked, true); assert.equal(c.body.tokenType, 'Bearer'); assert.equal(c.body.expiresIn, 300);
    assert.deepEqual(c.body.user, { id: CANONICAL, email: 'Private.Owner@example.invalid', fullName: 'Owner', avatarUrl: null });
    const { payload, protectedHeader } = await jwtVerify(c.body.token, new TextEncoder().encode(TEST_SECRET), { issuer: 'mantra-web', audience: 'mantra-api' });
    assert.equal(protectedHeader.alg, 'HS256'); assert.equal(payload.sub, CANONICAL); assert.ok(payload.exp - payload.iat <= 300);
    assert.equal((await request(app).get('/api/identity/who').set(bearer(c.body.token))).body.userId, CANONICAL);

    const ex2 = await request(app).post('/api/auth/firebase/exchange').set('Content-Type', 'application/json').send({ idToken: T('good') });
    assert.equal(ex2.status, 200); assert.equal(ex2.body.user.id, CANONICAL); assert.equal(ex2.body.provisioned, false);
    assert.equal(db.state.users.length, 1, 'no duplicate canonical user');
    assert.equal(db.state.users[0].passwordHash, HASH, 'web password unchanged');
    assert.ok(!JSON.stringify([s.body, c.body]).includes(UID), 'provider subject never returned');
  });
  test('replay of the completion -> 400 LINK_CHALLENGE_INVALID; client recovers via the exchange', async () => {
    const app = makeApp();
    const { challenge } = (await post(app, 'start', startBody())).body;
    assert.equal((await post(app, 'complete', completeBody(challenge))).status, 200);
    const again = await post(app, 'complete', completeBody(challenge));
    assert.equal(again.status, 400); assert.equal(again.body.code, 'LINK_CHALLENGE_INVALID');
    assert.equal(db.state.identities.length, 1);
  });
  test('concurrent HTTP completions of one challenge: exactly one 200', async () => {
    const app = makeApp();
    const { challenge } = (await post(app, 'start', startBody())).body;
    const res = await Promise.all(Array.from({ length: 6 }, () => post(app, 'complete', completeBody(challenge))));
    assert.deepEqual(res.map((r) => r.status).sort(), [200, 400, 400, 400, 400, 400]);
    assert.equal(db.state.identities.length, 1);
  });
  test('expired challenge -> 400', async () => {
    const app = makeApp();
    const { challenge } = (await post(app, 'start', startBody())).body;
    db.advance(301); nowMs = db.nowMs;
    tokens[T('good')] = claimsFor();
    assert.equal((await post(app, 'complete', completeBody(challenge))).body.code, 'LINK_CHALLENGE_INVALID');
  });
  test('cross-account: another verified Firebase user cannot complete my challenge', async () => {
    const app = makeApp();
    const { challenge } = (await post(app, 'start', startBody())).body;
    tokens[T('attacker')] = claimsFor({ uid: 'attacker-uid', email: 'attacker@example.invalid' });
    const res = await post(app, 'complete', completeBody(challenge, { idToken: T('attacker') }));
    assert.equal(res.status, 400); assert.equal(db.state.identities.length, 0);
  });
});

describe('input validation and consent', () => {
  test('consent missing, false or not the boolean true -> 400 CONSENT_REQUIRED before Firebase is called', async () => {
    const app = makeApp();
    for (const consent of [undefined, false, 'true', 1, null]) {
      const res = await post(app, 'start', startBody({ consent }));
      assert.equal(res.status, 400); assert.equal(res.body.code, 'CONSENT_REQUIRED');
      const res2 = await post(app, 'complete', completeBody('A'.repeat(43), { consent }));
      assert.equal(res2.body.code, 'CONSENT_REQUIRED');
    }
    assert.equal(calls.verify, 0);
  });
  test('client-supplied identity fields are REJECTED, not ignored (strict schema)', async () => {
    const app = makeApp();
    for (const extra of [{ userId: CANONICAL }, { uid: UID }, { firebaseUid: UID }, { projectId: PROJECT }, { emailVerified: true }, { email: EMAIL }]) {
      const res = await post(app, 'start', startBody(extra));
      assert.equal(res.status, 400, JSON.stringify(Object.keys(extra))); assert.equal(res.body.code, 'VALIDATION_FAILED');
    }
    assert.equal(calls.verify, 0);
  });
  test('bad field types/sizes -> 400 without echoing values; wrong content type -> 415; > 8kb -> 413', async () => {
    const app = makeApp();
    let res = await post(app, 'start', startBody({ password: '' }));
    assert.equal(res.status, 400); assert.ok(!JSON.stringify(res.body).includes('details'));
    res = await post(app, 'start', startBody({ password: 'p'.repeat(1025) }));
    assert.equal(res.status, 400);
    res = await post(app, 'complete', completeBody('short'));
    assert.equal(res.status, 400); assert.equal(res.body.code, 'VALIDATION_FAILED');
    res = await request(app).post('/api/auth/firebase/link/start').set('Content-Type', 'text/plain').send('x');
    assert.equal(res.status, 415);
    res = await post(app, 'start', startBody({ password: 'p'.repeat(9000) }));
    assert.equal(res.status, 413);
    res = await request(app).post('/api/auth/firebase/link/start').set('Content-Type', 'application/json').send('[1,2]');
    assert.equal(res.status, 400);
  });
  test('an API bearer token is not a substitute for the Firebase proof', async () => {
    const res = await request(app2()).post('/api/auth/firebase/link/start').set(bearer(await mintToken(CANONICAL)))
      .set('Content-Type', 'application/json').send({ password: PASSWORD, consent: true });
    assert.equal(res.status, 400);
    assert.equal(calls.start, 0);
  });
});
const app2 = () => makeApp();

describe('Firebase proof', () => {
  test('rejected tokens (expired, revoked, wrong project, disabled user, garbage) -> one uniform 401', async () => {
    const app = makeApp();
    const bodies = [];
    for (const reason of ['auth/id-token-expired', 'auth/id-token-revoked', 'wrong-project', 'auth/user-disabled', 'malformed']) {
      tokens[T(reason)] = new TokenRejected(reason);
      const res = await post(app, 'start', startBody({ idToken: T(reason) }));
      assert.equal(res.status, 401); bodies.push(res.body);
    }
    assert.ok(bodies.every((b) => b.code === 'INVALID_FIREBASE_TOKEN' && b.error === bodies[0].error));
    assert.equal(calls.start, 0);
  });
  test('unverified e-mail -> 403 EMAIL_NOT_VERIFIED; unsupported method -> 403; stale sign-in -> 401 REAUTHENTICATION_REQUIRED', async () => {
    const app = makeApp();
    tokens[T('unverified')] = claimsFor({ emailVerified: false });
    tokens[T('anon')] = claimsFor({ signInProvider: 'anonymous' });
    tokens[T('stale')] = claimsFor({ authTime: Math.floor(nowMs / 1000) - 3600 });
    assert.equal((await post(app, 'start', startBody({ idToken: T('unverified') }))).body.code, 'EMAIL_NOT_VERIFIED');
    assert.equal((await post(app, 'start', startBody({ idToken: T('anon') }))).body.code, 'UNSUPPORTED_SIGN_IN_METHOD');
    const stale = await post(app, 'start', startBody({ idToken: T('stale') }));
    assert.equal(stale.status, 401); assert.equal(stale.body.code, 'REAUTHENTICATION_REQUIRED');
    assert.equal(calls.start, 0);
  });
  test('completion also requires a FRESH sign-in (freshness re-checked at step 2)', async () => {
    const app = makeApp();
    const { challenge } = (await post(app, 'start', startBody())).body;
    tokens[T('good')] = claimsFor({ authTime: Math.floor(nowMs / 1000) - 3600 });
    const res = await post(app, 'complete', completeBody(challenge));
    assert.equal(res.body.code, 'REAUTHENTICATION_REQUIRED');
    assert.equal(db.state.identities.length, 0);
  });
});

describe('web-account proof and enumeration resistance', () => {
  test('wrong password, unknown account and password-less account are indistinguishable', async () => {
    const app = makeApp();
    db.addUser({ email: 'firebase-only@example.invalid', passwordHash: null });
    tokens[T('nouser')] = claimsFor({ uid: 'u2', email: 'nobody@example.invalid' });
    tokens[T('nopw')] = claimsFor({ uid: 'u3', email: 'firebase-only@example.invalid' });
    const a = await post(app, 'start', startBody({ password: 'wrong' }));
    const b = await post(app, 'start', startBody({ idToken: T('nouser') }));
    const c = await post(app, 'start', startBody({ idToken: T('nopw') }));
    for (const r of [a, b, c]) { assert.equal(r.status, 401); assert.deepEqual(r.body, a.body); assert.equal(r.body.code, 'LINK_PROOF_FAILED'); }
    assert.equal(db.state.challenges.length, 0);
  });
  test('identity already linked (to any account) -> 409 IDENTITY_ALREADY_LINKED; disabled -> 403', async () => {
    const app = makeApp();
    db.addIdentity({ userId: CANONICAL, project: PROJECT, sub: UID });
    assert.equal((await post(app, 'start', startBody())).body.code, 'IDENTITY_ALREADY_LINKED');
    tokens[T('dis')] = claimsFor({ uid: 'disabled-uid' });
    db.addIdentity({ userId: CANONICAL, project: PROJECT, sub: 'disabled-uid', disabledAt: new Date() });
    assert.equal((await post(app, 'start', startBody({ idToken: T('dis') }))).body.code, 'IDENTITY_DISABLED');
  });
});

describe('rate limiting', () => {
  test('per-account password failures: locked after the budget even with the right password; other accounts unaffected', async () => {
    const app = makeApp(makeDeps(), { passwordFailuresPer15Min: 3, ipPer15Min: 1000, failuresPer15Min: 1000, uidPer15Min: 1000 });
    for (let i = 0; i < 3; i += 1) assert.equal((await post(app, 'start', startBody({ password: `wrong-${i}` }))).status, 401);
    const locked = await post(app, 'start', startBody());
    assert.equal(locked.status, 429); assert.equal(locked.body.code, 'RATE_LIMITED'); assert.ok(locked.headers['retry-after']);
    assert.equal(calls.start, 3, 'no password check while locked');
    db.addUser({ email: 'second@example.invalid', passwordHash: HASH });
    tokens[T('second')] = claimsFor({ uid: 'second-uid', email: 'second@example.invalid' });
    assert.equal((await post(app, 'start', startBody({ idToken: T('second') }))).status, 201);
  });
  test('per Firebase identity', async () => {
    const app = makeApp(makeDeps(), { uidPer15Min: 2, ipPer15Min: 1000, failuresPer15Min: 1000 });
    assert.equal((await post(app, 'start', startBody(), '198.51.100.1')).status, 201);
    assert.equal((await post(app, 'start', startBody(), '198.51.100.2')).status, 201);
    assert.equal((await post(app, 'start', startBody(), '198.51.100.3')).status, 429);
  });
  test('per IP (all requests) and per IP (failures)', async () => {
    let app = makeApp(makeDeps(), { ipPer15Min: 2, failuresPer15Min: 1000, uidPer15Min: 1000 });
    await post(app, 'start', startBody()); await post(app, 'start', startBody());
    assert.equal((await post(app, 'start', startBody())).status, 429);
    app = makeApp(makeDeps(), { ipPer15Min: 1000, failuresPer15Min: 2, uidPer15Min: 1000, passwordFailuresPer15Min: 1000 });
    await post(app, 'complete', completeBody('B'.repeat(43))); await post(app, 'complete', completeBody('C'.repeat(43)));
    assert.equal((await post(app, 'complete', completeBody('D'.repeat(43)))).status, 429);
    assert.equal((await post(app, 'start', startBody(), '192.0.2.99')).status, 201, 'other IPs unaffected');
  });
});

describe('errors and logging', () => {
  test('unexpected failures -> generic 500 with request id, no internal text', async () => {
    const app = makeApp(makeDeps({ completeLink: async () => { throw new Error('relation "auth_identities" secret detail'); } }));
    const res = await post(app, 'complete', completeBody('E'.repeat(43)));
    assert.equal(res.status, 500);
    assert.deepEqual(res.body, { success: false, error: 'Internal server error', requestId: 'req-link-test' });
  });
  test('nothing sensitive is ever logged across the whole flow', async () => {
    logged = [];
    const app = makeApp();
    await post(app, 'start', startBody({ password: 'wrong-password-value' }));
    const { challenge } = (await post(app, 'start', startBody())).body;
    await post(app, 'complete', completeBody(challenge));
    await post(app, 'complete', completeBody(challenge));
    const text = logged.join('\n');
    assert.ok(text.includes('req-link-test'), 'request ids are logged');
    for (const secret of [PASSWORD, 'wrong-password-value', challenge, T('good'), UID, EMAIL, 'Private.Owner', HASH, CANONICAL]) {
      assert.ok(!text.includes(secret), `log leaked ${secret.slice(0, 6)}...`);
    }
  });
});
