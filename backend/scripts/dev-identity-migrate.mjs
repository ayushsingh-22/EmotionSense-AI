#!/usr/bin/env node
/**
 * Guarded runner: apply Prisma migration `20261014120000_add_auth_identities`
 * (Phase 2B.2 identity foundation) to the DEVELOPMENT Neon branch ONLY.
 *
 * Modes (run from backend/):
 *   node scripts/dev-identity-migrate.mjs
 *        -> PREFLIGHT ONLY (default; read-only; changes nothing)
 *   node scripts/dev-identity-migrate.mjs --verify-only [--expect-users-fingerprint <sha256>] [--functional-probe]
 *        -> post-migration verification (read-only; --functional-probe adds a transaction that is ALWAYS rolled back)
 *   node scripts/dev-identity-migrate.mjs --execute \
 *        --confirm-branch br-weathered-hall-b3dn9bub \
 *        --recovery-point <NEW neon branch id created for this migration, e.g. br-xxxx> \
 *        --confirm-recovery-verified \
 *        --confirm-not-default \
 *        --confirm-checksum <first 16 hex chars of the approved migration sha256>
 *        -> preflight, `prisma migrate deploy`, full verification
 *
 * Hard guarantees:
 *  - The ONLY database-changing command ever spawned is `prisma migrate deploy` (fixed argv, no
 *    shell). No reset / db push / migrate resolve / manual SQL / rollback path exists here.
 *  - Production (branch br-flat-tree-b3brt6b9, endpoint ep-snowy-term-b39utxb2) is refused
 *    unconditionally: by hostname, by env pin, and by the ids the server itself reports, on both
 *    the pooled and the direct connection, before and after the deploy.
 *  - The recovery branch br-lively-boat-b3vxk8t3 must never be used as the migration target,
 *    and is rejected as the "new" recovery point (a fresh pre-2B.2 branch is required).
 *  - The approved SQL is pinned by SHA-256 below: ANY edit to the migration file blocks execution.
 *  - On any failure it reports and STOPS: no retries, no rollback, no edits to _prisma_migrations.
 *  - Credentials, emails and password hashes are never printed.
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

/* ------------------------------ constants ------------------------------ */
const DEV = { branch: 'br-weathered-hall-b3dn9bub', endpoint: 'ep-square-boat-b3zomdvt', project: 'plain-wave-56430909' };
const PROD = { branch: 'br-flat-tree-b3brt6b9', endpoint: 'ep-snowy-term-b39utxb2' };
const OLD_RECOVERY = 'br-lively-boat-b3vxk8t3';

const INIT = '20260923032421_init';
const V2 = '20261012181122_add_wellbeing_v2';
const NEW = '20261014120000_add_auth_identities';
// Checksums of the two already-applied migrations (as recorded in production).
const CHECKSUM = {
  [INIT]: '99889bdb34d50b0de97a17e25d926b0947dc4c1c9e4d42297158e3640d47ef9f',
  [V2]: 'd4657ac71f55ab0b81e960ae645f0bbfedc0ab331cf022fbb4307d646f29bcc7',
  // The APPROVED SQL. Changing a single byte of the migration invalidates this pin.
  [NEW]: '99c5fdb6c09edfc3add368fc3eb108bfd4dcf03407b464485f0280a5eaefb384'
};
const V2_TABLES = ['user_preferences', 'user_consents', 'mood_checkins', 'journal_entries', 'media_assets',
  'content_items', 'activity_sessions', 'activity_feedback', 'recommendation_runs', 'recommendation_items'];
const LEGACY_TABLES = ['users', 'chat_sessions', 'messages', 'emergency_contacts', 'safety_alerts', 'emotion_analysis',
  'emotion_flow_segments', 'daily_emotion_summary', 'weekly_emotion_summary', 'master_user_activity', 'alert_logs'];
