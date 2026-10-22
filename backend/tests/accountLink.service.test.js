/**
 * Account-linking service tests (Phase 2B.5B.2) against the in-memory FakeLinkDb.
 * No database, no network, no Firebase. Real bcrypt, real crypto.
 */
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { createHash } from 'node:crypto';
import { FakeLinkDb } from './fakeLinkDb.js';
import {
  checkLinkClaims, startLink, completeLink, digestChallenge, isLinkingEnabled, CHALLENGE_RE
} from '../src/identity/linkService.js';
import { verifyPasswordProof, credentialFingerprint, sameFingerprint, DUMMY_PASSWORD_HASH } from '../src/identity/passwordProof.js';
import { resolveFirebaseIdentity } from '../src/identity/identityService.js';
import { createKeyedLimiter } from '../src/identity/keyedLimiter.js';
import { createLinkSchemaReadiness } from '../src/identity/schemaReadiness.js';

const PROJECT = 'mantra-test-project';
const PASSWORD = 'correct horse battery staple';
const HASH = bcrypt.hashSync(PASSWORD, 4);
const EMAIL = 'web.owner@example.invalid';
const UID_A = 'firebase-uid-A-SECRET';
const UID_B = 'firebase-uid-B-SECRET';

let db; let store; let web; let nowSec;
const claims = (o = {}) => ({ uid: UID_A, projectId: PROJECT, email: 'Web.Owner@Example.invalid', emailVerified: true, signInProvider: 'google.com', authTime: nowSec - 30, name: null, picture: null, ...o });
const start = (c = claims(), pw = PASSWORD) => startLink(store, c, checkLinkClaims(c, { nowMs: nowSec * 1000 }).email, pw);
const complete = (challenge, c = claims()) => completeLink(store, c, checkLinkClaims(c, { nowMs: nowSec * 1000 }).email, challenge);
const sha = (v) => createHash('sha256').update(v).digest('hex');

beforeEach(() => {
  db = new FakeLinkDb();
  store = db.store();
  nowSec = Math.floor(db.nowMs / 1000);
  web = db.addUser({ id: 'canonical-web-user-0001', email: 'Web.Owner@example.invalid', passwordHash: HASH, fullName: 'Web Owner' });
});

describe('feature flag', () => {
  test('only the exact string "true" enables linking', () => {
    assert.equal(isLinkingEnabled({ ACCOUNT_LINKING_ENABLED: 'true' }), true);
    for (const v of [undefined, '', 'TRUE', 'True', '1', 'yes', ' true', 'true ']) assert.equal(isLinkingEnabled({ ACCOUNT_LINKING_ENABLED: v }), false, String(v));
  });
});

describe('claim checks (verified Firebase token -> eligible for linking)', () => {
  const opts = () => ({ nowMs: nowSec * 1000, maxAuthAgeSeconds: 600 });
  test('supported method, verified e-mail and recent auth_time -> ok with the normalised e-mail', () => {
    assert.deepEqual(checkLinkClaims(claims(), opts()), { status: 'ok', email: EMAIL });
    assert.equal(checkLinkClaims(claims({ signInProvider: 'password' }), opts()).status, 'ok');
  });
  test('unsupported sign-in methods are refused', () => {
    for (const m of ['anonymous', 'phone', 'custom', 'facebook.com', null]) assert.equal(checkLinkClaims(claims({ signInProvider: m }), opts()).status, 'unsupported_method');
  });
  test('unverified, missing or implausible e-mail is refused', () => {
    assert.equal(checkLinkClaims(claims({ emailVerified: false }), opts()).status, 'email_not_verified');
    assert.equal(checkLinkClaims(claims({ emailVerified: 'true' }), opts()).status, 'email_not_verified');
    assert.equal(checkLinkClaims(claims({ email: null }), opts()).status, 'email_not_verified');
    assert.equal(checkLinkClaims(claims({ email: `${'a'.repeat(250)}@x.io` }), opts()).status, 'email_not_verified');
  });
  test('stale, missing or future auth_time requires re-authentication', () => {
    assert.equal(checkLinkClaims(claims({ authTime: nowSec - 601 }), opts()).status, 'reauth_required');
    assert.equal(checkLinkClaims(claims({ authTime: null }), opts()).status, 'reauth_required');
    assert.equal(checkLinkClaims(claims({ authTime: nowSec + 3600 }), opts()).status, 'reauth_required');
    assert.equal(checkLinkClaims(claims({ authTime: nowSec - 600 }), opts()).status, 'ok');
  });
});

