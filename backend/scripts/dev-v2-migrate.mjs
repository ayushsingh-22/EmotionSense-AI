#!/usr/bin/env node
/**
 * Guarded runner: apply the EXISTING, UNCHANGED Prisma migration
 * `20261012181122_add_wellbeing_v2` to the DEVELOPMENT Neon branch only.
 *
 * Modes (run from backend/):
 *   node scripts/dev-v2-migrate.mjs                 -> preflight only (read-only, default)
 *   node scripts/dev-v2-migrate.mjs --verify-only   -> post-migration verification only (read-only)
 *   node scripts/dev-v2-migrate.mjs --execute \
 *        --confirm-branch br-ancient-snow-b3si0kwz \
 *        --recovery-point "<neon branch name/id or snapshot>" \
 *        --confirm-not-default
 *                                                   -> preflight, `prisma migrate deploy`, verification
 *
 * Hard guarantees:
 *  - The ONLY database-changing command ever spawned is `prisma migrate deploy`
 *    (fixed argv, no shell). There is no reset / db push / manual SQL / rollback path.
 *  - Production branch unapproved-branch-one and endpoint unapproved-endpoint are refused
 *    unconditionally: by hostname, by env pin, and by the ids the server itself reports,
 *    on both the pooled and the direct connection, before and after the deploy.
 *  - On any failure it reports and STOPS. It never retries, rolls back or edits
 *    _prisma_migrations.
 *  - Credentials are never printed.
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

/* ------------------------------ constants ------------------------------ */
const DEV = { branch: 'br-ancient-snow-b3si0kwz', endpoint: 'ep-cold-hill-b3lffx1r', project: 'fancy-union-28873755' };
const PROD = { branch: 'unapproved-branch-one', endpoint: 'unapproved-endpoint' };
const MIGRATION = '20261012181122_add_wellbeing_v2';
const INIT = '20260923032421_init';
// Checksums recorded in PRODUCTION's _prisma_migrations (confirmed read-only).
const EXPECTED_CHECKSUM = {
  [INIT]: '99889bdb34d50b0de97a17e25d926b0947dc4c1c9e4d42297158e3640d47ef9f',
  [MIGRATION]: 'd4657ac71f55ab0b81e960ae645f0bbfedc0ab331cf022fbb4307d646f29bcc7'
};
const V2_TABLES = ['user_preferences', 'user_consents', 'mood_checkins', 'journal_entries', 'media_assets',
  'content_items', 'activity_sessions', 'activity_feedback', 'recommendation_runs', 'recommendation_items'];
const LEGACY_TABLES = ['users', 'chat_sessions', 'messages', 'emergency_contacts', 'safety_alerts', 'emotion_analysis',
  'emotion_flow_segments', 'daily_emotion_summary', 'weekly_emotion_summary', 'master_user_activity', 'alert_logs'];
const EXPECT_COUNTS = { checks: 15, indexes: 11, fks: 12, tables: 10 };

const here = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(here, '..');
const repoRoot = path.resolve(backendDir, '..');
const migrationFile = path.join(repoRoot, 'prisma', 'migrations', MIGRATION, 'migration.sql');
const schemaFile = path.join(repoRoot, 'prisma', 'schema.prisma');

/* ------------------------------- helpers ------------------------------- */
const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const opt = (n) => { const i = args.indexOf(`--${n}`); return i > -1 ? args[i + 1] : undefined; };
const known = new Set(['--execute', '--verify-only', '--confirm-branch', '--recovery-point', '--confirm-not-default']);
const unknown = args.filter((a, i) => a.startsWith('--') && !known.has(a));
let failures = 0;
const pass = (m) => console.log(`PASS  ${m}`);
const fail = (m) => { failures += 1; console.log(`FAIL  ${m}`); };
const info = (m) => console.log(`      ${m}`);
const ok = (cond, m) => (cond ? pass(m) : fail(m));
const stop = (m) => { console.log(`\nSTOP: ${m}\nNothing further was attempted. No rollback or manual repair was performed.`); process.exit(1); };
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

const parseUrl = (s) => { try { return new URL(s); } catch { return null; } };
const withTimeouts = (u) => { const c = new URL(u.toString()); c.searchParams.set('connect_timeout', '60'); c.searchParams.set('pool_timeout', '60'); return c; };
const directOf = (u) => { const c = new URL(u.toString()); c.hostname = c.hostname.replace('-pooler', ''); return c; };
const endpointOf = (u) => u.hostname.split('.')[0].replace('-pooler', '');

