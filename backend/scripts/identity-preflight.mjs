#!/usr/bin/env node
/**
 * Phase 2B.2 identity-foundation PREFLIGHT. STRICTLY READ-ONLY, DEVELOPMENT ONLY.
 *
 *   cd backend && node scripts/identity-preflight.mjs
 *
 *  - Every query runs inside `SET TRANSACTION READ ONLY`; the only spawned
 *    commands are `prisma migrate status` and `prisma migrate diff` (both
 *    read-only introspection; fixed argv, no shell).
 *  - The production endpoint/branch is refused by hostname, env pin and by the
 *    ids the server itself reports.
 *  - Output is aggregate only: no emails, no hashes, no credentials. Where rows
 *    must be identified (duplicate groups) only users.id values are printed.
 */
import 'dotenv/config';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const DEV = { branch: 'br-weathered-hall-b3dn9bub', endpoint: 'ep-square-boat-b3zomdvt', project: 'plain-wave-56430909' };
const PROD = { branch: 'br-flat-tree-b3brt6b9', endpoint: 'ep-snowy-term-b39utxb2' };
const MIGRATIONS = ['20260923032421_init', '20261012181122_add_wellbeing_v2'];

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const schemaFile = path.resolve(backendDir, '..', 'prisma', 'schema.prisma');

let failures = 0;
const ok = (c, m) => { if (!c) failures += 1; console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); };
const info = (m) => console.log(`      ${m}`);
const stop = (m) => { console.log(`\nSTOP: ${m}`); process.exit(1); };
const num = (v) => Number(v);

const raw = process.env.DATABASE_URL;
let url; try { url = new URL(raw); } catch { stop('DATABASE_URL missing or unparsable'); }
const ep = url.hostname.split('.')[0].replace('-pooler', '');
if (ep === PROD.endpoint || url.hostname.includes(PROD.endpoint)) stop('DATABASE_URL points at PRODUCTION. Refusing.');
if (process.env.EXPECTED_NEON_BRANCH_ID === PROD.branch) stop('EXPECTED_NEON_BRANCH_ID is PRODUCTION. Refusing.');
ok(ep === DEV.endpoint, `configured endpoint == ${DEV.endpoint}`);
ok(process.env.EXPECTED_NEON_BRANCH_ID === DEV.branch, `EXPECTED_NEON_BRANCH_ID == ${DEV.branch}`);

const prisma = new PrismaClient({ datasources: { db: { url: url.toString() } }, log: [] });
const ro = (fn) => prisma.$transaction(async (tx) => {
  await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
  return fn((s) => tx.$queryRawUnsafe(s));
}, { timeout: 120000, maxWait: 120000 });