describe('password proof', () => {
  test('correct password verifies; wrong, missing hash and malformed hash never do', async () => {
    assert.equal(await verifyPasswordProof(PASSWORD, HASH), true);
    assert.equal(await verifyPasswordProof('wrong', HASH), false);
    assert.equal(await verifyPasswordProof(PASSWORD, null), false);
    assert.equal(await verifyPasswordProof(PASSWORD, 'not-a-bcrypt-hash'), false);
    assert.equal(await verifyPasswordProof(undefined, HASH), false);
  });
  test('an unknown account still pays the bcrypt cost (dummy hash, cost 10)', async () => {
    assert.equal(bcrypt.getRounds(DUMMY_PASSWORD_HASH), 10);
    const t0 = process.hrtime.bigint();
    await verifyPasswordProof(PASSWORD, null);
    assert.ok(Number(process.hrtime.bigint() - t0) / 1e6 > 5, 'dummy compare must do real bcrypt work');
  });
  test('fingerprint is sha256(hash) and compared in constant time', () => {
    assert.equal(credentialFingerprint(HASH), sha(HASH));
    assert.equal(sameFingerprint(sha(HASH), sha(HASH)), true);
    assert.equal(sameFingerprint(sha(HASH), sha('other')), false);
    assert.equal(sameFingerprint('short', 'short'), false);
  });
});

describe('startLink', () => {
  test('issues a 256-bit challenge; only its digest is stored, bound to the web user and THIS Firebase identity', async () => {
    const r = await start();
    assert.equal(r.status, 'ok');
    assert.match(r.challenge, CHALLENGE_RE);
    assert.equal(Buffer.from(r.challenge, 'base64url').length, 32);
    assert.equal(db.state.challenges.length, 1);
    const row = db.state.challenges[0];
    assert.equal(row.challengeHash, sha(r.challenge));
    assert.notEqual(row.challengeHash, r.challenge);
    assert.equal(row.userId, web.id);
    assert.deepEqual([row.provider, row.providerProject, row.providerSub, row.purpose], ['firebase', PROJECT, UID_A, 'link_firebase']);
    assert.equal(row.credentialFingerprint, sha(HASH));
    assert.equal(row.expiresAt.getTime() - row.createdAt.getTime(), 300_000, 'lifetime is exactly 5 minutes');
    assert.equal(r.expiresAt.getTime(), row.expiresAt.getTime());
    const dump = JSON.stringify(db.state.challenges);
    assert.ok(!dump.includes(r.challenge) && !dump.includes(PASSWORD) && !dump.includes(HASH), 'challenge row holds no raw challenge, password or hash');
  });
  test('a new start replaces the open challenge of the same identity (one live challenge) and challenges are unique', async () => {
    const a = await start(); const b = await start();
    assert.notEqual(a.challenge, b.challenge);
    assert.equal(db.state.challenges.length, 1);
    assert.equal((await complete(a.challenge)).status, 'invalid_challenge');
    assert.equal((await complete(b.challenge)).status, 'ok');
  });
  test('wrong password, missing account and password-less account give the SAME answer and write nothing', async () => {
    assert.deepEqual(await start(claims(), 'wrong password'), { status: 'proof_failed' });
    assert.deepEqual(await start(claims({ email: 'nobody@example.invalid' })), { status: 'proof_failed' });
    db.addUser({ email: 'firebase-only@example.invalid', passwordHash: null });
    assert.deepEqual(await start(claims({ email: 'firebase-only@example.invalid' })), { status: 'proof_failed' });
    assert.equal(db.state.challenges.length, 0);
    assert.equal(db.state.identities.length, 0);
  });
  test('identity already linked (same account or another account) is refused before any password check', async () => {
    db.addIdentity({ userId: web.id, project: PROJECT, sub: UID_A });
    assert.deepEqual(await start(claims(), 'irrelevant'), { status: 'already_linked' });
    const other = db.addUser({ email: 'other@example.invalid', passwordHash: HASH });
    db.addIdentity({ userId: other.id, project: PROJECT, sub: UID_B });
    assert.deepEqual(await start(claims({ uid: UID_B })), { status: 'already_linked' });
    assert.equal(db.state.challenges.length, 0);
  });
  test('a disabled identity is refused', async () => {
    db.addIdentity({ userId: web.id, project: PROJECT, sub: UID_A, disabledAt: new Date() });
    assert.deepEqual(await start(), { status: 'disabled' });
  });
  test('the same UID in a DIFFERENT Firebase project is a different identity', async () => {
    db.addIdentity({ userId: web.id, project: 'other-project', sub: UID_A });
    assert.equal((await start()).status, 'ok');
  });
});

