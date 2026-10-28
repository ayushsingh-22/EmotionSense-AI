#!/usr/bin/env node
/**
 * Guarded runner: apply Prisma migration `20261016120000_add_auth_link_challenges` (Phase 2B.5B.1)
 * to the DEVELOPMENT Neon branch ONLY.
 *
 * Modes (run from backend/):
 *   node scripts/dev-link-challenges-migrate.mjs                    -> PREFLIGHT ONLY (default; read-only)
 *   node scripts/dev-link-challenges-migrate.mjs --verify-only      -> post-migration verification (read-only)
 *   node scripts/dev-link-challenges-migrate.mjs --execute \
 *        --fresh-development --confirm-fresh-development \
 *        --confirm-empty-development-no-backup \
 *        --confirm-branch br-ancient-snow-b3si0kwz \
 *        --confirm-not-default \
 *        --confirm-checksum <first 16 hex chars of the approved migration sha256>
 *                                                                   -> one-time empty-Development migration only
 *
 * With only Production and Development branches remaining, the explicit
 * --confirm-empty-development-no-backup acknowledgment accepts the one-time risk
 * only after the empty-Development preflight passes. It is not a general backup bypass.
 *
 * Hard guarantees (same model as dev-identity-migrate.mjs):
 *  - The only database-changing command is the fixed `prisma migrate deploy` invocation
 *    below, reachable only through the empty-Development gates. No reset / db push /
 *    migrate resolve / manual SQL / rollback path exists here.
 *  - Production (unapproved-branch-one / unapproved-endpoint) is refused by hostname,
 *    env pin and the ids the server itself reports, on the pooled and the direct connection.
 *  - The approved SQL is pinned by SHA-256: any edit to the migration file blocks execution.
 *  - On any failure it reports and STOPS: no retries, no rollback, no edits to _prisma_migrations.
 *  - Never prints credentials, emails, provider subjects or password hashes (only counts and digests).
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { validateFreshInventory } from './freshDevelopmentGuard.mjs';

/* ------------------------------ constants ------------------------------ */
const DEV = { branch: 'br-ancient-snow-b3si0kwz', endpoint: 'ep-cold-hill-b3lffx1r', project: 'fancy-union-28873755' };
const PROD = { branch: 'unapproved-branch-one', endpoint: 'unapproved-endpoint' };
const APPLIED = {
  '20260923032421_init': '99889bdb34d50b0de97a17e25d926b0947dc4c1c9e4d42297158e3640d47ef9f',
  '20261012181122_add_wellbeing_v2': 'd4657ac71f55ab0b81e960ae645f0bbfedc0ab331cf022fbb4307d646f29bcc7',
  '20261014120000_add_auth_identities': '99c5fdb6c09edfc3add368fc3eb108bfd4dcf03407b464485f0280a5eaefb384'
};
const NEW = '20261016120000_add_auth_link_challenges';
// The APPROVED SQL. Changing a single byte of the migration invalidates this pin.
const NEW_CHECKSUM = '475bce9c7ddea4a616c13e7d11fb74da1469db52f08916fb858b3cd1a5f8dd5f';
// Read-only Development baseline captured after the approved data cleanup.
const PRE_MIGRATION_SCHEMA_DIGEST = '342063aec7f1bae322e68e71bf6e27331e835421e688899bf85f5dab1df71bd6';

const TABLE = 'auth_link_challenges';
const TABLE_COLUMNS = {
  id: ['text', 'NO'], challenge_hash: ['text', 'NO'], user_id: ['text', 'NO'], provider: ['text', 'NO'],
  provider_project: ['text', 'NO'], provider_sub: ['text', 'NO'], purpose: ['text', 'NO'], credential_fingerprint: ['text', 'NO'],
  created_at: ['timestamp with time zone', 'NO'], expires_at: ['timestamp with time zone', 'NO'], consumed_at: ['timestamp with time zone', 'YES']
};
const COUNTED_TABLES = ['users', 'auth_identities', 'chat_sessions', 'messages', 'emergency_contacts', 'safety_alerts', 'emotion_analysis',
  'emotion_flow_segments', 'daily_emotion_summary', 'weekly_emotion_summary', 'master_user_activity', 'alert_logs', 'user_preferences',
  'user_consents', 'mood_checkins', 'journal_entries', 'media_assets', 'content_items', 'activity_sessions', 'activity_feedback',
  'recommendation_runs', 'recommendation_items'];

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
const known = new Set(['--execute', '--verify-only', '--fresh-development', '--confirm-fresh-development',
  '--confirm-empty-development-no-backup', '--confirm-branch', '--confirm-not-default', '--confirm-checksum']);