const IDENTITY_COLUMNS = {
  id: ['text', 'NO'], user_id: ['text', 'NO'], provider: ['text', 'NO'], provider_project: ['text', 'NO'], provider_sub: ['text', 'NO'],
  sign_in_method: ['text', 'YES'], email_at_link: ['text', 'YES'], email_verified: ['boolean', 'NO'], link_method: ['text', 'NO'],
  created_at: ['timestamp with time zone', 'NO'], updated_at: ['timestamp with time zone', 'NO'],
  last_login_at: ['timestamp with time zone', 'YES'], disabled_at: ['timestamp with time zone', 'YES']
};

const here = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(here, '..');
const repoRoot = path.resolve(backendDir, '..');
const migrationsDir = path.join(repoRoot, 'prisma', 'migrations');
const schemaFile = path.join(repoRoot, 'prisma', 'schema.prisma');
const migFile = (n) => path.join(migrationsDir, n, 'migration.sql');

/* ------------------------------- helpers ------------------------------- */
const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const opt = (n) => { const i = args.indexOf(`--${n}`); return i > -1 ? args[i + 1] : undefined; };
const known = new Set(['--execute', '--verify-only', '--confirm-branch', '--recovery-point', '--confirm-recovery-verified',
  '--confirm-not-default', '--confirm-checksum', '--expect-users-fingerprint', '--functional-probe']);
const unknown = args.filter((a) => a.startsWith('--') && !known.has(a));
let failures = 0;
const ok = (c, m) => { if (!c) failures += 1; console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); };
const info = (m) => console.log(`      ${m}`);
const stop = (m) => { console.log(`\nSTOP: ${m}\nNothing further was attempted. No rollback or manual repair was performed.`); process.exit(1); };
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const fileSha = (f) => sha(fs.readFileSync(f));

const parseUrl = (s) => { try { return new URL(s); } catch { return null; } };
const withTimeouts = (u) => { const c = new URL(u.toString()); c.searchParams.set('connect_timeout', '60'); c.searchParams.set('pool_timeout', '60'); return c; };
const directOf = (u) => { const c = new URL(u.toString()); c.hostname = c.hostname.replace('-pooler', ''); return c; };
const endpointOf = (u) => u.hostname.split('.')[0].replace('-pooler', '');

const readOnly = (prisma, fn) => prisma.$transaction(async (tx) => {
  await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
  return fn((s) => tx.$queryRawUnsafe(s));
}, { timeout: 120000, maxWait: 120000 });