describe('completeLink', () => {
  test('success: maps the Firebase identity to the ORIGINAL users.id; users rows are untouched; challenge consumed', async () => {
    const before = db.snapshot().users;
    const { challenge } = await start();
    db.advance(30);
    const r = await complete(challenge);
    assert.equal(r.status, 'ok');
    assert.deepEqual(r.user, { id: web.id, email: web.email, fullName: 'Web Owner', avatarUrl: null });
    assert.equal(db.state.identities.length, 1);
    const i = db.state.identities[0];
    assert.deepEqual([i.userId, i.provider, i.providerProject, i.providerSub, i.linkMethod, i.signInMethod, i.emailAtLink, i.emailVerified],
      [web.id, 'firebase', PROJECT, UID_A, 'password_proof', 'google.com', EMAIL, true]);
    assert.deepEqual(db.state.users, before, 'no user created or modified (password hash, e-mail, verification untouched)');
    assert.ok(db.state.challenges[0].consumedAt instanceof Date);
  });
  test('replay of a consumed challenge is refused and creates nothing', async () => {
    const { challenge } = await start();
    assert.equal((await complete(challenge)).status, 'ok');
    assert.equal((await complete(challenge)).status, 'invalid_challenge');
    assert.equal(db.state.identities.length, 1);
  });
  test('tampered, malformed and unknown challenges are refused uniformly', async () => {
    const { challenge } = await start();
    const flipped = (challenge[0] === 'A' ? 'B' : 'A') + challenge.slice(1);
    for (const c of [flipped, challenge.slice(1), `${challenge}x`, '', 'a'.repeat(43), sha(challenge), null, 42]) {
      assert.equal((await complete(c)).status, 'invalid_challenge', String(c));
    }
    assert.equal(db.state.challenges[0].consumedAt, null);
    assert.equal(db.state.identities.length, 0);
  });
  test('the digest itself (what the database stores) is useless as a challenge', async () => {
    const { challenge } = await start();
    assert.equal((await complete(digestChallenge(challenge))).status, 'invalid_challenge');
  });
  test('expired challenge (> 5 minutes by the database clock) is refused and not consumed', async () => {
    const { challenge } = await start();
    db.advance(300);
    assert.equal((await complete(challenge)).status, 'invalid_challenge');
    assert.equal(db.state.challenges[0].consumedAt, null);
    assert.equal(db.state.identities.length, 0);
  });
  test('cross-identity: a challenge issued to Firebase identity A cannot be completed by identity B (same e-mail)', async () => {
    const { challenge } = await start();
    assert.equal((await complete(challenge, claims({ uid: UID_B }))).status, 'invalid_challenge');
    assert.equal((await complete(challenge, claims({ projectId: 'other-project' }))).status, 'invalid_challenge');
    assert.equal(db.state.challenges[0].consumedAt, null, 'a foreign attempt does not burn the owner\'s challenge');
    assert.equal((await complete(challenge)).status, 'ok');
  });
  test('cross-account: an attacker Firebase identity with ANOTHER e-mail cannot use a victim challenge', async () => {
    const { challenge } = await start();
    const attacker = claims({ uid: 'attacker-uid', email: 'attacker@example.invalid' });
    assert.equal((await complete(challenge, attacker)).status, 'invalid_challenge');
    assert.equal(db.state.identities.length, 0);
  });
  test('concurrent completion of the same challenge: exactly one succeeds, one mapping', async () => {
    const { challenge } = await start();
    const results = await Promise.all(Array.from({ length: 8 }, () => complete(challenge)));
    assert.equal(results.filter((r) => r.status === 'ok').length, 1);
    assert.ok(results.filter((r) => r.status !== 'ok').every((r) => r.status === 'invalid_challenge'));
    assert.equal(db.state.identities.length, 1);
  });
  test('password changed after start: refused, transaction rolled back (challenge not consumed, nothing linked)', async () => {
    const { challenge } = await start();
    db.state.users[0].passwordHash = bcrypt.hashSync('new password', 4);
    assert.equal((await complete(challenge)).status, 'invalid_challenge');
    assert.equal(db.state.challenges[0].consumedAt, null);
    assert.equal(db.state.identities.length, 0);
  });
  test('web e-mail changed after start: refused', async () => {
    const { challenge } = await start();
    db.state.users[0].email = 'renamed@example.invalid';
    assert.equal((await complete(challenge)).status, 'invalid_challenge');
    assert.equal(db.state.identities.length, 0);
  });
  test('account deleted after start (challenge cascades away): refused', async () => {
    const { challenge } = await start();
    db.deleteUser(web.id);
    assert.equal((await complete(challenge)).status, 'invalid_challenge');
  });
  test('identity linked to ANOTHER account in the meantime: refused, never reassigned, rolled back', async () => {
    const { challenge } = await start();
    const other = db.addUser({ email: 'other@example.invalid', passwordHash: HASH });
    db.addIdentity({ userId: other.id, project: PROJECT, sub: UID_A });
    assert.equal((await complete(challenge)).status, 'already_linked');
    assert.equal(db.state.identities.length, 1);
    assert.equal(db.state.identities[0].userId, other.id, 'existing mapping unchanged');
    assert.equal(db.state.challenges[0].consumedAt, null);
  });
  test('identity linked to the SAME account in the meantime: already_linked (exchange will resolve it)', async () => {
    const { challenge } = await start();
    db.addIdentity({ userId: web.id, project: PROJECT, sub: UID_A });
    assert.equal((await complete(challenge)).status, 'already_linked');
  });
  test('identity disabled in the meantime: refused', async () => {
    const { challenge } = await start();
    db.addIdentity({ userId: web.id, project: PROJECT, sub: UID_A, disabledAt: new Date() });
    assert.equal((await complete(challenge)).status, 'disabled');
  });
  test('database unique violation (race decided by PostgreSQL) is mapped, rolled back, never reassigns', async () => {
    const { challenge } = await start();
    const other = db.addUser({ email: 'other@example.invalid', passwordHash: HASH });
    // Another transaction commits the same identity between our existence check and our insert.
    db.faults.beforeInsertIdentity = () => db.addIdentity({ userId: other.id, project: PROJECT, sub: UID_A });
    const r = await complete(challenge);
    assert.equal(r.status, 'already_linked');
    assert.equal(db.state.challenges[0].consumedAt, null, 'our consume was rolled back');
  });
  test('failure after the identity insert rolls back BOTH the insert and the consume, and the error propagates', async () => {
    const { challenge } = await start();
    db.faults.afterInsertIdentity = new Error('connection reset');
    await assert.rejects(complete(challenge), /connection reset/);
    assert.equal(db.state.identities.length, 0);
    assert.equal(db.state.challenges[0].consumedAt, null);
    assert.equal((await complete(challenge)).status, 'ok', 'a later retry with the still-valid challenge works');
  });
  test('ambiguous outcome (error AFTER commit): read-only reconciliation reports success, no blind retry', async () => {
    const { challenge } = await start();
    db.faults.afterCommit = new Error('socket closed during COMMIT');
    const txBefore = db.txCount;
    const r = await complete(challenge);
    assert.equal(r.status, 'ok'); assert.equal(r.reconciled, true); assert.equal(r.user.id, web.id);
    assert.equal(db.txCount, txBefore + 1, 'no second write transaction');
    assert.equal(db.state.identities.length, 1);
  });
});