const unknown = args.filter((a) => a.startsWith('--') && !known.has(a));
let failures = 0;
const ok = (c, m) => { if (!c) failures += 1; console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); };
const info = (m) => console.log(`      ${m}`);
const stop = (m) => { console.log(`\nSTOP: ${m}\nNothing further was attempted. No rollback or manual repair was performed.`); process.exit(1); };
export const executionGateProblems = ({
  execute = false,
  freshDevelopment = false,
  confirmFreshDevelopment = false,
  confirmEmptyDevelopmentNoBackup = false,
  confirmBranch,
  confirmNotDefault = false,
  confirmChecksum
}) => {
  const problems = [];
  if (!execute) problems.push('actual execution requires --execute');
  if (!freshDevelopment) problems.push('--fresh-development is required for the one-time empty-Development path');
  if (!confirmFreshDevelopment) problems.push('--confirm-fresh-development is required');
  if (!confirmEmptyDevelopmentNoBackup) problems.push('--confirm-empty-development-no-backup is required');
  if (confirmBranch !== DEV.branch) problems.push(`--confirm-branch must equal ${DEV.branch}`);
  if (!confirmNotDefault) problems.push('--confirm-not-default is required');
  if (confirmChecksum !== NEW_CHECKSUM.slice(0, 16)) problems.push('migration checksum confirmation is incorrect');
  return problems;
};
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const fileSha = (f) => sha(fs.readFileSync(f));
const parseUrl = (s) => { try { return new URL(s); } catch { return null; } };
const withTimeouts = (u) => { const c = new URL(u.toString()); c.searchParams.set('connect_timeout', '60'); c.searchParams.set('pool_timeout', '60'); return c; };
const directOf = (u) => { const c = new URL(u.toString()); c.hostname = c.hostname.replace('-pooler', ''); return c; };
const endpointOf = (u) => u.hostname.split('.')[0].replace('-pooler', '');
const stripComments = (s) => s.split(/\r?\n/).filter((l) => !l.trim().startsWith('--')).join('\n');

const readOnly = (prisma, fn) => prisma.$transaction(async (tx) => {
  await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
  return fn((s) => tx.$queryRawUnsafe(s));
}, { timeout: 120000, maxWait: 120000 });