const cli = (cliArgs, url) => {
  const entry = path.join(backendDir, 'node_modules', 'prisma', 'build', 'index.js');
  const r = spawnSync(process.execPath, [entry, ...cliArgs], {
    cwd: backendDir, env: { ...process.env, DATABASE_URL: url.toString() }, encoding: 'utf8'
  });
  const scrub = (t) => (t || '').replace(/postgres(ql)?:\/\/[^\s"']+/g, 'postgresql://***');
  return { status: r.status, out: scrub(`${r.stdout || ''}${r.stderr || ''}`) };
};

const stripComments = (sql) => sql.split(/\r?\n/).filter((l) => !l.trim().startsWith('--')).join('\n');

/** Names the three migration files define, used to prove nothing pre-existing disappeared. */
const definedNames = () => {
  const all = [INIT, V2, NEW].map((n) => stripComments(fs.readFileSync(migFile(n), 'utf8'))).join('\n');
  return {
    indexes: [...new Set([
      ...[...all.matchAll(/CREATE (?:UNIQUE )?INDEX "(\w+)"/g)].map((m) => m[1]),
      ...[...all.matchAll(/CONSTRAINT "(\w+)" PRIMARY KEY/g)].map((m) => m[1])
    ])].sort(),
    fks: [...all.matchAll(/ADD CONSTRAINT "(\w+)" FOREIGN KEY/g)].map((m) => m[1]).sort(),
    checks: [...all.matchAll(/ADD CONSTRAINT "(\w+)" CHECK/g)].map((m) => m[1]).sort()
  };
};

/** Server-reported identity; refuses production. */
const identity = async (label, url) => {
  const prisma = new PrismaClient({ datasources: { db: { url: url.toString() } }, log: [] });
  try {
    const id = await readOnly(prisma, async (q) => (await q(
      "select current_setting('neon.branch_id',true) branch, current_setting('neon.endpoint_id',true) endpoint, current_setting('neon.project_id',true) project, current_setting('transaction_read_only') ro"))[0]);
    info(`${label}: server reports branch=${id.branch} endpoint=${id.endpoint} project=${id.project}`);
    if (id.branch === PROD.branch || id.endpoint === PROD.endpoint) stop(`${label} is the PRODUCTION branch/endpoint. Refusing unconditionally.`);
    if (id.branch === OLD_RECOVERY) stop(`${label} is the RECOVERY branch. Refusing unconditionally.`);
    ok(id.branch === DEV.branch, `${label}: branch id == ${DEV.branch}`);
    ok(id.endpoint === DEV.endpoint, `${label}: endpoint == ${DEV.endpoint}`);
    ok(id.project === DEV.project, `${label}: project == ${DEV.project}`);
    ok(id.ro === 'on', `${label}: inspection transaction is READ ONLY`);
  } finally { await prisma.$disconnect(); }
};

/** Everything we want to prove unchanged: counts, users fingerprint, constraint/index names. */
const snapshot = async (q) => {
  const have = new Set((await q("select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE'")).map((r) => r.table_name));
  const counts = {};
  for (const t of [...LEGACY_TABLES, ...V2_TABLES]) if (have.has(t)) counts[t] = (await q(`select count(*)::int c from "${t}"`))[0].c;
  const rows = await q('select id, email, password_hash, full_name, avatar_url, created_at, updated_at from users order by id');
  const fingerprint = sha(JSON.stringify(rows));
  const names = async (sql) => (await q(sql)).map((r) => r.n).sort();
  return {
    have, counts, fingerprint,
    indexes: await names("select indexname n from pg_indexes where schemaname='public' and tablename <> '_prisma_migrations'"),
    fks: await names("select conname n from pg_constraint where contype='f' and connamespace='public'::regnamespace"),
    checks: await names("select conname n from pg_constraint where contype='c' and connamespace='public'::regnamespace")
  };
};

/* ------------------------------ preflight ------------------------------ */
const preflight = async () => {
  console.log('\n=== PREFLIGHT (read-only) ===');
  if (unknown.length) stop(`unknown option(s): ${unknown.join(' ')}`);
  ok(!/[\\/]\.claude[\\/]worktrees[\\/]/i.test(backendDir), 'running from the main repo backend/, not a worktree');
  ok(path.basename(backendDir) === 'backend' && fs.existsSync(schemaFile), 'working directory is <repo>/backend with the canonical prisma/schema.prisma');

  const raw = process.env.DATABASE_URL;
  const url = raw && parseUrl(raw);
  if (!url) stop('DATABASE_URL is missing or unparsable.');
  const ep = endpointOf(url);
  info(`configured endpoint: ${ep}${url.hostname.includes('-pooler') ? ' (pooled)' : ''}, database ${url.pathname.slice(1)}`);
  if (ep === PROD.endpoint || url.hostname.includes(PROD.endpoint)) stop('configured DATABASE_URL points at the PRODUCTION endpoint. Refusing unconditionally.');
  ok(ep === DEV.endpoint, `configured endpoint == ${DEV.endpoint}`);
  ok(!url.searchParams.get('schema'), 'no ?schema= override in DATABASE_URL');
  const pin = process.env.EXPECTED_NEON_BRANCH_ID;
  if (pin === PROD.branch || pin === OLD_RECOVERY) stop('EXPECTED_NEON_BRANCH_ID is production or recovery. Refusing.');
  ok(pin === DEV.branch, `EXPECTED_NEON_BRANCH_ID == ${DEV.branch}`);

  // Migration folder: ordering, naming, checksums.
  const dirs = fs.readdirSync(migrationsDir).filter((f) => /^\d{14}_/.test(f)).sort();
  ok(JSON.stringify(dirs) === JSON.stringify([INIT, V2, NEW]), `local migrations are exactly [${INIT}, ${V2}, ${NEW}] in timestamp order`);
  ok(/^\d{14}_[a-z0-9_]+$/.test(NEW) && NEW > V2, 'new migration name follows <14-digit UTC timestamp>_<snake_case> and sorts after the applied ones');
  ok(fileSha(migFile(INIT)) === CHECKSUM[INIT], 'init migration.sql unchanged (checksum == production-recorded)');
  ok(fileSha(migFile(V2)) === CHECKSUM[V2], 'V2 migration.sql unchanged (checksum == production-recorded)');
  const newSha = fileSha(migFile(NEW));
  info(`new migration sha256 = ${newSha}`);
  ok(newSha === CHECKSUM[NEW], 'new migration.sql matches the APPROVED checksum pinned in this script');

  // Static SQL review (comments stripped; ON DELETE/UPDATE referential actions removed first).
  const code = stripComments(fs.readFileSync(migFile(NEW), 'utf8')).replace(/ON (DELETE|UPDATE) (CASCADE|RESTRICT|SET NULL|NO ACTION)/g, '');
  const forbidden = code.match(/\b(DROP(?!\s+NOT\s+NULL)|DELETE|TRUNCATE|UPDATE|INSERT|RENAME|GRANT|REVOKE|CREATE\s+(?:EXTENSION|ROLE|SCHEMA|FUNCTION|TRIGGER)|ALTER\s+(?:ROLE|SYSTEM|DATABASE))(?![A-Za-z0-9_])/gi);
  ok(!forbidden, `migration SQL contains no destructive/privileged statements${forbidden ? ` (found: ${[...new Set(forbidden)].join(', ')})` : ''}`);
  ok((code.match(/\bDO\s+\$\$/g) || []).length === 1 && /RAISE EXCEPTION/.test(code), 'exactly one DO block (SET LOCAL assertion + duplicate-email guard; it only SELECTs and RAISEs)');
  ok(/SET LOCAL lock_timeout/.test(code) && !/^\s*SET\s+(?!LOCAL)/m.test(code), 'lock_timeout set with SET LOCAL only (no session-level settings)');
  const assertAt = code.indexOf("current_setting('lock_timeout') <> '5s'");
  const firstDdl = code.search(/^(ALTER|CREATE)\s/m);
  ok(assertAt > -1 && /RAISE EXCEPTION 'migration is not running inside a single transaction/.test(code) && assertAt < firstDdl, 'fail-closed assertion (SET LOCAL effective) is present and runs before the first DDL statement');
  const userAlters = [...code.matchAll(/ALTER TABLE "users"[^;]*;/g)].map((m) => m[0]);
  ok(userAlters.length === 2 && userAlters.some((a) => /ALTER COLUMN "password_hash" DROP NOT NULL/.test(a)) && userAlters.some((a) => /ADD COLUMN "email_verified_at" TIMESTAMPTZ\(6\)/.test(a)), 'users is altered by exactly: password_hash DROP NOT NULL, ADD email_verified_at');
  ok([...code.matchAll(/^ALTER TABLE "(\w+)"/gm)].every((m) => ['users', 'auth_identities'].includes(m[1])), 'ALTER TABLE only targets users and auth_identities (no other legacy/V2 table)');
  ok([...code.matchAll(/^CREATE TABLE "(\w+)"/gm)].map((m) => m[1]).join() === 'auth_identities', 'CREATE TABLE creates only auth_identities');

  // Server-side identity on the pooled URL, then on the exact direct URL the deploy will use.
  await identity('pooled connection', withTimeouts(url));
  const direct = withTimeouts(directOf(url));
  await identity('direct connection (used by migrate deploy)', direct);

  const prisma = new PrismaClient({ datasources: { db: { url: direct.toString() } }, log: [] });
  try {
    const state = await readOnly(prisma, async (q) => {
      const mig = await q('select migration_name, checksum, finished_at is not null as finished, rolled_back_at is not null as rolled_back from _prisma_migrations order by started_at');
      const cols = await q("select column_name c, is_nullable n from information_schema.columns where table_schema='public' and table_name='users'");
      const snap = await snapshot(q);
      const dups = (await q('select count(*)::int n from (select 1 from users group by lower(email) having count(*)>1) d'))[0].n;
      const nullHash = (await q('select count(*)::int n from users where password_hash is null'))[0].n;
      const lockers = await q("select count(*)::int n from pg_stat_activity where datname=current_database() and state in ('idle in transaction','active') and pid <> pg_backend_pid() and xact_start < now() - interval '30 seconds'");
      return { mig, cols, snap, dups, nullHash, lockers: lockers[0].n };
    });
    ok(JSON.stringify(state.mig.map((m) => m.migration_name)) === JSON.stringify([INIT, V2]), 'development history is exactly [init, add_wellbeing_v2] (new migration pending)');
    ok(state.mig.every((m) => m.finished && !m.rolled_back), 'no failed / unfinished / rolled-back migration rows');
    ok(state.mig[0]?.checksum === CHECKSUM[INIT] && state.mig[1]?.checksum === CHECKSUM[V2], 'recorded checksums of the two applied migrations == local files == production');
    ok(!state.snap.have.has('auth_identities'), 'auth_identities does not exist yet');
    const col = Object.fromEntries(state.cols.map((c) => [c.c, c.n]));
    ok(col.password_hash === 'NO' && col.email === 'NO' && !('email_verified_at' in col), 'users: password_hash NOT NULL, email NOT NULL, email_verified_at absent');
    ok(state.dups === 0, `case-insensitive duplicate email groups: ${state.dups}`);
    ok(state.nullHash === 0, 'no users currently have a NULL password hash');
    ok(state.lockers === 0, `no transaction open longer than 30s that could block the migration (${state.lockers} found)`);
    ok([...LEGACY_TABLES, ...V2_TABLES].every((t) => state.snap.have.has(t)), 'all 11 legacy and 10 V2 tables present');
    const want = definedNames();
    const expectedBefore = { indexes: want.indexes.filter((n) => !/^auth_identities_|^users_email_lower_key$/.test(n)), fks: want.fks.filter((n) => !/^auth_identities_/.test(n)), checks: want.checks.filter((n) => !/^auth_identities_/.test(n)) };
    ok(JSON.stringify(state.snap.indexes) === JSON.stringify(expectedBefore.indexes), `dev indexes == those defined by init+V2 (${state.snap.indexes.length})`);
    ok(JSON.stringify(state.snap.fks) === JSON.stringify(expectedBefore.fks), `dev foreign keys == those defined by init+V2 (${state.snap.fks.length})`);
    ok(JSON.stringify(state.snap.checks) === JSON.stringify(expectedBefore.checks), `dev CHECK constraints == those defined by V2 (${state.snap.checks.length})`);
    info(`PRE-MIGRATION counts: ${JSON.stringify(state.snap.counts)}`);
    info(`PRE-MIGRATION users fingerprint (sha256 of id,email,hash,name,avatar,timestamps): ${state.snap.fingerprint}`);
    return { url, direct, snap: state.snap };
  } finally { await prisma.$disconnect(); }
};

/* ------------------------- post-migration verify ------------------------ */
const verify = async (direct, before) => {
  console.log('\n=== POST-MIGRATION VERIFICATION (read-only) ===');
  await identity('post-check connection', direct);
  const want = definedNames();
  const prisma = new PrismaClient({ datasources: { db: { url: direct.toString() } }, log: [] });
  try {
    await readOnly(prisma, async (q) => {
      const mig = await q('select migration_name, checksum, finished_at is not null as finished, rolled_back_at is not null as rolled_back, applied_steps_count steps from _prisma_migrations order by started_at');
      ok(JSON.stringify(mig.map((m) => m.migration_name)) === JSON.stringify([INIT, V2, NEW]), 'migration history is exactly [init, add_wellbeing_v2, add_auth_identities]');
      ok(mig.every((m) => m.finished && !m.rolled_back), 'no failed / unfinished / rolled-back migrations');
      ok(mig[0]?.checksum === CHECKSUM[INIT] && mig[1]?.checksum === CHECKSUM[V2], 'the two previously applied migrations keep their original checksums');
      ok(mig[2]?.checksum === CHECKSUM[NEW] && Number(mig[2]?.steps) === 1, `new migration recorded with the approved checksum (${CHECKSUM[NEW].slice(0, 16)}…), 1 step`);

      // auth_identities
      const cols = await q("select column_name c, data_type t, is_nullable n from information_schema.columns where table_schema='public' and table_name='auth_identities'");
      const cm = Object.fromEntries(cols.map((c) => [c.c, [c.t, c.n]]));
      ok(cols.length === Object.keys(IDENTITY_COLUMNS).length && Object.entries(IDENTITY_COLUMNS).every(([k, v]) => cm[k] && cm[k][0] === v[0] && cm[k][1] === v[1]), 'auth_identities exists with exactly the 13 expected columns, types and nullability');
      ok((await q('select count(*)::int n from auth_identities'))[0].n === 0, 'auth_identities is empty');
      const fkd = await q("select confdeltype::text d, confupdtype::text u, confrelid::regclass::text t, pg_get_constraintdef(oid) def from pg_constraint where conname='auth_identities_user_id_fkey'");
      ok(fkd.length === 1 && fkd[0].d === 'c' && fkd[0].t === 'users' && /FOREIGN KEY \(user_id\) REFERENCES users\(id\)/.test(fkd[0].def), 'auth_identities.user_id -> users(id) ON DELETE CASCADE');
      const uq = await q("select i.indisunique u, i.indisvalid v, i.indisready r, pg_get_indexdef(i.indexrelid) def from pg_index i join pg_class c on c.oid=i.indexrelid where c.relname='auth_identities_provider_project_sub_key'");
      ok(uq.length === 1 && uq[0].u && uq[0].v && uq[0].r && /\(provider, provider_project, provider_sub\)/.test(uq[0].def), 'unique (provider, provider_project, provider_sub) is valid and ready');

      // users
      const ucols = await q("select column_name c, data_type t, is_nullable n from information_schema.columns where table_schema='public' and table_name='users'");
      const um = Object.fromEntries(ucols.map((c) => [c.c, [c.t, c.n]]));
      ok(um.password_hash?.[1] === 'YES', 'users.password_hash is now nullable');
      ok(um.email?.[1] === 'NO', 'users.email is still NOT NULL');
      ok(um.email_verified_at?.[0] === 'timestamp with time zone' && um.email_verified_at?.[1] === 'YES', 'users.email_verified_at exists (timestamptz, nullable)');
      ok((await q('select count(*)::int n from users where email_verified_at is not null'))[0].n === 0, 'email_verified_at has NO backfill (all NULL)');
      const lo = await q("select i.indisunique u, i.indisvalid v, i.indisready r, pg_get_indexdef(i.indexrelid) def from pg_index i join pg_class c on c.oid=i.indexrelid where c.relname='users_email_lower_key'");
      ok(lo.length === 1 && lo[0].u && lo[0].v && lo[0].r && /\(lower\(email\)\)/.test(lo[0].def), 'users_email_lower_key is a valid, ready UNIQUE index on lower(email)');
      ok((await q('select count(*)::int n from pg_indexes where schemaname=\'public\' and indexname=\'users_email_key\''))[0].n === 1, 'original users_email_key still present');
      ok((await q('select count(*) = count(distinct lower(email)) as same from users'))[0].same === true, 'no two users share a case-insensitive email');

      // Everything defined by the three migrations exists, and nothing else does.
      const after = await snapshot(q);
      ok(JSON.stringify(after.indexes) === JSON.stringify(want.indexes), `indexes == exactly those defined by the three migrations (${after.indexes.length})`);
      ok(JSON.stringify(after.fks) === JSON.stringify(want.fks), `foreign keys == exactly those defined (${after.fks.length})`);
      ok(JSON.stringify(after.checks) === JSON.stringify(want.checks), `CHECK constraints == exactly those defined (${after.checks.length}: 15 V2 + 6 identity)`);
      ok([...LEGACY_TABLES, ...V2_TABLES, 'auth_identities'].every((t) => after.have.has(t)), 'all 11 legacy + 10 V2 tables + auth_identities exist');
      info(`counts: ${JSON.stringify(after.counts)}`);
      if (before) {
        ok(JSON.stringify(after.counts) === JSON.stringify(before.counts), 'every legacy and V2 table row count equals the pre-migration snapshot');
        ok(after.fingerprint === before.fingerprint, 'users fingerprint (ids, emails, password hashes, names, timestamps) identical to pre-migration');
      } else if (opt('expect-users-fingerprint')) {
        ok(after.fingerprint === opt('expect-users-fingerprint'), 'users fingerprint equals the one supplied from the preflight run');
      } else info(`users fingerprint now: ${after.fingerprint} (pass --expect-users-fingerprint <pre-migration value> to compare)`);
      ok((await q('select count(*)::int n from users where password_hash is null'))[0].n === 0, 'no existing user has a NULL password hash (all historic web logins still possible)');
    });

    if (flag('functional-probe')) {
      console.log('\n--- functional probe (single transaction, ALWAYS rolled back; synthetic rows only) ---');
      const ROLLBACK = new Error('__rollback__');
      const res = [];
      try {
        await prisma.$transaction(async (tx) => {
          const x = (s) => tx.$executeRawUnsafe(s);
          const tag = `zz-probe-${crypto.randomUUID()}`;
          const expectViolation = async (label, sql, re) => {
            await x('SAVEPOINT p');
            try { await x(sql); res.push([false, `${label} (was ACCEPTED)`]); await x('ROLLBACK TO SAVEPOINT p'); }
            catch (e) { res.push([re.test(String(e.message)), `${label} -> rejected`]); await x('ROLLBACK TO SAVEPOINT p'); }
          };
          await x(`INSERT INTO users (id,email,password_hash,updated_at) VALUES ('${tag}-a','${tag}.A@example.invalid',NULL,now())`);
          res.push([true, 'a user with NULL password_hash and NULL email_verified_at can be created']);
          await expectViolation('case-variant duplicate email', `INSERT INTO users (id,email,password_hash,updated_at) VALUES ('${tag}-b','${tag}.a@EXAMPLE.invalid','x',now())`, /users_email_lower_key/);
          await x(`INSERT INTO auth_identities (user_id,provider,provider_project,provider_sub,link_method) VALUES ('${tag}-a','firebase','probe-project','${tag}','created')`);
          await expectViolation('duplicate (provider, project, sub)', `INSERT INTO auth_identities (user_id,provider,provider_project,provider_sub,link_method) VALUES ('${tag}-a','firebase','probe-project','${tag}','created')`, /auth_identities_provider_project_sub_key/);
          await expectViolation("link_method 'email'", `INSERT INTO auth_identities (user_id,provider,provider_project,provider_sub,link_method) VALUES ('${tag}-a','firebase','probe-project','${tag}-2','email')`, /link_method_allowed/);
          await x(`DELETE FROM users WHERE id='${tag}-a'`);
          const left = await tx.$queryRawUnsafe(`select count(*)::int n from auth_identities where provider_project='probe-project'`);
          res.push([left[0].n === 0, 'deleting the user cascaded to its identity']);
          throw ROLLBACK;
        }, { timeout: 60000, maxWait: 60000 });
      } catch (e) { if (e !== ROLLBACK) { res.push([false, `probe aborted: ${String(e.message).split('\n').pop().slice(0, 120)}`]); } }
      for (const [c, m] of res) ok(c, m);
      const leftover = await readOnly(prisma, async (q) => (await q("select (select count(*)::int from users where id like 'zz-probe-%') u, (select count(*)::int from auth_identities) i"))[0]);
      ok(leftover.u === 0 && leftover.i === 0, 'probe transaction rolled back: no probe rows remain');
    }
  } finally { await prisma.$disconnect(); }

  const st = cli(['migrate', 'status', '--schema', schemaFile], direct);
  ok(st.status === 0 && /up to date/i.test(st.out), '`prisma migrate status`: database schema is up to date');
  const df = cli(['migrate', 'diff', '--from-url', direct.toString(), '--to-schema-datamodel', schemaFile, '--script'], direct);
  const stmts = df.out.split('\n').map((l) => l.trim()).filter((l) => /^(ALTER|CREATE|DROP)\b/i.test(l));
  const cosmetic = stmts.filter((l) => /^ALTER TABLE "\w+" ALTER COLUMN "id" SET DEFAULT gen_random_uuid\(\)::text;$/.test(l));
  const other = stmts.filter((l) => !cosmetic.includes(l));
  for (const o of other) info(`UNEXPECTED DRIFT: ${o}`);
  ok(df.status === 0 && other.length === 0, `drift vs schema.prisma limited to Prisma's known cosmetic uuid-default noise (${cosmetic.length} of ${stmts.length}); users_email_lower_key not flagged`);
};

/* -------------------------------- main --------------------------------- */
const main = async () => {
  const execute = flag('execute');
  if (execute && flag('verify-only')) stop('--execute and --verify-only are mutually exclusive.');
  if (unknown.length) stop(`unknown option(s): ${unknown.join(' ')}`);

  if (flag('verify-only')) {
    const url = parseUrl(process.env.DATABASE_URL || '');
    if (!url) stop('DATABASE_URL missing.');
    if (endpointOf(url) === PROD.endpoint) stop('production endpoint refused.');
    await verify(withTimeouts(directOf(url)), null);
  } else {
    const ctx = await preflight();
    if (failures) stop(`${failures} preflight check(s) failed.`);

    if (!execute) {
      console.log('\nPREFLIGHT PASSED. Dry run only: nothing was changed.');
      console.log('To execute, the operator must pass ALL of:');
      console.log(`  --execute --confirm-branch ${DEV.branch} --recovery-point <NEW branch id> --confirm-recovery-verified --confirm-not-default --confirm-checksum ${CHECKSUM[NEW].slice(0, 16)}`);
      return;
    }

    console.log('\n=== EXECUTION GATES ===');
    ok(opt('confirm-branch') === DEV.branch, `--confirm-branch equals ${DEV.branch}`);
    const rp = opt('recovery-point');
    ok(!!rp && /^br-[a-z0-9]+(-[a-z0-9]+)+$/.test(rp), `--recovery-point is a Neon branch id: "${rp ?? ''}"`);
    ok(![PROD.branch, DEV.branch, OLD_RECOVERY].includes(rp), `--recovery-point is a NEW branch (not production, development or the old recovery branch ${OLD_RECOVERY})`);
    ok(flag('confirm-recovery-verified'), '--confirm-recovery-verified: operator confirms in the Neon console that the new recovery branch exists, was created from development AFTER the last schema change and BEFORE this run');
    ok(flag('confirm-not-default'), '--confirm-not-default: operator confirmed the development branch is not the Neon default/production branch');
    ok((opt('confirm-checksum') || '') === CHECKSUM[NEW].slice(0, 16), '--confirm-checksum matches the approved migration checksum');
    if (failures) stop('execution gates not satisfied.');

    console.log('\n=== APPLYING (prisma migrate deploy, direct connection) ===');
    const r = cli(['migrate', 'deploy', '--schema', schemaFile], ctx.direct);
    console.log(r.out.split('\n').filter((l) => l.trim() && !/Update available|pris\.ly|npm i|^[┌│└]/.test(l)).join('\n'));
    if (r.status !== 0) stop(`prisma migrate deploy exited with status ${r.status}. The migration is a single transaction so the schema should be unchanged, but Prisma may have recorded a FAILED row in _prisma_migrations. Do not retry or run "migrate resolve" without review.`);
    ok(true, 'prisma migrate deploy completed');
    await verify(ctx.direct, ctx.snap);
  }
  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
  if (failures) process.exit(1);
};

main().catch((e) => stop(`unexpected error: ${String(e.message).split('\n').filter(Boolean).pop().slice(0, 200)}`));