describe('Firebase exchange before and after linking (existing behaviour preserved)', () => {
  test('409 before, original canonical id after; no duplicate user; provisioning of new e-mails unchanged', async () => {
    const prisma = db.prisma();
    assert.equal((await resolveFirebaseIdentity(prisma, claims())).status, 'link_required');
    const { challenge } = await start();
    assert.equal((await complete(challenge)).status, 'ok');
    const after = await resolveFirebaseIdentity(prisma, claims());
    assert.equal(after.status, 'ok'); assert.equal(after.provisioned, false); assert.equal(after.user.id, web.id);
    assert.equal(db.state.users.length, 1);
    const fresh = await resolveFirebaseIdentity(prisma, claims({ uid: 'brand-new-uid', email: 'new.person@example.invalid' }));
    assert.equal(fresh.status, 'ok'); assert.equal(fresh.provisioned, true); assert.notEqual(fresh.user.id, web.id);
    assert.equal(db.state.identities.find((i) => i.providerSub === 'brand-new-uid').linkMethod, 'created');
  });
  test('a second Firebase identity with the same e-mail still gets 409 until it is linked itself', async () => {
    const { challenge } = await start();
    await complete(challenge);
    assert.equal((await resolveFirebaseIdentity(db.prisma(), claims({ uid: UID_B, signInProvider: 'password' }))).status, 'link_required');
  });
});

