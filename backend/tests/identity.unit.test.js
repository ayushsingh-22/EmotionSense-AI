/**
 * Identity service / readiness / limiter unit tests with FAKE Prisma objects (no database, no network).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { resolveFirebaseIdentity, normalizeEmail, isUniqueViolation } from '../src/identity/identityService.js';
import { createSchemaReadiness } from '../src/identity/schemaReadiness.js';
import { createKeyedLimiter } from '../src/identity/keyedLimiter.js';

const READY_ROW = { identities_table: 'auth_identities', has_verified_col: 1, hash_nullable: 'YES', has_lower_index: 1, has_identity_unique: 1 };
const claims = (o = {}) => ({ uid: 'uid-1', projectId: 'proj', email: 'Person@Example.invalid', emailVerified: true, signInProvider: 'google.com', name: 'P', picture: null, ...o });
const userRow = { id: 'user-1', email: 'person@example.invalid', fullName: 'P', avatarUrl: null };

describe('schema readiness gate (endpoint cannot run on an un-migrated database)', () => {
  const probe = (rows) => ({ $queryRawUnsafe: async () => { if (rows instanceof Error) throw rows; return [rows]; } });
  const missing = {
    'no auth_identities table': { ...READY_ROW, identities_table: null },
    'no email_verified_at column': { ...READY_ROW, has_verified_col: 0 },
    'password_hash still NOT NULL': { ...READY_ROW, hash_nullable: 'NO' },
    'no lower(email) unique index': { ...READY_ROW, has_lower_index: 0 },
    'no identity unique index': { ...READY_ROW, has_identity_unique: 0 }
  };
  for (const [name, row] of Object.entries(missing)) {
    test(`not ready: ${name}`, async () => { assert.equal(await createSchemaReadiness(probe(row))(), false); });
  }
  test('not ready when the probe itself fails (fail closed)', async () => {
    assert.equal(await createSchemaReadiness(probe(new Error('connection refused')))(), false);
  });
  test('ready when fully migrated; a positive result is cached', async () => {
    let calls = 0;
    const check = createSchemaReadiness({ $queryRawUnsafe: async () => { calls += 1; return [READY_ROW]; } });
    assert.equal(await check(), true); assert.equal(await check(), true); assert.equal(calls, 1);
  });
  test('a negative result is re-checked only after the TTL (no query storm), then recovers', async () => {
    let calls = 0; let t = 0; let row = { ...READY_ROW, identities_table: null };
    const check = createSchemaReadiness({ $queryRawUnsafe: async () => { calls += 1; return [row]; } }, { failTtlMs: 30000, now: () => t });
    assert.equal(await check(), false); assert.equal(await check(), false); assert.equal(calls, 1);
    row = READY_ROW; t = 31000;
    assert.equal(await check(), true); assert.equal(calls, 2);
  });
});

describe('resolveFirebaseIdentity branches', () => {
  const uniqueErr = () => Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });

  test('unsupported sign-in method / unverified e-mail never touch the database', async () => {
    const boom = new Proxy({}, { get() { throw new Error('database must not be used'); } });
    assert.equal((await resolveFirebaseIdentity(boom, claims({ signInProvider: 'anonymous' }))).status, 'unsupported_method');
  });
  test('unverified e-mail on a NEW identity is refused before any write', async () => {
    const writes = [];
    const prisma = { authIdentity: { findUnique: async () => null }, $transaction: async () => { writes.push('tx'); }, user: {} };
    assert.equal((await resolveFirebaseIdentity(prisma, claims({ emailVerified: false }))).status, 'email_not_verified');
    assert.equal((await resolveFirebaseIdentity(prisma, claims({ email: null }))).status, 'email_not_verified');
    assert.deepEqual(writes, []);
  });
  test('provisioning writes link_method "created" only, creates NULL hash, and never updates an existing user', async () => {
    const created = {};
    const tx = {
      user: { findFirst: async () => null, create: async ({ data }) => { created.user = data; return { ...userRow, email: data.email }; } },
      authIdentity: { create: async ({ data }) => { created.identity = data; } }
    };
    const prisma = { authIdentity: { findUnique: async () => null }, $transaction: async (fn) => fn(tx) };
    const r = await resolveFirebaseIdentity(prisma, claims());
    assert.equal(r.status, 'ok'); assert.equal(r.provisioned, true);
    assert.equal(created.user.passwordHash, null);
    assert.equal(created.user.email, 'person@example.invalid');
    assert.ok(created.user.emailVerifiedAt instanceof Date);
    assert.equal(created.identity.linkMethod, 'created');
    assert.equal(created.identity.providerSub, 'uid-1'); assert.equal(created.identity.providerProject, 'proj');
    assert.notEqual(created.identity.userId, 'uid-1');
    assert.ok(!('update' in tx.user) && !('updateMany' in tx.user), 'fake exposes no user update: any attempt would throw');
  });
  test('an e-mail clash inside the transaction returns link_required and writes nothing', async () => {
    let wrote = false;
    const tx = { user: { findFirst: async () => ({ id: 'someone' }), create: async () => { wrote = true; } }, authIdentity: { create: async () => { wrote = true; } } };
    const prisma = { authIdentity: { findUnique: async () => null }, $transaction: async (fn) => fn(tx) };
    assert.equal((await resolveFirebaseIdentity(prisma, claims())).status, 'link_required');
    assert.equal(wrote, false);
  });
  test('lost race on the same identity: unique violation -> re-read -> returns the winner (no duplicate user)', async () => {
    let finds = 0;
    const prisma = {
      authIdentity: {
        findUnique: async () => { finds += 1; return finds === 1 ? null : { id: 'i1', disabledAt: null, lastLoginAt: new Date(), user: userRow }; },
        update: async () => {}
      },
      $transaction: async () => { throw uniqueErr(); }
    };
    const r = await resolveFirebaseIdentity(prisma, claims());
    assert.equal(r.status, 'ok'); assert.equal(r.provisioned, false); assert.equal(r.user.id, 'user-1');
  });
  test('lost race against someone else holding the e-mail: retry reports link_required', async () => {
    let attempt = 0;
    const prisma = {
      authIdentity: { findUnique: async () => null },
      $transaction: async (fn) => {
        attempt += 1;
        if (attempt === 1) throw uniqueErr();
        return fn({ user: { findFirst: async () => ({ id: 'winner' }) }, authIdentity: {} });
      }
    };
    assert.equal((await resolveFirebaseIdentity(prisma, claims())).status, 'link_required');
    assert.equal(attempt, 2);
  });
  test('non-unique database errors propagate (become a generic 500 upstream)', async () => {
    const prisma = { authIdentity: { findUnique: async () => null }, $transaction: async () => { throw new Error('connection reset'); } };
    await assert.rejects(resolveFirebaseIdentity(prisma, claims()), /connection reset/);
  });
  test('a disabled mapping is refused; an enabled one is touched at most once a minute', async () => {
    const dis = { authIdentity: { findUnique: async () => ({ id: 'i', disabledAt: new Date(), lastLoginAt: null, user: userRow }) } };
    assert.equal((await resolveFirebaseIdentity(dis, claims())).status, 'disabled');
    let updates = 0;
    const fresh = { authIdentity: { findUnique: async () => ({ id: 'i', disabledAt: null, lastLoginAt: new Date(), user: userRow }), update: async () => { updates += 1; } } };
    await resolveFirebaseIdentity(fresh, claims()); assert.equal(updates, 0);
    const stale = { authIdentity: { findUnique: async () => ({ id: 'i', disabledAt: null, lastLoginAt: new Date(Date.now() - 3600_000), user: userRow }), update: async () => { updates += 1; } } };
    await resolveFirebaseIdentity(stale, claims()); assert.equal(updates, 1);
  });
  test('helpers', () => {
    assert.equal(normalizeEmail('  A@B.C '), 'a@b.c'); assert.equal(normalizeEmail(null), '');
    assert.equal(isUniqueViolation({ code: 'P2002' }), true);
    assert.equal(isUniqueViolation(new Error('duplicate key value violates unique constraint')), true);
    assert.equal(isUniqueViolation(new Error('timeout')), false);
  });
});

describe('keyed limiter', () => {
  test('allows `limit` hits per window, then blocks, then resets', () => {
    let t = 0; const l = createKeyedLimiter({ windowMs: 1000, limit: 2, now: () => t });
    assert.deepEqual([l.take('a'), l.take('a'), l.take('a')], [true, true, false]);
    assert.equal(l.take('b'), true);
    t = 1001; assert.equal(l.take('a'), true);
  });
  test('memory is bounded', () => {
    const l = createKeyedLimiter({ windowMs: 60000, limit: 1, maxKeys: 5 });
    for (let i = 0; i < 100; i++) l.take(`k${i}`);
    assert.ok(l.size() <= 5);
  });
});
