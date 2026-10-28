/**
 * Identity integration tests against the DEVELOPMENT Neon database.
 *
 *  - Firebase verification is MOCKED (no Firebase call, no real Firebase user is created or deleted).
 *  - All data is synthetic: e-mails  phase2b3-test-*@example.invalid  and provider project
 *    "phase2b3-test-project". Rows are removed afterwards (FK cascade) by that exact pattern only.
 *  - The first statement of the run is the dev-branch guard (tests/devDbGuard.js): production and both
 *    recovery branches are refused, and nothing is written until the database itself reports the
 *    development branch / endpoint / project.
 *  - A fingerprint of every NON-test users row is taken before and after: it must be identical.
 *  - No migration, reset or truncate is ever issued.
 */
import 'dotenv/config';
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import { randomUUID, createHash } from 'node:crypto';
import { jwtVerify } from 'jose';
import { setTestEnv, mintToken, bearer, TEST_SECRET } from './helpers.js';
import { assertSafeTestDatabase } from './devDbGuard.js';

if (String(process.env.NODE_ENV || '').trim().toLowerCase() === 'production') throw new Error('Refusing to run with NODE_ENV=production');
setTestEnv({
  RATE_LIMIT_AUTH_FAILURES_PER_15MIN: '10000',
  GEMINI_API_KEY: 'test-placeholder-not-a-real-key', GEMINI_API_KEY1: '', GEMINI_API_KEY2: '', GROQ_API_KEY: '',
  GOOGLE_TTS_API_KEY: '', SARVAM_API_KEY: '', MURF_API_KEY: '', HUGGINGFACE_API_KEY: '', OPENAI_API_KEY: '',
  EMAIL_ENABLED: 'false', GMAIL_EMAIL: '', GMAIL_APP_PASSWORD: '', ENABLE_EMERGENCY_ALERTS: 'false'
});
// Blank (not delete): server.js runs dotenv.config(), which re-fills DELETED keys from .env but never overrides defined ones.
for (const k of ['FIREBASE_EXCHANGE_ENABLED', 'FIREBASE_PROJECT_ID', 'FIREBASE_SERVICE_ACCOUNT_JSON_BASE64', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY']) process.env[k] = '';

const hasDb = !!process.env.DATABASE_URL;
const prisma = hasDb ? (await import('../src/lib/prisma.js')).default : null;
const { mintApiToken } = await import('../src/middleware/auth.js');
const { errorHandler } = await import('../src/middleware/errorHandler.js');
const { createFirebaseExchangeRouter } = await import('../src/routes/identityRoutes.js');
const { resolveFirebaseIdentity } = await import('../src/identity/identityService.js');
const { createSchemaReadiness } = await import('../src/identity/schemaReadiness.js');
const { TokenRejected } = await import('../src/identity/firebaseVerifier.js');
const { buildApp } = await import('../src/server.js');
const serverApp = buildApp();

const PREFIX = 'phase2b3-test-';
const PROJECT = 'phase2b3-test-project';
const emailFor = (tag) => `${PREFIX}${tag}-${randomUUID()}@example.invalid`;
const testEmailWhere = { email: { startsWith: PREFIX, endsWith: '@example.invalid', mode: 'insensitive' } };

let approved = false;
const claimsByToken = new Map();
const mkClaims = (over = {}) => ({ uid: `uid-${randomUUID()}`, projectId: PROJECT, email: emailFor('fb'), emailVerified: true, signInProvider: 'google.com', name: 'Test Person', picture: null, ...over });
const tokenFor = (claims) => { const t = `tok.${randomUUID().replace(/-/g, '')}.sig`; claimsByToken.set(t, claims); return t; };

const exchangeApp = () => {
  const app = express();
  app.set('trust proxy', 1);
  app.use((req, res, next) => { req.id = 'req-int'; next(); });
  app.use('/api/auth/firebase/exchange', createFirebaseExchangeRouter({
    isEnabled: () => true,
    isConfigured: () => true,
    isReady: createSchemaReadiness(prisma),
    verifyToken: async (t) => { const c = claimsByToken.get(t); if (!c) throw new TokenRejected('auth/argument-error'); return c; },
    resolveIdentity: (c) => resolveFirebaseIdentity(prisma, c),
    mintToken: mintApiToken
  }, { ipPer15Min: 10000, failuresPer15Min: 10000, uidPer15Min: 10000 }));
  app.use(errorHandler);
  return app;
};
let xApp;
const exchange = (claims) => request(xApp).post('/api/auth/firebase/exchange').set('Content-Type', 'application/json').send({ idToken: tokenFor(claims) });

const nonTestFingerprint = async () => {
  const rows = await prisma.user.findMany({ where: { NOT: testEmailWhere }, orderBy: { id: 'asc' } });
  return createHash('sha256').update(JSON.stringify(rows)).digest('hex') + ':' + rows.length;
};
const cleanup = async () => {
  if (!approved) return; // never delete anywhere the guard has not approved
  await prisma.user.deleteMany({ where: testEmailWhere });
  await prisma.authIdentity.deleteMany({ where: { providerProject: PROJECT } });
};

let fingerprintBefore;
before(async () => {
  assert.ok(hasDb, 'DATABASE_URL is required for the identity integration tests');
  const id = await assertSafeTestDatabase(prisma);
  approved = true;
  console.log(`# test database verified: branch=${id.branch} endpoint=${id.endpoint} project=${id.project}`);
  await cleanup();
  fingerprintBefore = await nonTestFingerprint();
  xApp = exchangeApp();
});
after(async () => {
  await cleanup();
  if (approved) assert.equal(await nonTestFingerprint(), fingerprintBefore, 'non-test users must be byte-identical after the run');
  await prisma?.$disconnect();
});

describe('safety guard', () => {
  test('refuses unapproved identities (pure checks, no DB)', async () => {
    const fake = (branch, endpoint = 'ep-cold-hill-b3lffx1r', project = 'fancy-union-28873755') => ({ $queryRawUnsafe: async () => [{ branch, endpoint, project }] });
    const env = { EXPECTED_NEON_BRANCH_ID: 'br-ancient-snow-b3si0kwz', DATABASE_URL: 'postgresql:' + '//' + 'x@ep-cold-hill-b3lffx1r-pooler.c-4.ap-southeast-1.aws.neon.tech/test' };
    await assert.rejects(assertSafeTestDatabase(fake('unapproved-branch-one'), env));
    await assert.rejects(assertSafeTestDatabase(fake('unapproved-branch-two'), env));
    await assert.rejects(assertSafeTestDatabase(fake('unapproved-branch-three'), env));
    await assert.rejects(assertSafeTestDatabase(fake(env.EXPECTED_NEON_BRANCH_ID, 'unapproved-endpoint'), env));
    await assert.rejects(assertSafeTestDatabase(fake('unapproved-branch-other'), env));
    await assert.rejects(assertSafeTestDatabase(fake(env.EXPECTED_NEON_BRANCH_ID), { ...env, EXPECTED_NEON_BRANCH_ID: 'unapproved-branch-one' }));
    await assert.rejects(assertSafeTestDatabase(fake(env.EXPECTED_NEON_BRANCH_ID), { ...env, EXPECTED_NEON_BRANCH_ID: undefined }));
    await assert.rejects(assertSafeTestDatabase(fake(env.EXPECTED_NEON_BRANCH_ID), { ...env, DATABASE_URL: 'postgresql:' + '//' + 'x@unapproved-endpoint.invalid/test' }));
  });
  test('the connected database is the development branch (server-reported)', async () => {
    const id = await assertSafeTestDatabase(prisma);
    assert.equal(id.branch, 'br-ancient-snow-b3si0kwz');
  });
  test('schema readiness probe passes on the migrated development database', async () => {
    assert.equal(await createSchemaReadiness(prisma)(), true);
  });
});

describe('new Firebase user provisioning', () => {
  test('creates a canonical user (NULL hash, verified e-mail) + identity, mints a token with sub = users.id', async () => {
    const claims = mkClaims({ email: `${PREFIX}New.Person-${randomUUID()}@Example.INVALID`, name: ' New  Person ' });
    const res = await exchange(claims).expect(200);
    assert.equal(res.body.provisioned, true);
    const user = await prisma.user.findUnique({ where: { id: res.body.user.id }, include: { authIdentities: true } });
    assert.equal(user.passwordHash, null, 'Firebase-only user has no password hash');
    assert.ok(user.emailVerifiedAt instanceof Date);
    assert.equal(user.email, claims.email.toLowerCase(), 'stored e-mail is normalised');
    assert.equal(user.authIdentities.length, 1);
    const [i] = user.authIdentities;
    assert.equal(i.provider, 'firebase'); assert.equal(i.providerProject, PROJECT); assert.equal(i.providerSub, claims.uid);
    assert.equal(i.linkMethod, 'created'); assert.equal(i.signInMethod, 'google.com'); assert.equal(i.emailVerified, true);
    assert.equal(i.emailAtLink, user.email); assert.equal(i.disabledAt, null);
    const { payload } = await jwtVerify(res.body.token, new TextEncoder().encode(TEST_SECRET), { issuer: 'mantra-web', audience: 'mantra-api', algorithms: ['HS256'] });
    assert.equal(payload.sub, user.id);
    assert.notEqual(payload.sub, claims.uid);
    assert.ok(!JSON.stringify(res.body).includes(claims.uid));
  });
  test('password sign-in method is accepted; anonymous / phone / custom are refused without creating anything', async () => {
    await exchange(mkClaims({ signInProvider: 'password' })).expect(200);
    for (const method of ['anonymous', 'phone', 'custom', 'apple.com', null]) {
      const c = mkClaims({ signInProvider: method });
      const res = await exchange(c);
      assert.equal(res.status, 403, String(method)); assert.equal(res.body.code, 'UNSUPPORTED_SIGN_IN_METHOD');
      assert.equal(await prisma.user.count({ where: { email: c.email } }), 0);
    }
  });
  test('missing or unverified e-mail: 403, and no user / identity rows are created', async () => {
    for (const over of [{ emailVerified: false }, { email: null }, { email: '' }, { email: 'not-an-email', emailVerified: true }]) {
      const c = mkClaims(over);
      const res = await exchange(c);
      assert.equal(res.status, 403, JSON.stringify(over)); assert.equal(res.body.code, 'EMAIL_NOT_VERIFIED');
      assert.equal(await prisma.authIdentity.count({ where: { providerSub: c.uid } }), 0);
    }
  });
});

describe('existing canonical identity', () => {
  test('repeat exchange returns the same users.id, creates nothing, updates last login only', async () => {
    const c = mkClaims();
    const first = await exchange(c).expect(200);
    const usersBefore = await prisma.user.count({ where: testEmailWhere });
    const second = await exchange(c).expect(200);
    assert.equal(second.body.user.id, first.body.user.id);
    assert.equal(second.body.provisioned, false);
    assert.equal(await prisma.user.count({ where: testEmailWhere }), usersBefore);
    assert.equal(await prisma.authIdentity.count({ where: { providerSub: c.uid } }), 1);
  });
  test('an existing identity keeps working if the provider later reports an unverified e-mail (bound by UID)', async () => {
    const c = mkClaims();
    const first = await exchange(c).expect(200);
    const again = await exchange({ ...c, emailVerified: false, email: 'changed@example.invalid' }).expect(200);
    assert.equal(again.body.user.id, first.body.user.id);
    assert.equal(again.body.user.email, first.body.user.email, 'e-mail is never overwritten from the provider');
  });
  test('the same UID in a DIFFERENT Firebase project is a different identity (here: not linked -> collision)', async () => {
    const c = mkClaims();
    await exchange(c).expect(200);
    const res = await exchange({ ...c, projectId: `${PROJECT}-other` });
    assert.equal(res.status, 409); // same verified e-mail, unknown identity: link required, not auto-linked
  });
  test('disabled identity mapping is refused and issues no token', async () => {
    const c = mkClaims();
    await exchange(c).expect(200);
    await prisma.authIdentity.update({ where: { provider_providerProject_providerSub: { provider: 'firebase', providerProject: PROJECT, providerSub: c.uid } }, data: { disabledAt: new Date() } });
    const res = await exchange(c);
    assert.equal(res.status, 403); assert.equal(res.body.code, 'IDENTITY_DISABLED'); assert.ok(!('token' in res.body));
  });
});

describe('e-mail collision with an existing web account: NO automatic linking', () => {
  test('case-insensitive match -> 409 ACCOUNT_LINK_REQUIRED; web account, hash and data untouched; nothing created', async () => {
    const webEmail = `Phase2b3-Test-Web-${randomUUID()}@Example.Invalid`;
    const web = await prisma.user.create({ data: { email: webEmail, passwordHash: '$2a$10$' + 'w'.repeat(53), fullName: 'Web User' } });
    const snapshot = await prisma.user.findUnique({ where: { id: web.id } });
    const usersBefore = await prisma.user.count({ where: testEmailWhere });
    const c = mkClaims({ email: webEmail.toLowerCase() });
    const res = await exchange(c);
    assert.equal(res.status, 409); assert.equal(res.body.code, 'ACCOUNT_LINK_REQUIRED');
    assert.ok(!('token' in res.body) && !('user' in res.body));
    assert.ok(!JSON.stringify(res.body).includes(web.id));
    assert.equal(await prisma.authIdentity.count({ where: { providerSub: c.uid } }), 0, 'no identity was linked');
    assert.equal(await prisma.user.count({ where: testEmailWhere }), usersBefore, 'no user was created');
    const after = await prisma.user.findUnique({ where: { id: web.id } });
    assert.deepEqual(after, snapshot, 'historic web account (hash, verification, timestamps) is byte-identical');
    assert.equal(after.emailVerifiedAt, null, 'historic web account is not marked verified');
  });
  test('mixed-case variants and every attempt return the same refusal', async () => {
    const base = `phase2b3-test-web2-${randomUUID()}@example.invalid`;
    await prisma.user.create({ data: { email: base, passwordHash: '$2a$10$' + 'x'.repeat(53) } });
    for (const variant of [base.toUpperCase(), base.replace('phase2b3', 'Phase2B3'), ` ${base} `]) {
      assert.equal((await exchange(mkClaims({ email: variant }))).status, 409, variant);
    }
  });
  test('a Firebase-only account whose Firebase UID changed (e.g. Firebase account re-created) also requires linking', async () => {
    const email = emailFor('recreated');
    await exchange(mkClaims({ email })).expect(200);
    assert.equal((await exchange(mkClaims({ email }))).status, 409);
  });
});

describe('uniqueness and concurrency', () => {
  test('10 parallel first logins of the same identity -> exactly one user and one identity, all succeed with the same id', async () => {
    const c = mkClaims();
    const results = await Promise.all(Array.from({ length: 10 }, () => exchange(c)));
    assert.deepEqual(results.map((r) => r.status), Array(10).fill(200), JSON.stringify(results.map((r) => r.body.code ?? r.status)));
    assert.equal(new Set(results.map((r) => r.body.user.id)).size, 1);
    assert.equal(results.filter((r) => r.body.provisioned).length, 1, 'exactly one request provisioned');
    assert.equal(await prisma.user.count({ where: { email: c.email } }), 1);
    assert.equal(await prisma.authIdentity.count({ where: { providerSub: c.uid } }), 1);
  });
  test('two different Firebase UIDs racing with the same new e-mail -> one account, the other needs linking', async () => {
    const email = emailFor('race');
    const results = await Promise.all([exchange(mkClaims({ email })), exchange(mkClaims({ email })), exchange(mkClaims({ email })), exchange(mkClaims({ email }))]);
    const statuses = results.map((r) => r.status).sort();
    assert.deepEqual(statuses, [200, 409, 409, 409]);
    assert.equal(await prisma.user.count({ where: { email: { equals: email, mode: 'insensitive' } } }), 1);
  });
  test('the database itself rejects a duplicate (provider, project, sub)', async () => {
    const c = mkClaims();
    const { body } = await exchange(c).expect(200);
    await assert.rejects(prisma.authIdentity.create({ data: { userId: body.user.id, provider: 'firebase', providerProject: PROJECT, providerSub: c.uid, linkMethod: 'created' } }), (e) => e.code === 'P2002');
  });
  test('the database rejects a second user differing only by e-mail case', async () => {
    const email = emailFor('dupcase');
    await prisma.user.create({ data: { email, passwordHash: null } });
    await assert.rejects(prisma.user.create({ data: { email: email.toUpperCase().replace('@EXAMPLE.INVALID', '@example.invalid'), passwordHash: null } }), (e) => e.code === 'P2002' || /unique|duplicate/i.test(e.message));
  });
  test('invalid link_method values are rejected by the database (e-mail cannot be a link method)', async () => {
    const u = await prisma.user.create({ data: { email: emailFor('lm'), passwordHash: null } });
    for (const linkMethod of ['email', 'auto', 'EMAIL', '']) {
      await assert.rejects(prisma.authIdentity.create({ data: { userId: u.id, provider: 'firebase', providerProject: PROJECT, providerSub: `lm-${randomUUID()}`, linkMethod } }), (e) => /link_method_allowed|constraint/i.test(e.message), linkMethod);
    }
  });
});

describe('account deletion', () => {
  test('deleting the Neon user cascades its identities; a later sign-in with the same Firebase account provisions a NEW user (old data is never resurrected)', async () => {
    const c = mkClaims();
    const first = await exchange(c).expect(200);
    await prisma.user.delete({ where: { id: first.body.user.id } });
    assert.equal(await prisma.authIdentity.count({ where: { providerSub: c.uid } }), 0);
    const again = await exchange(c).expect(200);
    assert.notEqual(again.body.user.id, first.body.user.id);
    assert.equal(again.body.provisioned, true);
  });
});

describe('GET /api/identity/me and web compatibility (real server app)', () => {
  test('a NextAuth-style API token (web user with a password hash) still authenticates', async () => {
    const web = await prisma.user.create({ data: { email: emailFor('webme'), passwordHash: '$2a$10$' + 'h'.repeat(53), fullName: 'Web Me' } });
    const res = await request(serverApp).get('/api/identity/me').set(bearer(await mintToken(web.id))).expect(200);
    assert.equal(res.body.user.id, web.id); assert.equal(res.body.user.hasPassword, true); assert.deepEqual(res.body.user.identities, []);
    assert.equal(res.body.user.emailVerified, false);
    assert.ok(!JSON.stringify(res.body).includes('$2a$'));
  });
  test('exchange-minted token -> profile shows the linked provider metadata, no UID, hasPassword=false', async () => {
    const c = mkClaims();
    const { body } = await exchange(c).expect(200);
    const res = await request(serverApp).get('/api/identity/me').set(bearer(body.token)).expect(200);
    assert.equal(res.body.user.id, body.user.id); assert.equal(res.body.user.hasPassword, false); assert.equal(res.body.user.emailVerified, true);
    assert.equal(res.body.user.identities.length, 1);
    assert.deepEqual(Object.keys(res.body.user.identities[0]).sort(), ['disabled', 'emailVerified', 'lastLoginAt', 'linkMethod', 'linkedAt', 'provider', 'signInMethod']);
    assert.ok(!JSON.stringify(res.body).includes(c.uid));
  });
  test('cross-user access: user A cannot read user B through /me (token subject only; client userId rejected)', async () => {
    const a = await exchange(mkClaims()).expect(200);
    const b = await exchange(mkClaims()).expect(200);
    const ok = await request(serverApp).get('/api/identity/me').set(bearer(a.body.token)).expect(200);
    assert.equal(ok.body.user.id, a.body.user.id);
    assert.ok(!JSON.stringify(ok.body).includes(b.body.user.email));
    await request(serverApp).get(`/api/identity/me?userId=${b.body.user.id}`).set(bearer(a.body.token)).expect(403);
  });
  test('legacy data routes still honour the canonical identity: an exchange token cannot act as someone else', async () => {
    const a = await exchange(mkClaims()).expect(200);
    const b = await exchange(mkClaims()).expect(200);
    await request(serverApp).get(`/api/journal?userId=${b.body.user.id}`).set(bearer(a.body.token)).expect(403);
    await request(serverApp).get('/api/journal').expect(401);
  });
  test('an exchange token for a user deleted afterwards yields a clean 404 on /me', async () => {
    const a = await exchange(mkClaims()).expect(200);
    await prisma.user.delete({ where: { id: a.body.user.id } });
    const res = await request(serverApp).get('/api/identity/me').set(bearer(a.body.token)).expect(404);
    assert.equal(res.body.code, 'USER_NOT_FOUND');
  });
});