describe('supporting pieces', () => {
  test('keyed limiter isLimited() does not consume budget', () => {
    let t = 0;
    const l = createKeyedLimiter({ windowMs: 1000, limit: 2, now: () => t });
    assert.equal(l.isLimited('k'), false);
    l.take('k'); l.take('k');
    assert.equal(l.isLimited('k'), true);
    t = 1001;
    assert.equal(l.isLimited('k'), false);
  });
  test('link schema readiness requires the identity schema AND the challenge table with its constraints', async () => {
    const identity = { identities_table: 'auth_identities', has_verified_col: 1, hash_nullable: 'YES', has_lower_index: 1, has_identity_unique: 1 };
    const link = { challenges_table: 'auth_link_challenges', has_digest_unique: 1, has_checks: 4, allows_password_proof: 1 };
    const probe = (l) => ({ $queryRawUnsafe: async (sql) => [sql.includes('auth_link_challenges') ? l : identity] });
    assert.equal(await createLinkSchemaReadiness(probe(link))(), true);
    for (const bad of [{ challenges_table: null }, { has_digest_unique: 0 }, { has_checks: 3 }, { allows_password_proof: 0 }]) {
      assert.equal(await createLinkSchemaReadiness(probe({ ...link, ...bad }))(), false, JSON.stringify(bad));
    }
    assert.equal(await createLinkSchemaReadiness({ $queryRawUnsafe: async () => { throw new Error('down'); } })(), false);
  });
});