const readOnly = async (prisma, fn) => prisma.$transaction(async (tx) => {
  await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
  return fn((s) => tx.$queryRawUnsafe(s));
}, { timeout: 120000, maxWait: 120000 });

const cli = (cliArgs, url) => {
  // Fixed argv, no shell. Prisma CLI entry point from the backend's own install.
  const entry = path.join(backendDir, 'node_modules', 'prisma', 'build', 'index.js');
  const r = spawnSync(process.execPath, [entry, ...cliArgs], {
    cwd: backendDir, env: { ...process.env, DATABASE_URL: url.toString() }, encoding: 'utf8'
  });
  const scrub = (t) => (t || '').replace(/postgres(ql)?:\/\/[^\s"']+/g, 'postgresql://***');
  return { status: r.status, out: scrub(`${r.stdout || ''}${r.stderr || ''}`) };
};

/** Server-reported identity + refusal of production, on a given URL. */
const identity = async (label, url) => {
  const prisma = new PrismaClient({ datasources: { db: { url: url.toString() } }, log: [] });
  try {
    const id = await readOnly(prisma, async (q) => (await q(
      "select current_setting('neon.branch_id',true) branch, current_setting('neon.endpoint_id',true) endpoint, current_setting('neon.project_id',true) project, current_setting('transaction_read_only') ro"))[0]);
    info(`${label}: server reports branch=${id.branch} endpoint=${id.endpoint} project=${id.project}`);
    if (id.branch === PROD.branch || id.endpoint === PROD.endpoint) stop(`${label} is the PRODUCTION branch/endpoint. Refusing unconditionally.`);
    ok(id.branch === DEV.branch, `${label}: branch id == ${DEV.branch}`);
    ok(id.endpoint === DEV.endpoint, `${label}: endpoint == ${DEV.endpoint}`);
    ok(id.project === DEV.project, `${label}: project == ${DEV.project}`);
    ok(id.ro === 'on', `${label}: inspection transaction is READ ONLY`);
    return id;
  } finally { await prisma.$disconnect(); }
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
  if (pin === PROD.branch) stop('EXPECTED_NEON_BRANCH_ID is the production branch. Refusing.');
  ok(pin === DEV.branch, `EXPECTED_NEON_BRANCH_ID == ${DEV.branch}`);

  // Local migration files must be byte-identical to what production recorded.
  const files = fs.readdirSync(path.join(repoRoot, 'prisma', 'migrations')).filter((f) => /^\d{14}_/.test(f)).sort();
  ok(JSON.stringify(files) === JSON.stringify([INIT, MIGRATION]), `local migrations are exactly [${INIT}, ${MIGRATION}]`);
  const sql = fs.readFileSync(migrationFile);
  ok(sha(sql) === EXPECTED_CHECKSUM[MIGRATION], 'local V2 migration.sql checksum == production-recorded checksum (file unchanged)');
  ok(sha(fs.readFileSync(path.join(repoRoot, 'prisma', 'migrations', INIT, 'migration.sql'))) === EXPECTED_CHECKSUM[INIT], 'local init migration.sql checksum == production-recorded checksum');

  // Static SQL review.
  const text = sql.toString('utf8');
  const stripped = text.replace(/ON (DELETE|UPDATE) (CASCADE|RESTRICT|SET NULL|NO ACTION)/g, '');
  // Whole words only (column names such as "updated_at" / "granted" are legitimate).
  const forbidden = stripped.match(/\b(DROP|DELETE|TRUNCATE|UPDATE|INSERT|RENAME|GRANT|REVOKE|CREATE\s+(?:EXTENSION|ROLE|SCHEMA|FUNCTION|TRIGGER)|DO\s+\$\$)(?![A-Za-z0-9_])/gi);
  ok(!forbidden, `migration SQL contains no destructive/privileged statements${forbidden ? ` (found: ${[...new Set(forbidden)].join(', ')})` : ''}`);
  const alterTargets = [...text.matchAll(/^ALTER TABLE "(\w+)"/gm)].map((m) => m[1]);
  ok(alterTargets.every((t) => V2_TABLES.includes(t)), 'every ALTER TABLE targets one of the 10 new tables (no legacy table altered)');
  ok([...text.matchAll(/^CREATE TABLE "(\w+)"/gm)].length === 10, 'CREATE TABLE count == 10');
  ok([...text.matchAll(/ADD CONSTRAINT "\w+" CHECK/g)].length === 15, 'CHECK constraints in file == 15');
  ok([...text.matchAll(/^CREATE (?:UNIQUE )?INDEX/gm)].length === 11, 'CREATE INDEX statements in file == 11 (incl. partial unique)');
  ok([...text.matchAll(/FOREIGN KEY/g)].length === 12, 'FOREIGN KEY constraints in file == 12');

  // Server-side identity on the pooled URL, then on the exact direct URL the deploy will use.
  const pooled = withTimeouts(url);
  await identity('pooled connection', pooled);
  const direct = withTimeouts(directOf(url));
  await identity('direct connection (used by migrate deploy)', direct);

  // Database state: init only, V2 absent, legacy intact.
  const prisma = new PrismaClient({ datasources: { db: { url: direct.toString() } }, log: [] });
  try {
    const state = await readOnly(prisma, async (q) => {
      const mig = await q('select migration_name, checksum, finished_at is not null as finished, rolled_back_at is not null as rolled_back from _prisma_migrations order by started_at');
      const have = new Set((await q("select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE'")).map((r) => r.table_name));
      const counts = {};
      for (const t of LEGACY_TABLES) if (have.has(t)) counts[t] = (await q(`select count(*)::int c from "${t}"`))[0].c;
      return { mig, have, counts };
    });
    ok(state.mig.length === 1 && state.mig[0].migration_name === INIT && state.mig[0].finished && !state.mig[0].rolled_back, 'development history is exactly [init], finished, not rolled back');
    ok(state.mig[0]?.checksum === EXPECTED_CHECKSUM[INIT], 'development init checksum == production init checksum');
    ok(V2_TABLES.every((t) => !state.have.has(t)), 'none of the 10 V2 tables exist yet (migration is pending)');
    ok(LEGACY_TABLES.every((t) => state.have.has(t)), 'all 11 legacy tables present');
    info(`legacy counts snapshot: ${JSON.stringify(state.counts)}`);
    return { url, direct, counts: state.counts };
  } finally { await prisma.$disconnect(); }
};

/* ------------------------- post-migration verify ------------------------ */
const verify = async (direct, before) => {
  console.log('\n=== POST-MIGRATION VERIFICATION (read-only) ===');
  await identity('post-check connection', direct);
  const sql = fs.readFileSync(migrationFile, 'utf8');
  const expect = {
    checks: [...sql.matchAll(/ADD CONSTRAINT "(\w+)" CHECK/g)].map((m) => m[1]),
    indexes: [...sql.matchAll(/^CREATE (?:UNIQUE )?INDEX "(\w+)"/gm)].map((m) => m[1]),
    fks: [...sql.matchAll(/ADD CONSTRAINT "(\w+)" FOREIGN KEY/g)].map((m) => m[1])
  };
  const prisma = new PrismaClient({ datasources: { db: { url: direct.toString() } }, log: [] });
  try {
    await readOnly(prisma, async (q) => {
      const mig = await q('select migration_name, checksum, finished_at is not null as finished, rolled_back_at is not null as rolled_back, applied_steps_count steps from _prisma_migrations order by started_at');
      const v2 = mig.find((m) => m.migration_name === MIGRATION);
      ok(mig.length === 2 && !!v2, 'migration history now contains exactly [init, add_wellbeing_v2]');
      ok(v2?.checksum === EXPECTED_CHECKSUM[MIGRATION], `V2 checksum recorded in dev == production's (${EXPECTED_CHECKSUM[MIGRATION].slice(0, 16)}…)`);
      ok(v2?.finished && !v2?.rolled_back && Number(v2?.steps) === 1, 'V2 finished, 1 step, not rolled back');
      ok(mig.every((m) => m.finished && !m.rolled_back), 'no failed / unfinished / rolled-back migrations');

      const have = new Set((await q("select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE'")).map((r) => r.table_name));
      ok(V2_TABLES.every((t) => have.has(t)), `all ${EXPECT_COUNTS.tables} V2 tables exist`);
      const ck = (await q("select conname n from pg_constraint where contype='c' and connamespace='public'::regnamespace")).map((r) => r.n);
      ok(ck.length === EXPECT_COUNTS.checks && expect.checks.every((c) => ck.includes(c)), `${EXPECT_COUNTS.checks} CHECK constraints present, names match (${ck.length} found)`);
      const ix = (await q("select indexname n from pg_indexes where schemaname='public'")).map((r) => r.n);
      ok(expect.indexes.length === EXPECT_COUNTS.indexes && expect.indexes.every((i) => ix.includes(i)), `${EXPECT_COUNTS.indexes} V2 indexes present`);
      const part = await q("select indexdef d from pg_indexes where schemaname='public' and indexname='media_assets_legacy_source_id_idx'");
      ok(/WHERE .*legacy_source IS NOT NULL.*legacy_asset_id IS NOT NULL/.test(part[0]?.d || ''), 'partial unique index has the expected predicate');
      const fk = (await q("select conname n from pg_constraint where contype='f' and connamespace='public'::regnamespace")).map((r) => r.n);
      ok(expect.fks.length === EXPECT_COUNTS.fks && expect.fks.every((f) => fk.includes(f)), `${EXPECT_COUNTS.fks} V2 foreign keys present`);

      const after = {};
      for (const t of LEGACY_TABLES) after[t] = (await q(`select count(*)::int c from "${t}"`))[0].c;
      ok(!before || JSON.stringify(after) === JSON.stringify(before), `legacy record counts unchanged ${before ? '(equal to pre-migration snapshot)' : ''}`);
      info(`legacy counts: ${JSON.stringify(after)}`);
      const v2c = {};
      for (const t of V2_TABLES) if (have.has(t)) v2c[t] = (await q(`select count(*)::int c from "${t}"`))[0].c;
      ok(Object.values(v2c).every((c) => c === 0), 'V2 tables are empty (as in production)');
    });
  } finally { await prisma.$disconnect(); }

  const st = cli(['migrate', 'status', '--schema', schemaFile], direct);
  ok(st.status === 0 && /up to date/i.test(st.out), '`prisma migrate status`: database schema is up to date');
  const df = cli(['migrate', 'diff', '--from-schema-datasource', schemaFile, '--to-schema-datamodel', schemaFile, '--script'], direct);
  const stmts = df.out.split('\n').filter((l) => /;\s*$/.test(l));
  const cosmetic = stmts.filter((l) => /^ALTER TABLE "\w+" ALTER COLUMN "id" SET DEFAULT gen_random_uuid\(\)::text;$/.test(l.trim()));
  ok(df.status === 0 && stmts.length === cosmetic.length, `drift vs schema.prisma limited to Prisma's known cosmetic uuid-default normalisation (${cosmetic.length} of ${stmts.length} statements; production shows the same)`);
};

/* -------------------------------- main --------------------------------- */
const main = async () => {
  const execute = flag('execute');
  const verifyOnly = flag('verify-only');
  if (execute && verifyOnly) stop('--execute and --verify-only are mutually exclusive.');

  if (verifyOnly) {
    const url = parseUrl(process.env.DATABASE_URL || '');
    if (!url) stop('DATABASE_URL missing.');
    if (endpointOf(url) === PROD.endpoint) stop('production endpoint refused.');
    await verify(withTimeouts(directOf(url)), null);
  } else {
    const ctx = await preflight();
    if (failures) stop(`${failures} preflight check(s) failed.`);

    if (!execute) {
      console.log('\nPREFLIGHT PASSED. Dry run only: nothing was changed.');
      console.log('To execute, the operator must pass: --execute --confirm-branch ' + DEV.branch + ' --recovery-point "<name>" --confirm-not-default');
      return;
    }

    console.log('\n=== EXECUTION GATES ===');
    ok(opt('confirm-branch') === DEV.branch, `--confirm-branch equals ${DEV.branch}`);
    ok(!!opt('recovery-point') && !opt('recovery-point').startsWith('--') && opt('recovery-point').length >= 3, `--recovery-point provided: "${opt('recovery-point') ?? ''}"`);
    ok(flag('confirm-not-default'), '--confirm-not-default provided (operator confirmed the branch is not the Neon default/production branch)');
    if (failures) stop('execution gates not satisfied.');

    console.log('\n=== APPLYING (prisma migrate deploy, direct connection) ===');
    const r = cli(['migrate', 'deploy', '--schema', schemaFile], ctx.direct);
    console.log(r.out.split('\n').filter((l) => l.trim() && !/Update available|pris\.ly|npm i|^[┌│└]/.test(l)).join('\n'));
    if (r.status !== 0) stop(`prisma migrate deploy exited with status ${r.status}. Inspect the output above; the database may be partially migrated. Do not retry blindly.`);
    pass('prisma migrate deploy completed');
    await verify(ctx.direct, ctx.counts);
  }
  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
  if (failures) process.exit(1);
};

console.error('This historical migration runner is retired. Use reviewed Prisma migrations only.'); process.exitCode = 1;