const cli = (cliArgs, url) => {
  const entry = path.join(backendDir, 'node_modules', 'prisma', 'build', 'index.js');
  const r = spawnSync(process.execPath, [entry, ...cliArgs], { cwd: backendDir, env: { ...process.env, DATABASE_URL: url.toString() }, encoding: 'utf8' });
  const scrub = (t) => (t || '').replace(/postgres(ql)?:\/\/[^\s"']+/g, 'postgresql://***');
  return { status: r.status, out: scrub(`${r.stdout || ''}${r.stderr || ''}`) };
};

/** Index / FK / CHECK names defined by the given migration files (to prove nothing pre-existing disappears). */
const definedNames = (list) => {
  const all = list.map((n) => stripComments(fs.readFileSync(migFile(n), 'utf8'))).join('\n');
  return {
    indexes: [...new Set([...[...all.matchAll(/CREATE (?:UNIQUE )?INDEX "(\w+)"/g)].map((m) => m[1]),
      ...[...all.matchAll(/CONSTRAINT "(\w+)" PRIMARY KEY/g)].map((m) => m[1])])].sort(),
    fks: [...all.matchAll(/ADD CONSTRAINT "(\w+)" FOREIGN KEY/g)].map((m) => m[1]).sort(),
    checks: [...all.matchAll(/ADD CONSTRAINT "(\w+)" CHECK/g)].map((m) => m[1]).sort()
  };
};

const refuseIds = (label, id) => {
  if (id.branch === PROD.branch || id.endpoint === PROD.endpoint) stop(`${label} is the PRODUCTION branch/endpoint. Refusing unconditionally.`);
};

const identity = async (label, url) => {
  const prisma = new PrismaClient({ datasources: { db: { url: url.toString() } }, log: [] });
  try {
    const id = await readOnly(prisma, async (q) => (await q(
      "select current_setting('neon.branch_id',true) branch, current_setting('neon.endpoint_id',true) endpoint, current_setting('neon.project_id',true) project, current_setting('transaction_read_only') ro"))[0]);
    info(`${label}: server reports branch=${id.branch} endpoint=${id.endpoint} project=${id.project}`);
    refuseIds(label, id);
    ok(id.branch === DEV.branch, `${label}: branch id == ${DEV.branch}`);
    ok(id.endpoint === DEV.endpoint, `${label}: endpoint == ${DEV.endpoint}`);
    ok(id.project === DEV.project, `${label}: project == ${DEV.project}`);
    ok(id.ro === 'on', `${label}: inspection transaction is READ ONLY`);
  } finally { await prisma.$disconnect(); }
};

/**
 * Catalog part of a snapshot: works on ANY schema version (only information_schema / pg_catalog / _prisma_migrations),
 * so schema drift can be reported without querying columns that may not exist.
 */
const catalogSnapshot = async (q) => {
  const have = new Set((await q("select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE'")).map((r) => r.table_name));
  const names = async (s) => (await q(s)).map((r) => r.n).sort();
  const migrations = have.has('_prisma_migrations')
    ? (await q('select migration_name, checksum, finished_at is not null as finished, rolled_back_at is not null as rolled_back from _prisma_migrations order by migration_name'))
      .map((m) => `${m.migration_name}:${m.checksum}:${m.finished}:${m.rolled_back}`)
    : [];
  const schemaRows = [
    ...(await q("select table_name, column_name, data_type, is_nullable, coalesce(column_default,'') d from information_schema.columns where table_schema='public' and table_name <> '_prisma_migrations' order by 1,2")),
    ...(await q("select c.conname, pg_get_constraintdef(c.oid) d from pg_constraint c where c.connamespace='public'::regnamespace order by 1")),
    ...(await q("select indexname, indexdef from pg_indexes where schemaname='public' and tablename <> '_prisma_migrations' order by 1"))
  ];
  const idTables = (await q("select table_name n from information_schema.columns where table_schema='public' and column_name='id' and table_name <> '_prisma_migrations' order by 1")).map((r) => r.n);
  return {
    have, migrations, idTables,
    schemaDigest: sha(JSON.stringify(schemaRows)),
    indexes: await names("select indexname n from pg_indexes where schemaname='public' and tablename <> '_prisma_migrations'"),
    fks: await names("select conname n from pg_constraint where contype='f' and connamespace='public'::regnamespace"),
    checks: await names("select conname n from pg_constraint where contype='c' and connamespace='public'::regnamespace")
  };
};

/** Primary-key sets (ids only, never printed) of every table with an `id` column. Schema-independent. */
const idSets = async (q, idTables) => {
  const out = {};
  for (const t of idTables) out[t] = new Set((await q(`select id::text id from "${t}"`)).map((r) => r.id));
  return out;
};

/**
 * Data part of a snapshot: counts and row digests. Uses CURRENT-schema columns (users.email_verified_at,
 * auth_identities), so it may only run on a database whose catalog already equals development's.
 */
const dataSnapshot = async (q, cat) => {
  const counts = {};
  for (const t of COUNTED_TABLES) if (cat.have.has(t)) counts[t] = (await q(`select count(*)::int c from "${t}"`))[0].c;
  const users = await q('select id, email, password_hash, full_name, avatar_url, email_verified_at, created_at, updated_at from users order by id');
  const identities = await q('select id, user_id, provider, provider_project, provider_sub, sign_in_method, email_at_link, email_verified, link_method, created_at, updated_at, last_login_at, disabled_at from auth_identities order by id');
  return { counts, usersDigest: sha(JSON.stringify(users)), identitiesDigest: sha(JSON.stringify(identities)) };
};

/** Full snapshot of the migration TARGET (development, current schema). */
const snapshot = async (q) => {
  const cat = await catalogSnapshot(q);
  return { ...cat, ...(await dataSnapshot(q, cat)), ids: await idSets(q, cat.idTables) };
};

/* ------------------------------ preflight ------------------------------ */
const preflight = async (freshDevelopment = false) => {
  console.log('\n=== PREFLIGHT (read-only) ===');
  if (unknown.length) stop(`unknown option(s): ${unknown.join(' ')}`);
  ok(!/[\\/]\.claude[\\/]worktrees[\\/]/i.test(backendDir), 'running from the main repo backend/, not a worktree');
  ok(path.basename(backendDir) === 'backend' && fs.existsSync(schemaFile), 'working directory is <repo>/backend with the canonical prisma/schema.prisma');

  const url = parseUrl(process.env.DATABASE_URL || '');
  if (!url) stop('DATABASE_URL is missing or unparsable.');
  const ep = endpointOf(url);
  info(`configured endpoint: ${ep}${url.hostname.includes('-pooler') ? ' (pooled)' : ''}, database ${url.pathname.slice(1)}`);
  if (ep === PROD.endpoint || url.hostname.includes(PROD.endpoint)) stop('configured DATABASE_URL points at the PRODUCTION endpoint. Refusing unconditionally.');
  ok(ep === DEV.endpoint, `configured endpoint == ${DEV.endpoint}`);
  ok(!url.searchParams.get('schema'), 'no ?schema= override in DATABASE_URL');
  const pin = process.env.EXPECTED_NEON_BRANCH_ID;
  if (pin === PROD.branch) stop('EXPECTED_NEON_BRANCH_ID is production. Refusing.');
  ok(pin === DEV.branch, `EXPECTED_NEON_BRANCH_ID == ${DEV.branch}`);

  const dirs = fs.readdirSync(migrationsDir).filter((f) => /^\d{14}_/.test(f)).sort();
  ok(JSON.stringify(dirs) === JSON.stringify([...Object.keys(APPLIED), NEW]), `local migrations are exactly the 3 applied + ${NEW}, in timestamp order`);
  for (const [n, sum] of Object.entries(APPLIED)) ok(fileSha(migFile(n)) === sum, `${n} unchanged (checksum == recorded)`);
  const newSha = fileSha(migFile(NEW));
  info(`new migration sha256 = ${newSha}`);
  ok(newSha === NEW_CHECKSUM, 'new migration.sql matches the APPROVED checksum pinned in this script');
  ok(!fs.readFileSync(migFile(NEW)).includes(13), 'new migration is LF-only');

  const code = stripComments(fs.readFileSync(migFile(NEW), 'utf8')).replace(/ON (DELETE|UPDATE) (CASCADE|RESTRICT|SET NULL|NO ACTION)/g, '');
  const forbidden = code.match(/\b(DROP|DELETE|TRUNCATE|UPDATE|INSERT|RENAME|GRANT|REVOKE|CREATE\s+(?:EXTENSION|ROLE|SCHEMA|FUNCTION|TRIGGER)|ALTER\s+(?:ROLE|SYSTEM|DATABASE))(?![A-Za-z0-9_])/gi);
  ok(!forbidden, `migration SQL contains no destructive/privileged statements${forbidden ? ` (found: ${[...new Set(forbidden)].join(', ')})` : ''}`);
  ok([...code.matchAll(/^ALTER TABLE "(\w+)"/gm)].every((m) => m[1] === TABLE), `ALTER TABLE only targets ${TABLE} (no existing table altered)`);
  ok([...code.matchAll(/^CREATE TABLE "(\w+)"/gm)].map((m) => m[1]).join() === TABLE, `CREATE TABLE creates only ${TABLE}`);
  ok((code.match(/\bDO\s+\$\$/g) || []).length === 1 && /SET LOCAL lock_timeout = '5s'/.test(code) && !/^\s*SET\s+(?!LOCAL)/m.test(code),
    'fail-closed preamble: SET LOCAL timeouts + exactly one DO assertion, no session-level SET');
  ok(code.indexOf("current_setting('lock_timeout') <> '5s'") < code.indexOf('CREATE TABLE'), 'assertion runs before the first DDL statement');

  await identity('pooled connection', withTimeouts(url));
  const direct = withTimeouts(directOf(url));
  await identity('direct connection (used by migrate deploy)', direct);

  const prisma = new PrismaClient({ datasources: { db: { url: direct.toString() } }, log: [] });
  try {
    const state = await readOnly(prisma, async (q) => {
      const mig = await q('select migration_name, checksum, finished_at is not null as finished, rolled_back_at is not null as rolled_back from _prisma_migrations order by started_at');
      const snap = await snapshot(q);
      const lockers = await q("select count(*)::int n from pg_stat_activity where datname=current_database() and state in ('idle in transaction','active') and pid <> pg_backend_pid() and xact_start < now() - interval '30 seconds'");
      return { mig, snap, lockers: lockers[0].n };
    });
    ok(JSON.stringify(state.mig.map((m) => m.migration_name)) === JSON.stringify(Object.keys(APPLIED)), 'development history is exactly the 3 applied migrations (new one pending)');
    ok(state.mig.every((m) => m.finished && !m.rolled_back), 'no failed / unfinished / rolled-back migration rows');
    ok(state.mig.every((m) => m.checksum === APPLIED[m.migration_name]), 'recorded checksums == local files');
    ok(!state.snap.have.has(TABLE), `${TABLE} does not exist yet`);
    ok(state.snap.have.has('auth_identities') && state.snap.have.has('users'), 'users and auth_identities present');
    ok(state.lockers === 0, `no transaction open longer than 30s that could block the migration (${state.lockers} found)`);
    const want = definedNames(Object.keys(APPLIED));
    ok(JSON.stringify(state.snap.indexes) === JSON.stringify(want.indexes), `indexes == those defined by the 3 applied migrations (${state.snap.indexes.length})`);
    ok(JSON.stringify(state.snap.fks) === JSON.stringify(want.fks), `foreign keys == defined (${state.snap.fks.length})`);
    ok(JSON.stringify(state.snap.checks) === JSON.stringify(want.checks), `CHECK constraints == defined (${state.snap.checks.length})`);
    ok(state.snap.schemaDigest === PRE_MIGRATION_SCHEMA_DIGEST, 'pre-migration schema digest matches the verified empty-Development baseline');
    if (freshDevelopment) {
      const expectedMigrations = Object.entries(APPLIED).map(([name, checksum]) => `${name}:${checksum}:true:false`);
      const freshProblems = validateFreshInventory({
        tableNames: [...state.snap.have],
        counts: state.snap.counts,
        migrations: state.snap.migrations,
        expectedMigrations,
        pendingTablePresent: state.snap.have.has(TABLE),
        writers: state.lockers
      });
      for (const problem of freshProblems) ok(false, `fresh-development safety contract: ${problem}`);
      ok(freshProblems.length === 0, 'fresh-development safety contract is satisfied');
    }
    info(`PRE-MIGRATION counts: ${JSON.stringify(state.snap.counts)}`);
    info(`PRE-MIGRATION users digest: ${state.snap.usersDigest}`);
    info(`PRE-MIGRATION identities digest: ${state.snap.identitiesDigest}`);
    info(`PRE-MIGRATION schema digest: ${state.snap.schemaDigest.slice(0, 16)}…`);
    return { direct, snap: state.snap };
  } finally { await prisma.$disconnect(); }
};

/* ------------------------- post-migration verify ------------------------ */
const verify = async (direct, before) => {
  console.log('\n=== POST-MIGRATION VERIFICATION (read-only) ===');
  await identity('post-check connection', direct);
  const want = definedNames([...Object.keys(APPLIED), NEW]);
  const prisma = new PrismaClient({ datasources: { db: { url: direct.toString() } }, log: [] });
  try {
    await readOnly(prisma, async (q) => {
      const mig = await q('select migration_name, checksum, finished_at is not null as finished, rolled_back_at is not null as rolled_back, applied_steps_count steps from _prisma_migrations order by started_at');
      ok(JSON.stringify(mig.map((m) => m.migration_name)) === JSON.stringify([...Object.keys(APPLIED), NEW]), 'migration history is exactly the 3 applied + the new migration');
      ok(mig.every((m) => m.finished && !m.rolled_back), 'no failed / unfinished / rolled-back migrations');
      ok(mig.slice(0, 3).every((m) => m.checksum === APPLIED[m.migration_name]), 'earlier migrations keep their original checksums');
      ok(mig[3]?.checksum === NEW_CHECKSUM && Number(mig[3]?.steps) === 1, `new migration recorded with the approved checksum (${NEW_CHECKSUM.slice(0, 16)}…), 1 step`);

      const cols = await q(`select column_name c, data_type t, is_nullable n from information_schema.columns where table_schema='public' and table_name='${TABLE}'`);
      const cm = Object.fromEntries(cols.map((c) => [c.c, [c.t, c.n]]));
      ok(cols.length === Object.keys(TABLE_COLUMNS).length && Object.entries(TABLE_COLUMNS).every(([k, v]) => cm[k] && cm[k][0] === v[0] && cm[k][1] === v[1]),
        `${TABLE} has exactly the ${Object.keys(TABLE_COLUMNS).length} expected columns, types and nullability`);
      ok((await q(`select count(*)::int n from "${TABLE}"`))[0].n === 0, `${TABLE} is empty`);
      const fk = await q(`select confdeltype::text d, confrelid::regclass::text t from pg_constraint where conname='auth_link_challenges_user_id_fkey'`);
      ok(fk.length === 1 && fk[0].d === 'c' && fk[0].t === 'users', `${TABLE}.user_id -> users(id) ON DELETE CASCADE`);
      const uq = await q(`select i.indisunique u, i.indisvalid v, i.indisready r from pg_index i join pg_class c on c.oid=i.indexrelid where c.relname='auth_link_challenges_challenge_hash_key'`);
      ok(uq.length === 1 && uq[0].u && uq[0].v && uq[0].r, 'unique challenge_hash index is valid and ready');

      const after = await snapshot(q);
      ok(JSON.stringify(after.indexes) === JSON.stringify(want.indexes), `indexes == exactly those defined by the 4 migrations (${after.indexes.length})`);
      ok(JSON.stringify(after.fks) === JSON.stringify(want.fks), `foreign keys == exactly those defined (${after.fks.length})`);
      ok(JSON.stringify(after.checks) === JSON.stringify(want.checks), `CHECK constraints == exactly those defined (${after.checks.length})`);
      info(`counts: ${JSON.stringify(after.counts)}`);
      info(`users digest: ${after.usersDigest} | identities digest: ${after.identitiesDigest}`);
      if (before) {
        ok(JSON.stringify(after.counts) === JSON.stringify(before.counts), 'every pre-existing table row count equals the pre-migration snapshot');
        ok(after.usersDigest === before.usersDigest, 'users rows (ids, emails, hashes, verification, timestamps) identical to pre-migration');
        ok(after.identitiesDigest === before.identitiesDigest, 'auth_identities rows identical to pre-migration');
      }
    });
  } finally { await prisma.$disconnect(); }

  const st = cli(['migrate', 'status', '--schema', schemaFile], direct);
  ok(st.status === 0 && /up to date/i.test(st.out), '`prisma migrate status`: database schema is up to date');
  const df = cli(['migrate', 'diff', '--from-url', direct.toString(), '--to-schema-datamodel', schemaFile, '--script'], direct);
  const stmts = df.out.split('\n').map((l) => l.trim()).filter((l) => /^(ALTER|CREATE|DROP)\b/i.test(l));
  const cosmetic = stmts.filter((l) => /^ALTER TABLE "\w+" ALTER COLUMN "id" SET DEFAULT gen_random_uuid\(\)::text;$/.test(l));
  const other = stmts.filter((l) => !cosmetic.includes(l));
  for (const o of other) info(`UNEXPECTED DRIFT: ${o}`);
  ok(df.status === 0 && other.length === 0, `drift vs schema.prisma limited to the known cosmetic uuid-default noise (${cosmetic.length} of ${stmts.length})`);
};

/* -------------------------------- main --------------------------------- */
const main = async () => {
  const execute = flag('execute');
  const freshDevelopment = flag('fresh-development');
  if (execute && flag('verify-only')) stop('--execute and --verify-only are mutually exclusive.');
  if (unknown.length) stop(`unknown option(s): ${unknown.join(' ')}`);

  if (flag('verify-only')) {
    const url = parseUrl(process.env.DATABASE_URL || '');
    if (!url) stop('DATABASE_URL missing.');
    if (endpointOf(url) === PROD.endpoint) stop('production endpoint refused.');
    await verify(withTimeouts(directOf(url)), null);
  } else {
    const ctx = await preflight(freshDevelopment);
    if (failures) stop(`${failures} preflight check(s) failed.`);
    if (!execute) {
      console.log('\nPREFLIGHT PASSED. Dry run only: nothing was changed.');
      if (freshDevelopment) {
        console.log('Fresh-development mode never performs cleanup. After separately approved cleanup and a new preflight, execution requires:');
        console.log(`  --fresh-development --execute --confirm-fresh-development --confirm-empty-development-no-backup --confirm-branch ${DEV.branch} --confirm-not-default --confirm-checksum ${NEW_CHECKSUM.slice(0, 16)}`);
      } else {
        console.log('To execute, the operator must pass ALL of:');
        console.log(`  --fresh-development --execute --confirm-fresh-development --confirm-empty-development-no-backup --confirm-branch ${DEV.branch} --confirm-not-default --confirm-checksum ${NEW_CHECKSUM.slice(0, 16)}`);
      }
      return;
    }
    console.log('\n=== EXECUTION GATES ===');
    const gateProblems = executionGateProblems({
      execute,
      freshDevelopment,
      confirmFreshDevelopment: flag('confirm-fresh-development'),
      confirmEmptyDevelopmentNoBackup: flag('confirm-empty-development-no-backup'),
      confirmBranch: opt('confirm-branch'),
      confirmNotDefault: flag('confirm-not-default'),
      confirmChecksum: opt('confirm-checksum') || ''
    });
    for (const problem of gateProblems) ok(false, problem);
    if (gateProblems.length) stop('execution gates not satisfied.');

    console.log('\n=== APPLYING (prisma migrate deploy, direct connection) ===');
    const r = cli(['migrate', 'deploy', '--schema', schemaFile], ctx.direct);
    console.log(r.out.split('\n').filter((l) => l.trim() && !/Update available|pris\.ly|npm i|^[┌│└]/.test(l)).join('\n'));
    if (r.status !== 0) stop(`prisma migrate deploy did not complete successfully (status ${r.status ?? 'unknown'}). Do not retry or run migrate resolve without review.`);
    ok(true, 'prisma migrate deploy completed');
    await verify(ctx.direct, ctx.snap);
  }
  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
  if (failures) process.exit(1);
};

// Run only when executed directly (the pure helpers above are imported by tests).
const samePath = (a, b) => (process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b);
if (process.argv[1] && samePath(path.resolve(process.argv[1]), fileURLToPath(import.meta.url))) {
  console.error('This historical migration runner is retired. Use reviewed Prisma migrations only.'); process.exitCode = 1;
}
