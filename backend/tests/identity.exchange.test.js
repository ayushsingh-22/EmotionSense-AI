/**
 * POST /api/auth/firebase/exchange and GET /api/identity/me: HTTP-contract tests with MOCKED
 * Firebase verification and identity resolution. No database, no network, no Firebase.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import { jwtVerify } from 'jose';
import { setTestEnv, mintToken, bearer, TEST_SECRET } from './helpers.js';

setTestEnv({ NODE_ENV: 'test' });
const { requireAuth, bindUserId, mintApiToken } = await import('../src/middleware/auth.js');
const { errorHandler } = await import('../src/middleware/errorHandler.js');
const { createFirebaseExchangeRouter, createIdentityMeRouter } = await import('../src/routes/identityRoutes.js');
const { TokenRejected, VerifierUnavailable } = await import('../src/identity/firebaseVerifier.js');

const CANONICAL = '11111111-2222-4333-8444-555555555555';
const FB_UID = 'firebase-uid-SECRET-ABC123';
const EMAIL = 'private.person@example.invalid';
const ID_TOKEN = `${Buffer.from('{"alg":"RS256","kid":"k"}').toString('base64url')}.${Buffer.from('{"sub":"x"}').toString('base64url')}.c2lnbmF0dXJlLXNpZ25hdHVyZQ`;

const claims = (over = {}) => ({ uid: FB_UID, projectId: 'mantra-test-project', email: EMAIL, emailVerified: true, signInProvider: 'google.com', name: 'P', picture: null, ...over });

const makeDeps = (over = {}) => {
  const calls = { verify: [], resolve: [], ready: 0 };
  const deps = {
    isEnabled: () => true,
    isConfigured: () => true,
    isReady: async () => { calls.ready += 1; return true; },
    verifyToken: async (t) => { calls.verify.push(t); return claims(); },
    resolveIdentity: async (c) => { calls.resolve.push(c); return { status: 'ok', provisioned: false, user: { id: CANONICAL, email: EMAIL, fullName: 'P', avatarUrl: null } }; },
    mintToken: mintApiToken,
    ...over
  };
  return { deps, calls };
};

const makeApp = (deps, limits) => {
  const app = express();
  app.set('trust proxy', 1);
  app.use((req, res, next) => { req.id = 'req-test-1'; next(); });
  app.use('/api/auth/firebase/exchange', createFirebaseExchangeRouter(deps, limits));
  // The real Phase 2A chain, to prove an exchange-minted token is accepted by it.
  const meRouter = express.Router();
  meRouter.get('/who', (req, res) => res.json({ userId: req.userId }));
  app.use('/api/identity', express.json(), requireAuth, bindUserId, meRouter);
  app.use(errorHandler);
  return app;
};
const post = (app, body = { idToken: ID_TOKEN }) => request(app).post('/api/auth/firebase/exchange').set('Content-Type', 'application/json').send(body);

// Capture everything written to the console so we can prove nothing sensitive is logged.
let logged = [];
const orig = {};
before(() => { for (const k of ['log', 'warn', 'error']) { orig[k] = console[k]; console[k] = (...a) => { logged.push(a.map(String).join(' ')); }; } });
after(() => { for (const k of ['log', 'warn', 'error']) console[k] = orig[k]; });

describe('availability gates', () => {
  test('flag off: indistinguishable from an unknown route (404) and nothing else runs', async () => {
    const { deps, calls } = makeDeps({ isEnabled: () => false });
    const res = await post(makeApp(deps));
    assert.equal(res.status, 404);
    assert.deepEqual(res.body, { success: false, error: 'Endpoint not found' });
    assert.equal(calls.ready + calls.verify.length, 0);
  });
  test('Firebase Admin not configured: 503, generic message, no Firebase/DB access', async () => {
    const { deps, calls } = makeDeps({ isConfigured: () => false });
    const res = await post(makeApp(deps));
    assert.equal(res.status, 503); assert.equal(res.body.code, 'IDENTITY_UNAVAILABLE');
    assert.equal(calls.ready + calls.verify.length + calls.resolve.length, 0);
  });
  test('identity schema not present (migration missing): 503 and Firebase is never called', async () => {
    const { deps, calls } = makeDeps({ isReady: async () => false });
    const res = await post(makeApp(deps));
    assert.equal(res.status, 503); assert.equal(res.body.code, 'IDENTITY_UNAVAILABLE');
    assert.equal(calls.verify.length + calls.resolve.length, 0);
  });
  test('only POST is allowed', async () => {
    const res = await request(makeApp(makeDeps().deps)).get('/api/auth/firebase/exchange');
    assert.equal(res.status, 405); assert.equal(res.headers.allow, 'POST');
  });
});

describe('request validation and limits', () => {
  const app = makeApp(makeDeps().deps);
  test('requires application/json', async () => {
    await request(app).post('/api/auth/firebase/exchange').set('Content-Type', 'text/plain').send('idToken=abc').expect(415);
  });
  test('malformed JSON -> 400', async () => {
    await request(app).post('/api/auth/firebase/exchange').set('Content-Type', 'application/json').send('{"idToken":').expect(400);
  });
  test('body over 8kb -> 413 before any verification', async () => {
    const { deps, calls } = makeDeps();
    const res = await post(makeApp(deps), { idToken: 'a'.repeat(9000) });
    assert.equal(res.status, 413); assert.equal(calls.verify.length, 0);
  });
  test('missing / non-string / empty idToken -> 400 VALIDATION_FAILED', async () => {
    for (const body of [{}, { idToken: 5 }, { idToken: '' }, { idToken: ['x'] }, { idToken: { a: 1 } }]) {
      const res = await post(app, body);
      assert.equal(res.status, 400, JSON.stringify(body)); assert.equal(res.body.code, 'VALIDATION_FAILED');
    }
  });
  test('a bearer API token is NOT a substitute for the Firebase ID token', async () => {
    const res = await request(app).post('/api/auth/firebase/exchange').set(bearer(await mintToken(CANONICAL))).set('Content-Type', 'application/json').send({});
    assert.equal(res.status, 400);
  });
});

describe('token verification outcomes', () => {
  test('every rejected token gets the SAME generic 401 (no oracle) and the identity layer is never reached', async () => {
    const bodies = new Set();
    for (const reason of ['auth/id-token-expired', 'auth/id-token-revoked', 'auth/user-disabled', 'auth/user-not-found', 'wrong-project', 'auth/argument-error', 'malformed']) {
      const { deps, calls } = makeDeps({ verifyToken: async () => { throw new TokenRejected(reason); } });
      const res = await post(makeApp(deps));
      assert.equal(res.status, 401, reason);
      assert.equal(res.body.code, 'INVALID_FIREBASE_TOKEN');
      assert.equal(calls.resolve.length, 0, 'database identity code must not run for an unverified token');
      bodies.add(JSON.stringify({ ...res.body, requestId: undefined }));
      assert.ok(!JSON.stringify(res.body).includes(reason));
    }
    assert.equal(bodies.size, 1);
  });
  test('Firebase outage / unexpected verifier failure -> 503, not 401', async () => {
    for (const err of [new VerifierUnavailable('auth/internal-error'), new TypeError('kaboom at /srv/secret/path')]) {
      const res = await post(makeApp(makeDeps({ verifyToken: async () => { throw err; } }).deps));
      assert.equal(res.status, 503); assert.equal(res.body.code, 'IDENTITY_UNAVAILABLE');
      assert.ok(!JSON.stringify(res.body).includes('kaboom') && !JSON.stringify(res.body).includes('/srv/'));
    }
  });
  test('client-supplied uid / userId / email in the body are ignored; only verified claims reach the resolver', async () => {
    const { deps, calls } = makeDeps();
    const res = await post(makeApp(deps), { idToken: ID_TOKEN, uid: 'attacker-uid', firebaseUid: 'attacker-uid', userId: 'victim-user-id', sub: 'victim', email: 'victim@example.invalid' });
    assert.equal(res.status, 200);
    assert.equal(calls.resolve.length, 1);
    assert.equal(calls.resolve[0].uid, FB_UID);
    assert.equal(calls.resolve[0].email, EMAIL);
    assert.equal(res.body.user.id, CANONICAL);
  });
});

describe('identity resolution outcomes are mapped safely', () => {
  const cases = {
    email_not_verified: [403, 'EMAIL_NOT_VERIFIED'],
    unsupported_method: [403, 'UNSUPPORTED_SIGN_IN_METHOD'],
    invalid_email: [403, 'EMAIL_NOT_VERIFIED'],
    disabled: [403, 'IDENTITY_DISABLED'],
    link_required: [409, 'ACCOUNT_LINK_REQUIRED']
  };
  for (const [status, [http, code]] of Object.entries(cases)) {
    test(`${status} -> ${http} ${code}, no token issued, no user details`, async () => {
      const res = await post(makeApp(makeDeps({ resolveIdentity: async () => ({ status }) }).deps));
      assert.equal(res.status, http); assert.equal(res.body.code, code);
      assert.ok(!('token' in res.body) && !('user' in res.body));
      const text = JSON.stringify(res.body);
      assert.ok(!text.includes(EMAIL) && !text.includes(CANONICAL) && !text.includes(FB_UID));
    });
  }
});

describe('successful exchange', () => {
  test('mints the standard 5-minute API token with sub = canonical users.id (never the Firebase UID)', async () => {
    const res = await post(makeApp(makeDeps().deps));
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true); assert.equal(res.body.tokenType, 'Bearer'); assert.equal(res.body.expiresIn, 300);
    assert.equal(res.headers['cache-control'], 'no-store');
    const { payload, protectedHeader } = await jwtVerify(res.body.token, new TextEncoder().encode(TEST_SECRET), { issuer: 'mantra-web', audience: 'mantra-api', algorithms: ['HS256'] });
    assert.equal(protectedHeader.alg, 'HS256');
    assert.equal(payload.sub, CANONICAL);
    assert.notEqual(payload.sub, FB_UID);
    assert.equal(payload.exp - payload.iat, 300);
    assert.equal(payload.email, EMAIL);
    assert.deepEqual(Object.keys(payload).sort(), ['aud', 'email', 'exp', 'iat', 'iss', 'sub']);
    assert.ok(!JSON.stringify(res.body).includes(FB_UID), 'Firebase UID must not be returned');
    assert.ok(Math.abs(res.body.expiresAt - (Date.now() + 300000)) < 5000);
  });
  test('the minted token authenticates through the real requireAuth chain as the canonical user', async () => {
    const app = makeApp(makeDeps().deps);
    const { body } = await post(app);
    const who = await request(app).get('/api/identity/who').set(bearer(body.token)).expect(200);
    assert.equal(who.body.userId, CANONICAL);
    await request(app).get(`/api/identity/who?userId=someone-else`).set(bearer(body.token)).expect(403); // ownership binding intact
  });
  test('provisioned flag is passed through', async () => {
    const { deps } = makeDeps({ resolveIdentity: async () => ({ status: 'ok', provisioned: true, user: { id: CANONICAL, email: EMAIL, fullName: null, avatarUrl: null } }) });
    assert.equal((await post(makeApp(deps))).body.provisioned, true);
  });
});

describe('rate limiting', () => {
  test('per-IP ceiling returns 429 RATE_LIMITED', async () => {
    const app = makeApp(makeDeps().deps, { ipPer15Min: 3, failuresPer15Min: 100, uidPer15Min: 100 });
    for (let i = 0; i < 3; i++) await post(app).expect(200);
    const res = await post(app);
    assert.equal(res.status, 429); assert.equal(res.body.code, 'RATE_LIMITED');
    assert.ok(res.headers['ratelimit-limit'] || res.headers['ratelimit']);
  });
  test('repeated client faults (bad tokens) are throttled before verification', async () => {
    let verifyCalls = 0;
    const { deps } = makeDeps({ verifyToken: async () => { verifyCalls += 1; throw new TokenRejected('auth/argument-error'); } });
    const app = makeApp(deps, { ipPer15Min: 100, failuresPer15Min: 3, uidPer15Min: 100 });
    for (let i = 0; i < 3; i++) await post(app).expect(401);
    const res = await post(app);
    assert.equal(res.status, 429);
    assert.equal(verifyCalls, 3, 'the 4th attempt must not reach Firebase');
  });
  test('outages and link-required answers do not consume the failure budget', async () => {
    const app = makeApp(makeDeps({ resolveIdentity: async () => ({ status: 'link_required' }) }).deps, { ipPer15Min: 100, failuresPer15Min: 2, uidPer15Min: 100 });
    for (let i = 0; i < 6; i++) await post(app).expect(409);
  });
  test('per verified Firebase UID throttle (after verification)', async () => {
    const app = makeApp(makeDeps().deps, { ipPer15Min: 100, failuresPer15Min: 100, uidPer15Min: 2 });
    await post(app).expect(200); await post(app).expect(200);
    const res = await post(app);
    assert.equal(res.status, 429); assert.ok(Number(res.headers['retry-after']) >= 1);
    assert.ok(!JSON.stringify(res.body).includes(FB_UID));
  });
});

describe('safe errors and logging', () => {
  test('unexpected internal failure -> generic 500 with request id, no internals', async () => {
    const { deps } = makeDeps({ resolveIdentity: async () => { throw new Error('PrismaClientKnownRequestError: Invalid `prisma.user.create()` invocation: table "users" DATABASE_URL=postgresql://u:p@host/db'); } });
    const res = await post(makeApp(deps));
    assert.equal(res.status, 500);
    const text = JSON.stringify(res.body);
    for (const bad of ['Prisma', 'prisma', 'users', 'postgresql', 'DATABASE_URL', 'invocation']) assert.ok(!text.includes(bad), bad);
    assert.equal(res.body.requestId, 'req-test-1');
  });
  test('across every scenario above nothing sensitive was logged (token, e-mail, Firebase UID)', async () => {
    logged = [];
    const app = makeApp(makeDeps({ resolveIdentity: async () => ({ status: 'link_required' }) }).deps);
    await post(app);
    await post(makeApp(makeDeps({ verifyToken: async () => { throw new TokenRejected('auth/id-token-expired'); } }).deps));
    await post(makeApp(makeDeps({ verifyToken: async () => { throw new VerifierUnavailable('auth/internal-error'); } }).deps));
    await post(makeApp(makeDeps({ resolveIdentity: async () => { throw new Error('db down'); } }).deps));
    const out = logged.join('\n');
    assert.ok(out.length > 0, 'something should be logged for diagnostics');
    for (const secret of [ID_TOKEN, ID_TOKEN.split('.')[1], EMAIL, FB_UID]) assert.ok(!out.includes(secret), `leaked: ${secret.slice(0, 12)}…`);
  });
});

describe('GET /api/identity/me', () => {
  const profile = { id: CANONICAL, email: EMAIL, fullName: 'P', avatarUrl: null, createdAt: new Date(0), emailVerified: true, hasPassword: false, identities: [{ provider: 'firebase', signInMethod: 'google.com', emailVerified: true, linkMethod: 'created', linkedAt: new Date(0), lastLoginAt: null, disabled: false }] };
  const meApp = (prisma) => { const a = express(); a.use(express.json()); a.use('/api/identity', requireAuth, bindUserId, createIdentityMeRouter({ prisma })); a.use(errorHandler); return a; };
  const fakePrisma = (record) => {
    const seen = { where: [] };
    return { seen, user: { findUnique: async (q) => { seen.where.push(q.where); return record(q.where.id); }, count: async () => 0 } };
  };
  test('401 without a token', async () => { await request(meApp(fakePrisma(() => null))).get('/api/identity/me').expect(401); });
  test('uses ONLY the token subject; a different client-supplied userId is rejected with 403', async () => {
    const p = fakePrisma((id) => (id === CANONICAL ? { id, email: EMAIL, fullName: 'P', avatarUrl: null, createdAt: new Date(0), emailVerifiedAt: new Date(0), authIdentities: [] } : null));
    const app = meApp(p);
    const tok = await mintToken(CANONICAL);
    const ok = await request(app).get('/api/identity/me').set(bearer(tok)).expect(200);
    assert.equal(ok.body.user.id, CANONICAL);
    await request(app).get('/api/identity/me?userId=victim').set(bearer(tok)).expect(403);
    await request(app).get('/api/identity/me?user_id=victim').set(bearer(tok)).expect(403);
    assert.ok(p.seen.where.every((w) => w.id === CANONICAL), 'database was only ever queried for the token subject');
  });
  test('unknown user -> 404 without details', async () => {
    const res = await request(meApp(fakePrisma(() => null))).get('/api/identity/me').set(bearer(await mintToken('ghost-id'))).expect(404);
    assert.equal(res.body.code, 'USER_NOT_FOUND');
  });
  test('response never contains hashes, provider subjects or tokens (shape check on the mapped profile)', async () => {
    const p = fakePrisma(() => ({ id: CANONICAL, email: EMAIL, fullName: 'P', avatarUrl: null, createdAt: new Date(0), emailVerifiedAt: null, authIdentities: [{ provider: 'firebase', signInMethod: 'password', emailVerified: true, linkMethod: 'created', createdAt: new Date(0), lastLoginAt: null, disabledAt: null }] }));
    const res = await request(meApp(p)).get('/api/identity/me').set(bearer(await mintToken(CANONICAL))).expect(200);
    const text = JSON.stringify(res.body);
    for (const bad of ['passwordHash', 'password_hash', 'providerSub', 'provider_sub', 'providerProject', 'token']) assert.ok(!text.includes(bad), bad);
    assert.deepEqual(Object.keys(res.body.user).sort(), ['avatarUrl', 'createdAt', 'email', 'emailVerified', 'fullName', 'hasPassword', 'id', 'identities']);
    assert.equal(profile.id, CANONICAL);
  });
});
