/**
 * Phase 2B.2 static schema/migration compatibility tests.
 * No database, network or auth-provider access: these read repository files only.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const migDir = path.join(root, 'prisma', 'migrations');
const NEW = '20261014120000_add_auth_identities';
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const schema = read('backend', 'tests', 'fixtures', 'legacy-prisma-schema.prisma');
const sql = read('prisma', 'migrations', NEW, 'migration.sql');
// SQL without comment lines, for statement-level assertions.
const code = sql.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');

const model = (name) => {
  const m = schema.match(new RegExp(`model ${name} \\{([\\s\\S]*?)\\n\\}`));
  assert.ok(m, `model ${name} exists`);
  return m[1];
};

describe('existing migrations are untouched (checksums recorded in production)', () => {
  test('init and add_wellbeing_v2 are byte-identical to production', () => {
    assert.equal(sha(path.join(migDir, '20260923032421_init', 'migration.sql')), '99889bdb34d50b0de97a17e25d926b0947dc4c1c9e4d42297158e3640d47ef9f');
    assert.equal(sha(path.join(migDir, '20261012181122_add_wellbeing_v2', 'migration.sql')), 'd4657ac71f55ab0b81e960ae645f0bbfedc0ab331cf022fbb4307d646f29bcc7');
  });
  test('the identity migration directly follows the applied ones; any later migration sorts after it', () => {
    const dirs = fs.readdirSync(migDir).filter((d) => /^\d{14}_/.test(d)).sort();
    assert.deepEqual(dirs.slice(0, 3), ['20260923032421_init', '20261012181122_add_wellbeing_v2', NEW]);
    for (const later of dirs.slice(3)) assert.ok(later > NEW, later);
  });
});

describe('new migration SQL review', () => {
  test('contains no destructive or data-modifying statements', () => {
    assert.doesNotMatch(code, /\b(DROP\s+(TABLE|COLUMN|INDEX|CONSTRAINT|SCHEMA)|TRUNCATE|DELETE\s+FROM|UPDATE\s+"|INSERT\s+INTO|RENAME)\b/i);
  });
  test('the ONLY change to an existing column constraint is password_hash DROP NOT NULL, and it is documented', () => {
    const alters = code.match(/ALTER\s+TABLE\s+"users"[^;]*;/gi) || [];
    assert.equal(alters.length, 2);
    assert.ok(alters.some((a) => /ALTER COLUMN "password_hash" DROP NOT NULL/i.test(a)));
    assert.ok(alters.some((a) => /ADD COLUMN "email_verified_at" TIMESTAMPTZ\(6\);/i.test(a)));
    assert.match(sql, /NOT PURELY ADDITIVE/);
    assert.match(sql, /password_hash: NOT NULL is DROPPED/);
  });
  test('no other legacy table is altered; users.email is untouched', () => {
    const legacy = ['chat_sessions', 'messages', 'emergency_contacts', 'safety_alerts', 'emotion_analysis', 'emotion_flow_segments',
      'daily_emotion_summary', 'weekly_emotion_summary', 'master_user_activity', 'alert_logs', 'user_preferences', 'user_consents',
      'mood_checkins', 'journal_entries', 'activity_sessions', 'recommendation_runs'];
    for (const t of legacy) assert.doesNotMatch(code, new RegExp(`(ALTER TABLE|ON)\\s+"${t}"`, 'i'), t);
    assert.doesNotMatch(code, /ALTER COLUMN "email"/i);
  });
  test('fails fast on lock contention using transaction-local settings only (no session-level SET)', () => {
    assert.match(code, /^SET LOCAL lock_timeout = '5s';$/m);
    assert.match(code, /^SET LOCAL statement_timeout = '60s';$/m);
    assert.doesNotMatch(code, /^\s*SET\s+(?!LOCAL)/m);
    // The timeouts must be established before the first lock-taking statement.
    assert.ok(code.indexOf('SET LOCAL lock_timeout') < code.indexOf('ALTER TABLE "users"'));
    assert.ok(code.indexOf('SET LOCAL lock_timeout') < code.indexOf('DO $$'));
  });
  test('fail-closed assertion: detects an ineffective SET LOCAL and runs before the duplicate guard and any DDL', () => {
    const a = code.indexOf("current_setting('lock_timeout') <> '5s'");
    assert.ok(a > -1, 'assertion present');
    assert.match(code.slice(a, a + 400), /RAISE EXCEPTION 'migration is not running inside a single transaction/);
    assert.ok(code.indexOf('SET LOCAL lock_timeout') < a, 'SET LOCAL precedes the assertion');
    assert.ok(a < code.indexOf('count(*) INTO dup_groups'), 'assertion precedes the duplicate-email guard');
    assert.ok(a < code.search(/^(ALTER|CREATE)\s/m), 'assertion precedes the first DDL statement');
    assert.equal((code.match(/\bDO\s+\$\$/g) || []).length, 1, 'still exactly one DO block');
  });
  test('line endings: migrations are LF-only so the recorded checksums are platform independent', () => {
    for (const d of fs.readdirSync(migDir).filter((x) => /^\d{14}_/.test(x))) {
      assert.ok(!fs.readFileSync(path.join(migDir, d, 'migration.sql')).includes(13), `${d} contains CR bytes`);
    }
  });
  test('.gitattributes pins migration files to LF', () => {
    const ga = read('.gitattributes').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    assert.ok(ga.includes('prisma/migrations/**/migration.sql text eol=lf'));
    assert.ok(ga.includes('prisma/migrations/migration_lock.toml text eol=lf'));
  });
  test('email uniqueness: lower(email) unique index, old unique index kept, duplicate guard first and PII-free', () => {
    assert.match(code, /CREATE UNIQUE INDEX "users_email_lower_key" ON "users"\(lower\("email"\)\);/);
    assert.doesNotMatch(code, /users_email_key/);
    assert.ok(code.indexOf('RAISE EXCEPTION') > -1);
    assert.ok(code.indexOf('RAISE EXCEPTION') < code.indexOf('CREATE UNIQUE INDEX "users_email_lower_key"'));
    for (const r of code.match(/RAISE EXCEPTION[^;]*;/g)) assert.doesNotMatch(r, /"email"|lower\(|@/);
  });
  test('auth_identities: FK to users.id ON DELETE CASCADE, unique triple, user_id index', () => {
    assert.match(code, /ADD CONSTRAINT "auth_identities_user_id_fkey" FOREIGN KEY \("user_id"\) REFERENCES "users"\("id"\) ON DELETE CASCADE ON UPDATE CASCADE/);
    assert.match(code, /CREATE UNIQUE INDEX "auth_identities_provider_project_sub_key" ON "auth_identities"\("provider", "provider_project", "provider_sub"\);/);
    assert.match(code, /CREATE INDEX "auth_identities_user_id_idx" ON "auth_identities"\("user_id"\);/);
  });
  test('"email" is not a representable link method (no automatic email linking)', () => {
    const m = code.match(/"link_method" IN \(([^)]*)\)/)[1];
    assert.deepEqual(m.split(',').map((s) => s.trim().replace(/'/g, '')), ['created', 'password_proof', 'email_link', 'admin']);
  });
  test('auth_identities columns and nullability', () => {
    const t = code.match(/CREATE TABLE "auth_identities" \(([\s\S]*?)\n\);/)[1];
    const expect = {
      id: 'TEXT NOT NULL', user_id: 'TEXT NOT NULL', provider: 'TEXT NOT NULL', provider_project: 'TEXT NOT NULL', provider_sub: 'TEXT NOT NULL',
      sign_in_method: 'TEXT', email_at_link: 'TEXT', email_verified: 'BOOLEAN NOT NULL', link_method: 'TEXT NOT NULL',
      created_at: 'TIMESTAMPTZ(6) NOT NULL', updated_at: 'TIMESTAMPTZ(6) NOT NULL', last_login_at: 'TIMESTAMPTZ(6)', disabled_at: 'TIMESTAMPTZ(6)'
    };
    for (const [col, type] of Object.entries(expect)) {
      assert.match(t, new RegExp(`"${col}" ${type.replace(/[()]/g, '\\$&')}(,| DEFAULT)`), col);
    }
  });
});

describe('Prisma schema', () => {
  test('User: passwordHash and emailVerifiedAt nullable, email required + unique, id unchanged, relation present', () => {
    const u = model('User');
    assert.match(u, /passwordHash\s+String\?\s+@map\("password_hash"\)/);
    assert.match(u, /emailVerifiedAt\s+DateTime\?\s+@map\("email_verified_at"\)/);
    assert.match(u, /email\s+String\s+@unique/);
    assert.match(u, /authIdentities\s+AuthIdentity\[\]/);
    assert.match(u, /id\s+String\s+@id @default\(uuid\(\)\)/);
  });
  test('AuthIdentity: required fields, optional fields, cascade FK, unique triple, userId index, mapped names', () => {
    const a = model('AuthIdentity');
    for (const f of ['id', 'userId', 'provider', 'providerProject', 'providerSub', 'signInMethod', 'emailAtLink', 'emailVerified', 'linkMethod', 'createdAt', 'updatedAt', 'lastLoginAt', 'disabledAt']) {
      assert.match(a, new RegExp(`^\\s*${f}\\s`, 'm'), f);
    }
    assert.match(a, /signInMethod\s+String\?/);
    assert.match(a, /emailAtLink\s+String\?/);
    assert.match(a, /lastLoginAt\s+DateTime\?/);
    assert.match(a, /disabledAt\s+DateTime\?/);
    assert.match(a, /@relation\(fields: \[userId\], references: \[id\], onDelete: Cascade\)/);
    assert.match(a, /@@unique\(\[provider, providerProject, providerSub\], map: "auth_identities_provider_project_sub_key"\)/);
    assert.match(a, /@@index\(\[userId\], map: "auth_identities_user_id_idx"\)/);
    assert.match(a, /@@map\("auth_identities"\)/);
  });
});

describe('web login compatibility (source-level)', () => {
  const lookup = read('frontend', 'lib', 'accountLookup.ts');
  const verify = read('frontend', 'lib', 'passwordVerify.ts');
  const authOptions = read('frontend', 'lib', 'authOptions.ts');
  test('verifyPassword fails closed on a missing hash', () => {
    assert.match(verify, /return !!hash && ok;/);
    assert.match(verify, /hash \|\| DUMMY_PASSWORD_HASH/);
  });
  test('Credentials authorize() uses verifyPassword and never consults identities or emailVerifiedAt', () => {
    assert.match(authOptions, /verifyPassword\(password, user\?\.passwordHash\)/);
    assert.doesNotMatch(authOptions, /authIdentit|emailVerifiedAt/);
  });
  test('accountLookup re-exports the helpers and does no identity linking by email', () => {
    assert.match(lookup, /export \{ DUMMY_PASSWORD_HASH, verifyPassword \} from '@\/lib\/passwordVerify'/);
    assert.doesNotMatch(lookup, /authIdentity/);
  });
});
