// Seed content/catalog.json into a database. Dry run unless --apply; never deletes.
//
//   node scripts/seed-catalog.mjs --target=development [--apply]
//   node scripts/seed-catalog.mjs --target=production --approve-production --env-file=PATH [--apply]
//
// Development seeds every item (test-only items are drafts there). Production
// seeds only the production subset, after: the production guard, local file
// validation, static env checks, a HEAD check that every referenced file is live
// at PUBLIC_MEDIA_BASE_URL, and a live database identity check.
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import pg from 'pg';
import { PrismaClient } from '@prisma/client';
import { strictPgConfig } from '../src/lib/pgStrictTls.js';
import { validateCatalog } from '../src/wellbeing/catalog.js';
import { validMediaBaseUrl } from '../src/wellbeing/mediaBaseUrl.js';
import { syncCatalog, assertDevelopmentTarget, parseSeedArgs, assertProductionTarget, assertDatabaseIdentity, checkDeployedMedia, DEVELOPMENT_DB, PRODUCTION_DB } from '../src/wellbeing/catalogSeed.js';
import { assertProductionCatalog, productionCatalogSubset } from '../src/wellbeing/catalogProductionGuard.js';

const generic = () => { console.error('Catalog operation failed; check input and target configuration.'); process.exit(1); };
process.on('uncaughtException', generic);
process.on('unhandledRejection', generic);
// Messages from our own checks name files/items only, never URLs with credentials.
const refuse = message => { console.error(`Refused: ${message}`); process.exit(1); };

const root = path.resolve('..');
const mediaRoot = path.join(root, 'frontend', 'public', 'media');
let options;
try { options = parseSeedArgs(process.argv.slice(2)); } catch (error) { refuse(error.message); }
const full = JSON.parse(fs.readFileSync(path.join(root, 'content', 'catalog.json'), 'utf8').replace(/^﻿/, ''));

let catalog, env, expected;
if (options.target === 'production') {
  const { catalog: subset, excluded } = productionCatalogSubset(full);
  try { assertProductionCatalog(subset); } catch (error) { refuse(error.message); }
  try { validateCatalog(subset, mediaRoot); } catch (error) { refuse(`local media check failed (${error.message})`); }
  console.log(`Production subset: ${subset.items.length} item(s); ${excluded.length} test-only draft(s) excluded and never seeded.`);
  try { env = dotenv.parse(fs.readFileSync(path.resolve(options.envFile))); } catch { refuse('cannot read --env-file'); }
  try { assertProductionTarget(env, { validMediaBase: validMediaBaseUrl }); } catch (error) { refuse(error.message); }
  const localSize = p => { try { return fs.statSync(path.join(mediaRoot, ...p.slice('/media/'.length).split('/'))).size; } catch { return null; } };
  const problems = await checkDeployedMedia(subset.items, env.PUBLIC_MEDIA_BASE_URL, { localSize });
  if (problems.length) refuse(`media not deployed at the public site yet (deploy the website first):\n- ${problems.join('\n- ')}`);
  console.log('All referenced media files are live at the public media origin.');
  catalog = subset; expected = PRODUCTION_DB;
} else {
  env = dotenv.parse(fs.readFileSync('.env.test'));
  assertDevelopmentTarget(process.argv.slice(2), env);
  // Test-only drafts reference untracked files; skip them when absent (e.g. a fresh clone).
  const present = a => fs.existsSync(path.join(mediaRoot, ...a.path.slice('/media/'.length).split('/')));
  const excludedIds = new Set(productionCatalogSubset(full).excluded.map(x => x.id));
  const skipped = full.items.filter(x => excludedIds.has(x.id) && !(present(x.audio) && present(x.image)));
  for (const x of skipped) console.log(`SKIP test-only draft ${x.id}: media files not present locally`);
  catalog = { ...full, items: full.items.filter(x => !skipped.includes(x)) };
  validateCatalog(catalog, mediaRoot);
  expected = DEVELOPMENT_DB;
}

const client = new pg.Client(strictPgConfig(env.DIRECT_URL));
try {
  await client.connect();
  const row = (await client.query("select current_setting('neon.branch_id',true) branch,current_setting('neon.endpoint_id',true) endpoint,current_setting('neon.project_id',true) project")).rows[0];
  try { assertDatabaseIdentity(row, expected); } catch (error) { refuse(error.message); }
} finally { await client.end(); }

process.env.DATABASE_URL = env.DATABASE_URL; process.env.DIRECT_URL = env.DIRECT_URL;
const db = new PrismaClient();
try {
  const rows = await db.$queryRaw`select current_setting('neon.branch_id',true) AS branch, current_setting('neon.project_id',true) AS project`;
  if (rows[0]?.branch !== expected.branch || rows[0]?.project !== expected.project) refuse('pooled database identity does not match the approved target');
  console.log(`Target verified: ${options.target} (${expected.branch}). ${options.apply ? 'APPLYING changes.' : 'Dry run: no writes.'}`);
  const result = await syncCatalog(db, catalog, { apply: options.apply, report: console.log });
  console.log(`${result.applied ? 'Applied' : 'Dry run'}: ${result.items} reviewed items; no deletions`);
} finally { await db.$disconnect(); }
