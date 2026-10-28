/**
 * Phase 2B.5B.1 static schema/migration tests for auth_link_challenges.
 * No database, network or provider access: these read repository files only.
 * (Runtime semantics of the SQL are exercised separately against a throwaway in-memory Postgres.)
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const migDir = path.join(root, 'prisma', 'migrations');
const NEW = '20261016120000_add_auth_link_challenges';
const APPLIED = {
  '20260923032421_init': '99889bdb34d50b0de97a17e25d926b0947dc4c1c9e4d42297158e3640d47ef9f',
  '20261012181122_add_wellbeing_v2': 'd4657ac71f55ab0b81e960ae645f0bbfedc0ab331cf022fbb4307d646f29bcc7',
  '20261014120000_add_auth_identities': '99c5fdb6c09edfc3add368fc3eb108bfd4dcf03407b464485f0280a5eaefb384'
};
const file = path.join(migDir, NEW, 'migration.sql');
const raw = fs.readFileSync(file);
const sql = raw.toString('utf8');
const code = sql.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');
const schema = fs.readFileSync(path.join(root, 'backend', 'tests', 'fixtures', 'legacy-prisma-schema.prisma'), 'utf8');
const model = schema.match(/model AuthLinkChallenge \{([\s\S]*?)\n\}/)?.[1];

describe('migration ordering and previously applied migrations', () => {
  test('applied migrations are byte-identical to their recorded checksums', () => {
    for (const [dir, sum] of Object.entries(APPLIED)) {
      assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(migDir, dir, 'migration.sql'))).digest('hex'), sum, dir);
    }
  });
  test('the new migration is the only addition and sorts after every applied one', () => {
    const dirs = fs.readdirSync(migDir).filter((d) => /^\d{14}_/.test(d)).sort();
    assert.deepEqual(dirs.slice(0, 4), [...Object.keys(APPLIED), NEW]);
    assert.ok(dirs.includes('20261028120000_backend_owned_auth'));
  });
  test('LF line endings only (checksum is platform independent)', () => {
    assert.ok(!raw.includes(13));
  });
});

describe('migration SQL review', () => {
  test('purely additive: no destructive or data-modifying statement, no change to existing tables', () => {
    assert.doesNotMatch(code, /\b(DROP|TRUNCATE|DELETE\s+FROM|UPDATE\s+"|INSERT\s+INTO|RENAME|GRANT|REVOKE)\b/i);
    const altered = [...code.matchAll(/ALTER TABLE "(\w+)"/g)].map((m) => m[1]);
    assert.ok(altered.length > 0 && altered.every((t) => t === 'auth_link_challenges'), altered.join());
    assert.deepEqual([...code.matchAll(/CREATE TABLE "(\w+)"/g)].map((m) => m[1]), ['auth_link_challenges']);
    assert.doesNotMatch(code, /email_verified_at/);
    assert.match(sql, /PURELY ADDITIVE/);
  });
  test('the same fail-closed transaction preamble as the approved identity migration', () => {
    assert.match(code, /^SET LOCAL lock_timeout = '5s';$/m);
    assert.match(code, /^SET LOCAL statement_timeout = '60s';$/m);
    assert.doesNotMatch(code, /^\s*SET\s+(?!LOCAL)/m);
    const a = code.indexOf("current_setting('lock_timeout') <> '5s'");
    assert.ok(a > code.indexOf('SET LOCAL lock_timeout') && a < code.indexOf('CREATE TABLE'));
    assert.equal((code.match(/\bDO\s+\$\$/g) || []).length, 1);
  });
  test('columns, types and nullability', () => {
    const t = code.match(/CREATE TABLE "auth_link_challenges" \(([\s\S]*?)\n\);/)[1];
    const want = {
      id: 'TEXT NOT NULL DEFAULT gen_random_uuid()::text', challenge_hash: 'TEXT NOT NULL', user_id: 'TEXT NOT NULL',
      provider: 'TEXT NOT NULL', provider_project: 'TEXT NOT NULL', provider_sub: 'TEXT NOT NULL', purpose: 'TEXT NOT NULL',
      credential_fingerprint: 'TEXT NOT NULL', created_at: 'TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP',
      expires_at: 'TIMESTAMPTZ(6) NOT NULL', consumed_at: 'TIMESTAMPTZ(6)'
    };
    for (const [col, type] of Object.entries(want)) assert.ok(t.includes(`"${col}" ${type},`), col);
    assert.match(t, /CONSTRAINT "auth_link_challenges_pkey" PRIMARY KEY \("id"\)/);
    assert.doesNotMatch(t, /password|token|secret|"challenge"\s/i, 'no column for raw secrets');
  });
  test('indexes: unique digest, user, expiry, provider identity', () => {
    assert.match(code, /CREATE UNIQUE INDEX "auth_link_challenges_challenge_hash_key" ON "auth_link_challenges"\("challenge_hash"\);/);
    assert.match(code, /CREATE INDEX "auth_link_challenges_user_id_idx" ON "auth_link_challenges"\("user_id"\);/);
    assert.match(code, /CREATE INDEX "auth_link_challenges_expires_at_idx" ON "auth_link_challenges"\("expires_at"\);/);
    assert.match(code, /CREATE INDEX "auth_link_challenges_provider_identity_idx" ON "auth_link_challenges"\("provider", "provider_project", "provider_sub"\);/);
  });
  test('foreign key to users(id) with ON DELETE CASCADE', () => {
    assert.match(code, /ADD CONSTRAINT "auth_link_challenges_user_id_fkey" FOREIGN KEY \("user_id"\) REFERENCES "users"\("id"\) ON DELETE CASCADE ON UPDATE CASCADE;/);
  });
  test('CHECK constraints: digest/fingerprint format, purpose, lifetime <= 5 minutes, consumption window', () => {
    assert.match(code, /"auth_link_challenges_challenge_hash_format" CHECK \("challenge_hash" ~ '\^\[0-9a-f\]\{64\}\$'\)/);
    assert.match(code, /"auth_link_challenges_credential_fingerprint_format" CHECK \("credential_fingerprint" ~ '\^\[0-9a-f\]\{64\}\$'\)/);
    assert.match(code, /"auth_link_challenges_purpose_allowed" CHECK \("purpose" IN \('link_firebase'\)\)/);
    assert.match(code, /"auth_link_challenges_lifetime" CHECK \("expires_at" > "created_at" AND "expires_at" <= "created_at" \+ interval '5 minutes'\)/);
    assert.match(code, /"auth_link_challenges_consumed_in_window" CHECK \("consumed_at" IS NULL OR \("consumed_at" >= "created_at" AND "consumed_at" <= "expires_at"\)\)/);
    assert.match(code, /"auth_link_challenges_provider_format"/);
    assert.match(code, /"auth_link_challenges_project_not_empty"/);
    assert.match(code, /"auth_link_challenges_sub_not_empty"/);
    assert.equal([...code.matchAll(/ADD CONSTRAINT "\w+" CHECK/g)].length, 8);
  });
});

describe('Prisma model', () => {
  test('AuthLinkChallenge exists with the right fields, mapping, cascade relation and indexes', () => {
    assert.ok(model, 'model AuthLinkChallenge exists');
    for (const f of ['id', 'challengeHash', 'userId', 'provider', 'providerProject', 'providerSub', 'purpose', 'credentialFingerprint', 'createdAt', 'expiresAt', 'consumedAt']) {
      assert.match(model, new RegExp(`^\\s*${f}\\s`, 'm'), f);
    }
    assert.match(model, /consumedAt\s+DateTime\?/);
    assert.match(model, /challengeHash\s+String\s+@unique\(map: "auth_link_challenges_challenge_hash_key"\)/);
    assert.match(model, /@relation\(fields: \[userId\], references: \[id\], onDelete: Cascade\)/);
    assert.match(model, /@@index\(\[userId\], map: "auth_link_challenges_user_id_idx"\)/);
    assert.match(model, /@@index\(\[expiresAt\], map: "auth_link_challenges_expires_at_idx"\)/);
    assert.match(model, /@@index\(\[provider, providerProject, providerSub\], map: "auth_link_challenges_provider_identity_idx"\)/);
    assert.match(model, /@@map\("auth_link_challenges"\)/);
    assert.match(schema, /authLinkChallenges\s+AuthLinkChallenge\[\]/);
  });
  test('the User model and AuthIdentity model are otherwise unchanged', () => {
    const user = schema.match(/model User \{([\s\S]*?)\n\}/)[1];
    assert.match(user, /passwordHash\s+String\?\s+@map\("password_hash"\)/);
    assert.match(user, /emailVerifiedAt\s+DateTime\?/);
    assert.match(schema, /@@unique\(\[provider, providerProject, providerSub\], map: "auth_identities_provider_project_sub_key"\)/);
  });
});
