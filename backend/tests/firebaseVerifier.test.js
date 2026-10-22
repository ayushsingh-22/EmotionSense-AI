/**
 * Firebase verification unit tests. No network, no database, no real Firebase credentials:
 * a throwaway RSA key is generated in-process for the "real Admin SDK, offline" cases.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { getApps } from 'firebase-admin/app';
import {
  readFirebaseConfig, getFirebaseAuth, createFirebaseVerifier, assertFirebaseConfigured, isExchangeEnabled,
  TokenRejected, VerifierUnavailable, FIREBASE_APP_NAME, _resetFirebaseCacheForTests
} from '../src/identity/firebaseVerifier.js';

const PROJECT = 'mantra-test-project';
const { privateKey: PEM } = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
const GOOD_ENV = { FIREBASE_PROJECT_ID: PROJECT, FIREBASE_CLIENT_EMAIL: 'svc@mantra-test-project.iam.gserviceaccount.com', FIREBASE_PRIVATE_KEY: PEM };

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const now = () => Math.floor(Date.now() / 1000);
const fakeJwt = ({ header = { alg: 'RS256', typ: 'JWT', kid: 'test-kid' }, payload = {}, sig = 'c2lnbmF0dXJl' } = {}) =>
  `${b64(header)}.${b64({ aud: PROJECT, iss: `https://securetoken.google.com/${PROJECT}`, sub: 'uid-123', iat: now() - 10, exp: now() + 3000, auth_time: now() - 10, ...payload })}.${sig}`;

const decodedOk = (over = {}) => ({
  aud: PROJECT, iss: `https://securetoken.google.com/${PROJECT}`, sub: 'uid-123', uid: 'uid-123',
  email: 'Person@Example.invalid', email_verified: true, name: 'Person', picture: 'https://example.invalid/p.png',
  firebase: { sign_in_provider: 'google.com', identities: {} }, ...over
});
const mockAuth = (impl) => ({ calls: [], verifyIdToken(token, checkRevoked) { this.calls.push({ token, checkRevoked }); return impl(token, checkRevoked); } });
const fbError = (code) => Object.assign(new Error(`Firebase said ${code}`), { code });
const TOKEN = fakeJwt();

describe('configuration (fails closed, never echoes values)', () => {
  test('missing project id', () => {
    assert.throws(() => readFirebaseConfig({}), (e) => e instanceof VerifierUnavailable && /FIREBASE_PROJECT_ID/.test(e.reason));
  });
  test('malformed project id', () => {
    assert.throws(() => readFirebaseConfig({ ...GOOD_ENV, FIREBASE_PROJECT_ID: 'Not A Project!' }), VerifierUnavailable);
  });
  test('missing credentials', () => {
    assert.throws(() => readFirebaseConfig({ FIREBASE_PROJECT_ID: PROJECT }), (e) => /credentials are not configured/.test(e.reason));
  });
  test('non-PEM private key is refused and the key text is not echoed', () => {
    try { readFirebaseConfig({ ...GOOD_ENV, FIREBASE_PRIVATE_KEY: 'super-secret-not-a-pem' }); assert.fail('should throw'); } catch (e) {
      assert.ok(e instanceof VerifierUnavailable); assert.ok(!JSON.stringify([e.message, e.reason]).includes('super-secret'));
    }
  });
  test('base64 service-account form works; a project mismatch is refused', () => {
    const sa = { project_id: PROJECT, client_email: GOOD_ENV.FIREBASE_CLIENT_EMAIL, private_key: PEM };
    const ok = readFirebaseConfig({ FIREBASE_PROJECT_ID: PROJECT, FIREBASE_SERVICE_ACCOUNT_JSON_BASE64: Buffer.from(JSON.stringify(sa)).toString('base64') });
    assert.equal(ok.projectId, PROJECT);
    const bad = Buffer.from(JSON.stringify({ ...sa, project_id: 'other-project' })).toString('base64');
    assert.throws(() => readFirebaseConfig({ FIREBASE_PROJECT_ID: PROJECT, FIREBASE_SERVICE_ACCOUNT_JSON_BASE64: bad }), (e) => e instanceof VerifierUnavailable && /does not match/.test(e.reason));
  });
  test('escaped \\n in an env-provided key is normalised', () => {
    const c = readFirebaseConfig({ ...GOOD_ENV, FIREBASE_PRIVATE_KEY: PEM.replace(/\n/g, '\\n') });
    assert.ok(c.privateKey.includes('\n'));
  });
  test('assertFirebaseConfigured throws when unconfigured (boot-time fail-closed)', () => {
    _resetFirebaseCacheForTests();
    assert.throws(() => assertFirebaseConfigured({}), VerifierUnavailable);
  });
  test('Firebase credential variables are redacted from logs by value', async () => {
    const { collectSecretValues, redact, refreshSecrets } = await import('../src/utils/logRedaction.js');
    const env = { FIREBASE_SERVICE_ACCOUNT_JSON_BASE64: 'c2VydmljZS1hY2NvdW50LWpzb24tc2VjcmV0', FIREBASE_PRIVATE_KEY: 'pem-private-key-value-123', FIREBASE_CLIENT_EMAIL: 'svc@example.invalid' };
    const values = collectSecretValues(env);
    assert.ok(values.includes(env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64) && values.includes(env.FIREBASE_PRIVATE_KEY));
    refreshSecrets(env);
    assert.ok(!redact(`oops ${env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64} and ${env.FIREBASE_PRIVATE_KEY}`).includes('c2VydmljZS1hY2NvdW50'));
    refreshSecrets(process.env);
  });
  test('the feature flag is opt-in', () => {
    assert.equal(isExchangeEnabled({}), false);
    assert.equal(isExchangeEnabled({ FIREBASE_EXCHANGE_ENABLED: '1' }), false);
    assert.equal(isExchangeEnabled({ FIREBASE_EXCHANGE_ENABLED: 'true' }), true);
  });
  test('Admin app is initialised once per process', () => {
    _resetFirebaseCacheForTests();
    const a = getFirebaseAuth(GOOD_ENV);
    _resetFirebaseCacheForTests(); // even after dropping our cache the named app is reused
    const b = getFirebaseAuth(GOOD_ENV);
    assert.equal(a.projectId, PROJECT);
    assert.equal(getApps().filter((x) => x.name === FIREBASE_APP_NAME).length, 1);
    assert.ok(b.auth && typeof b.auth.verifyIdToken === 'function');
  });
});

describe('verifier with a mocked Admin SDK', () => {
  test('valid token -> claims; revocation checking is ON; uid comes from the verified token', async () => {
    const auth = mockAuth(async () => decodedOk());
    const claims = await createFirebaseVerifier({ auth, projectId: PROJECT })(TOKEN);
    assert.deepEqual(auth.calls.map((c) => c.checkRevoked), [true]);
    assert.equal(claims.uid, 'uid-123'); assert.equal(claims.projectId, PROJECT);
    assert.equal(claims.emailVerified, true); assert.equal(claims.signInProvider, 'google.com');
  });
  test('email_verified must be strictly true', async () => {
    for (const v of [false, 'true', 1, undefined]) {
      const c = await createFirebaseVerifier({ auth: mockAuth(async () => decodedOk({ email_verified: v })), projectId: PROJECT })(TOKEN);
      assert.equal(c.emailVerified, false, String(v));
    }
  });
  const rejectCases = {
    'invalid signature': 'auth/argument-error',
    expired: 'auth/id-token-expired',
    revoked: 'auth/id-token-revoked',
    'disabled user': 'auth/user-disabled',
    'deleted user': 'auth/user-not-found'
  };
  for (const [name, code] of Object.entries(rejectCases)) {
    test(`${name} (${code}) -> TokenRejected`, async () => {
      const v = createFirebaseVerifier({ auth: mockAuth(async () => { throw fbError(code); }), projectId: PROJECT });
      await assert.rejects(v(TOKEN), (e) => e instanceof TokenRejected && e.reason === code);
    });
  }
  test('Firebase/network outage is VerifierUnavailable, never a client fault', async () => {
    for (const code of ['auth/internal-error', 'app/network-error', 'auth/service-unavailable', 'ECONNRESET']) {
      const v = createFirebaseVerifier({ auth: mockAuth(async () => { throw fbError(code); }), projectId: PROJECT });
      await assert.rejects(v(TOKEN), (e) => e instanceof VerifierUnavailable, code);
    }
    const v = createFirebaseVerifier({ auth: mockAuth(async () => { throw new TypeError('boom'); }), projectId: PROJECT });
    await assert.rejects(v(TOKEN), VerifierUnavailable);
  });
  test('wrong project: aud or iss different from the pinned project is rejected even if the SDK accepted it', async () => {
    for (const over of [{ aud: 'other-project' }, { iss: 'https://securetoken.google.com/other-project' }, { iss: 'https://evil.example/' + PROJECT }]) {
      const v = createFirebaseVerifier({ auth: mockAuth(async () => decodedOk(over)), projectId: PROJECT });
      await assert.rejects(v(TOKEN), (e) => e instanceof TokenRejected && e.reason === 'wrong-project');
    }
  });
  test('bad subject / uid shapes are rejected', async () => {
    for (const over of [{ uid: '', sub: '' }, { uid: 'a'.repeat(129), sub: 'a'.repeat(129) }, { uid: 'has space', sub: 'has space' }, { uid: 'one', sub: 'two' }, { uid: undefined, sub: undefined }]) {
      const v = createFirebaseVerifier({ auth: mockAuth(async () => decodedOk(over)), projectId: PROJECT });
      await assert.rejects(v(TOKEN), (e) => e instanceof TokenRejected, JSON.stringify(over).slice(0, 40));
    }
  });
  test('malformed / oversized tokens never reach the SDK', async () => {
    const auth = mockAuth(async () => decodedOk());
    const v = createFirebaseVerifier({ auth, projectId: PROJECT });
    for (const t of [undefined, null, 5, '', 'abc', 'a.b', 'not a jwt at all really', `${'a'.repeat(5000)}.b.c`]) {
      await assert.rejects(v(t), TokenRejected);
    }
    assert.equal(auth.calls.length, 0);
  });
  test('a hanging SDK call times out as unavailable', { timeout: 20000 }, async () => {
    const v = createFirebaseVerifier({ auth: mockAuth(() => new Promise(() => {})), projectId: PROJECT });
    await assert.rejects(v(TOKEN), (e) => e instanceof VerifierUnavailable && e.reason === 'timeout');
  });
});

describe('REAL Firebase Admin SDK, offline (local checks that run before any key fetch)', () => {
  const real = () => { _resetFirebaseCacheForTests(); const { auth, projectId } = getFirebaseAuth(GOOD_ENV); return createFirebaseVerifier({ auth, projectId }); };
  const rejects = (token) => assert.rejects(real()(token), (e) => e instanceof TokenRejected, 'expected a TokenRejected');

  test('garbage that looks like a JWT', async () => { await rejects('aaaaaaaaaaaa.bbbbbbbbbbbb.cccccccccccc'); });
  test('alg=none (unsigned)', async () => { await rejects(fakeJwt({ header: { alg: 'none', typ: 'JWT', kid: 'k' }, sig: '' })); });
  test('wrong algorithm (HS256)', async () => { await rejects(fakeJwt({ header: { alg: 'HS256', typ: 'JWT', kid: 'k' } })); });
  test('missing kid', async () => { await rejects(fakeJwt({ header: { alg: 'RS256', typ: 'JWT' } })); });
  test('WRONG FIREBASE PROJECT (audience)', async () => { await rejects(fakeJwt({ payload: { aud: 'some-other-project' } })); });
  test('WRONG ISSUER', async () => { await rejects(fakeJwt({ payload: { iss: 'https://securetoken.google.com/some-other-project' } })); });
  test('empty subject', async () => { await rejects(fakeJwt({ payload: { sub: '' } })); });
});