const cli = (args) => {
  const entry = path.join(backendDir, 'node_modules', 'prisma', 'build', 'index.js');
  const r = spawnSync(process.execPath, [entry, ...args], {
    cwd: backendDir, env: { ...process.env, DATABASE_URL: url.toString() }, encoding: 'utf8'
  });
  const scrub = (t) => (t || '').replace(/postgres(ql)?:\/\/[^\s"']+/g, 'postgresql://***');
  return { status: r.status, out: scrub(`${r.stdout || ''}${r.stderr || ''}`) };
};

try {
  console.log('\n=== 1. Server identity ===');
  await ro(async (q) => {
    const [id] = await q("select current_setting('neon.branch_id',true) branch, current_setting('neon.endpoint_id',true) endpoint, current_setting('neon.project_id',true) project, current_setting('transaction_read_only') ro");
    if (id.branch === PROD.branch || id.endpoint === PROD.endpoint) stop('server reports PRODUCTION. Refusing.');
    ok(id.branch === DEV.branch, `server branch == ${DEV.branch}`);
    ok(id.endpoint === DEV.endpoint, `server endpoint == ${DEV.endpoint}`);
    ok(id.project === DEV.project, `server project == ${DEV.project}`);
    ok(id.ro === 'on', 'transaction is READ ONLY');
  });

  await ro(async (q) => {
    console.log('\n=== 2. users table structure ===');
    const cols = await q("select column_name, data_type, is_nullable, column_default from information_schema.columns where table_schema='public' and table_name='users' order by ordinal_position");
    for (const c of cols) info(`${c.column_name}  ${c.data_type}  nullable=${c.is_nullable}  default=${c.column_default ?? '-'}`);
    const byName = Object.fromEntries(cols.map((c) => [c.column_name, c]));
    ok(byName.password_hash?.is_nullable === 'NO', 'users.password_hash is currently NOT NULL (the relaxation is real)');
    ok(byName.email?.is_nullable === 'NO', 'users.email is NOT NULL');
    ok(!byName.email_verified_at, 'users.email_verified_at does not exist yet');
    ok(byName.id?.data_type === 'text', 'users.id is TEXT');
    const tbl = await q("select to_regclass('public.auth_identities')::text as t");
    ok(tbl[0].t === null, 'auth_identities does not exist yet');

    console.log('\n=== 3. Constraints and indexes on users ===');
    const idx = await q("select indexname, indexdef from pg_indexes where schemaname='public' and tablename='users' order by 1");
    for (const i of idx) info(`${i.indexname}: ${i.indexdef}`);
    ok(idx.some((i) => i.indexname === 'users_email_key' && /UNIQUE/.test(i.indexdef)), 'unique index users_email_key (case-sensitive) exists');
    ok(!idx.some((i) => /lower\(/i.test(i.indexdef)), 'no lower(email) index yet');
    const refs = await q("select count(*)::int n from pg_constraint where contype='f' and confrelid='public.users'::regclass");
    info(`foreign keys referencing users: ${refs[0].n} (all expected ON DELETE CASCADE)`);
    const nonCascade = await q("select conrelid::regclass::text as t from pg_constraint where contype='f' and confrelid='public.users'::regclass and confdeltype <> 'c'");
    ok(nonCascade.length === 0, 'every FK to users is ON DELETE CASCADE');

    console.log('\n=== 4. Migration history (_prisma_migrations) ===');
    const hist = await q('select migration_name, finished_at is not null as finished, rolled_back_at is not null as rolled_back, applied_steps_count from _prisma_migrations order by started_at');
    for (const h of hist) info(`${h.migration_name} finished=${h.finished} rolled_back=${h.rolled_back} steps=${h.applied_steps_count}`);
    ok(JSON.stringify(hist.map((h) => h.migration_name)) === JSON.stringify(MIGRATIONS), 'history is exactly [init, add_wellbeing_v2]');
    ok(hist.every((h) => h.finished && !h.rolled_back), 'all migrations finished, none rolled back');

    console.log('\n=== 5. Email data quality (aggregate only) ===');
    const [tot] = await q('select count(*)::int n from users');
    info(`total users: ${tot.n}`);
    const dups = await q("select lower(email) k, count(*)::int n, array_agg(id order by created_at) ids from users group by lower(email) having count(*) > 1");
    ok(dups.length === 0, `case-insensitive duplicate email groups: ${dups.length}`);
    for (const d of dups) info(`DUPLICATE GROUP size=${d.n} user ids=${JSON.stringify(d.ids)}`);
    const [mixed] = await q('select count(*)::int n from users where email <> lower(email)');
    info(`mixed-case emails (would be left unchanged): ${mixed.n}`);
    const [ws] = await q('select count(*)::int n from users where email <> btrim(email)');
    info(`emails with leading/trailing whitespace: ${ws.n}`);
    const [emptyE] = await q("select count(*)::int n from users where btrim(email) = ''");
    ok(num(emptyE.n) === 0, 'no empty emails');

    console.log('\n=== 6. Password hashes ===');
    const [h] = await q(`select
      count(*) filter (where password_hash is null)::int nulls,
      count(*) filter (where password_hash = '')::int empties,
      count(*) filter (where password_hash ~ '^\\$2[aby]\\$[0-9]{2}\\$.{53}$')::int bcrypt_ok,
      count(*)::int total from users`);
    info(`null=${h.nulls} empty=${h.empties} well-formed-bcrypt=${h.bcrypt_ok} total=${h.total}`);
    ok(h.nulls === 0 && h.empties === 0, 'every existing user has a non-empty password hash');
    ok(h.bcrypt_ok === h.total, 'every existing hash is well-formed bcrypt (cost recorded in prefix only)');
  });

  console.log('\n=== 7. prisma migrate status (read-only) ===');
  const st = cli(['migrate', 'status', '--schema', schemaFile]);
  console.log(st.out.trim().split('\n').map((l) => '      ' + l).join('\n'));

  console.log('\n=== 8. Drift: live DEV vs current prisma/schema.prisma (read-only introspection) ===');
  const df = cli(['migrate', 'diff', '--from-url', url.toString(), '--to-schema-datamodel', schemaFile, '--script']);
  console.log(df.out.trim().split('\n').map((l) => '      ' + l).join('\n'));
  // Known Prisma false positive (pre-existing, unrelated to identity work): Postgres stores
  // the V2 id defaults as (gen_random_uuid())::text and Prisma re-proposes the same expression.
  const stmts = df.out.split('\n').map((l) => l.trim()).filter((l) => /^(ALTER|CREATE|DROP)\b/i.test(l));
  const noise = (l) => /^ALTER TABLE "\w+" ALTER COLUMN "id" SET DEFAULT gen_random_uuid\(\)::text;$/.test(l);
  // The planned identity migration (not yet applied): these, and only these, are expected.
  const planned = (l) => /auth_identities/.test(l)
    || /^ALTER TABLE "users" ADD COLUMN\s+"email_verified_at" TIMESTAMPTZ\(6\),$/.test(l)
    || /^ALTER COLUMN "password_hash" DROP NOT NULL;$/.test(l);
  const unexpected = stmts.filter((l) => !noise(l) && !planned(l));
  info(`ignored cosmetic default noise: ${stmts.filter(noise).length}; planned identity statements: ${stmts.filter(planned).length}`);
  for (const u of unexpected) info(`UNEXPECTED: ${u}`);
  ok(unexpected.length === 0, 'DEV differs from schema.prisma ONLY by the planned identity changes (no other drift)');
} catch (e) {
  console.log(`\nERROR: ${String(e?.message || e).replace(/postgres(ql)?:\/\/[^\s"']+/g, 'postgresql://***').split('\n')[0]}`);
  failures += 1;
} finally {
  await prisma.$disconnect();
}
console.log(`\n${failures === 0 ? 'PREFLIGHT PASS' : `PREFLIGHT FAIL (${failures})`}`);
process.exit(failures === 0 ? 0 : 1);
