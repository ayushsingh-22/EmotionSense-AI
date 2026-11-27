import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { validateCatalog } from '../src/wellbeing/catalog.js';
import { productionCatalogSubset, assertProductionCatalog, productionCatalogIssues } from '../src/wellbeing/catalogProductionGuard.js';
import { parseSeedArgs, assertProductionTarget, assertDatabaseIdentity, checkDeployedMedia, PRODUCTION_DB, DEVELOPMENT_DB } from '../src/wellbeing/catalogSeed.js';
import { validMediaBaseUrl } from '../src/wellbeing/mediaBaseUrl.js';
import { STARTER_ITEMS, STARTER_LICENSE, STARTER_SOURCE_URL, catalogEntry, audioArgs, imageArgs, breathingExpression, uuid5, audioPath, imagePath } from '../src/wellbeing/starterMedia.js';

const root = path.resolve('..');
const mediaRoot = path.join(root, 'frontend', 'public', 'media');
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'content', 'catalog.json'), 'utf8').replace(/^﻿/, ''));
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'content', 'starter-media.manifest.json'), 'utf8'));

test('UUIDv5 matches the IDs produced by prepare-media.py', () => {
  assert.equal(uuid5('bell:content'), 'dcbd8ad3-acbd-5e2c-ac7c-8fe3f7410aae');
  assert.equal(uuid5('bell:audio'), '10074e71-7e37-5780-a211-2306420abddf');
});

test('catalog.json: six original published starter items plus the four test items as drafts', () => {
  // Published/eligible files must exist with the right MIME signature. Test drafts' files are untracked
  // and may be absent in a fresh clone or CI, so only their status is asserted.
  validateCatalog(productionCatalogSubset(catalog).catalog, mediaRoot);
  const starter = catalog.items.filter(x => x.audio.license === STARTER_LICENSE);
  assert.equal(starter.length, 6);
  for (const x of starter) {
    assert.equal(x.status, 'published'); assert.equal(x.image.license, STARTER_LICENSE);
    for (const a of [x.audio, x.image]) { assert.equal(a.sourceUrl, STARTER_SOURCE_URL); assert.equal(a.attribution, ''); assert.match(a.path, /-v\d+\.(mp3|webp)$/); }
    assert.ok(x.description.length > 40);
  }
  const test = catalog.items.filter(x => productionCatalogIssues({ items: [x] }).length);
  assert.equal(test.length, 4);
  assert.ok(test.every(x => x.status === 'draft'), 'test-only items are never published');
  assert.deepEqual(catalog.items.map(x => x.status).filter(s => s === 'published').length, 6);
});

test('starter entries are what the generator would write (IDs, tags, durations from the manifest)', () => {
  const byId = new Map(catalog.items.map(x => [x.id, x]));
  for (const item of STARTER_ITEMS) {
    const record = manifest.items.find(r => r.slug === item.slug);
    assert.ok(record, item.slug);
    assert.deepEqual(byId.get(uuid5(`${item.slug}:content`)), catalogEntry(item, record.durationSeconds));
    assert.equal(record.audio, audioPath(item)); assert.equal(record.image, imagePath(item));
    assert.ok(Math.abs(record.durationSeconds - item.seconds) <= 1);
    for (const [p, bytes] of [[record.audio, record.audioBytes], [record.image, record.imageBytes]])
      assert.equal(fs.statSync(path.join(mediaRoot, ...p.slice('/media/'.length).split('/'))).size, bytes, `${p} matches manifest size`);
  }
  const types = Object.fromEntries(STARTER_ITEMS.map(i => [i.slug, [i.type, i.needTags.join(',')]]));
  assert.deepEqual(types, { 'pink-noise': ['sleep', 'sleep,focus'], 'brown-noise': ['sleep', 'sleep,relax'], 'soft-rain': ['sleep', 'sleep,relax'], 'breathing-4-7-8': ['breathing', 'anxiety,stress'], 'box-breathing': ['breathing', 'stress,focus'], 'gentle-chime': ['meditation', 'mindfulness'] });
});

test('generator arguments are deterministic, bit-exact and use the pipeline encoder settings', () => {
  for (const item of STARTER_ITEMS) {
    const a = audioArgs(item, 'out.mp3');
    assert.deepEqual(a, audioArgs(item, 'out.mp3'));
    for (const flag of ['libmp3lame', '+bitexact', 'loudnorm=I=-16:TP=-1.5:LRA=11']) assert.ok(a.some(x => x.includes(flag)), `${item.slug} ${flag}`);
    const [rate, channels] = [a[a.indexOf('-b:a') + 1], a[a.indexOf('-ac') + 1]];
    // Noise/ambient and tone guides default to mono 96 kbps; only the chime opts into stereo 128 kbps.
    assert.deepEqual([rate, channels], item.slug === 'gentle-chime' ? ['128k', '2'] : ['96k', '1'], item.slug);
    assert.equal(/join=inputs=2|pan=stereo/.test(a.join(' ')), false, `${item.slug} builds no stereo graph`);
    const voices = (a.join(' ').match(/aevalsrc='([^']*)'/) || [])[1]; if (voices) assert.equal(voices.split('|').length, Number(channels));
    assert.ok(!a.join(' ').match(/random\(/), 'no unseeded randomness');
    assert.ok(imageArgs(item, 'out.webp').includes('libwebp'));
  }
  assert.equal(breathingExpression(STARTER_ITEMS.find(i => i.slug === 'breathing-4-7-8').phases).cycle, 19);
  assert.equal(breathingExpression(STARTER_ITEMS.find(i => i.slug === 'box-breathing').phases).cycle, 16);
});

test('production subset excludes test drafts and passes the guard; a published test item fails', () => {
  const { catalog: subset, excluded } = productionCatalogSubset(catalog);
  assert.equal(subset.items.length, 6); assert.equal(excluded.length, 4);
  assert.doesNotThrow(() => assertProductionCatalog(subset));
  const leaked = structuredClone(catalog); leaked.items.find(x => x.status === 'draft').status = 'archived';
  assert.throws(() => assertProductionCatalog(productionCatalogSubset(leaked).catalog), /testing-only/);
});

test('seed arguments: dry run by default; production needs explicit approval and an env file', () => {
  assert.deepEqual(parseSeedArgs(['--target=development']), { target: 'development', apply: false });
  assert.deepEqual(parseSeedArgs(['--target=development', '--apply']), { target: 'development', apply: true });
  assert.deepEqual(parseSeedArgs(['--target=production', '--approve-production', '--env-file=prod.env']), { target: 'production', apply: false, envFile: 'prod.env' });
  for (const bad of [[], ['--target=production'], ['--target=production', '--approve-production'], ['--target=production', '--env-file=x'], ['--target=development', '--approve-production'],
    ['--target=development', '--target=production'], ['--target=production', '--approve-production', '--env-file=.env.test'], ['--target=production', '--approve-production', '--env-file=a\\.env.test'], ['--target=development', '--force'], ['--target=development', '--apply', '--apply']])
    assert.throws(() => parseSeedArgs(bad), undefined, bad.join(' '));
});

test('production target: branch, endpoints and HTTPS media origin are checked before any connection', () => {
  const host = `${PRODUCTION_DB.endpoint}.c-4.ap-southeast-1.aws.neon.tech`;
  const env = { EXPECTED_NEON_BRANCH_ID: PRODUCTION_DB.branch, DATABASE_URL: `postgresql://u:p@${PRODUCTION_DB.endpoint}-pooler.c-4.ap-southeast-1.aws.neon.tech/db`, DIRECT_URL: `postgresql://u:p@${host}/db`, PUBLIC_MEDIA_BASE_URL: 'https://site.invalid/media/' };
  const check = e => assertProductionTarget(e, { validMediaBase: validMediaBaseUrl });
  assert.doesNotThrow(() => check(env));
  const dev = `${DEVELOPMENT_DB.endpoint}.c-4.ap-southeast-1.aws.neon.tech`;
  for (const change of [{ EXPECTED_NEON_BRANCH_ID: DEVELOPMENT_DB.branch }, { DIRECT_URL: `postgresql://u:p@${dev}/db` }, { DATABASE_URL: `postgresql://u:p@${dev}/db` },
    { PUBLIC_MEDIA_BASE_URL: 'http://site.invalid/media/' }, { PUBLIC_MEDIA_BASE_URL: undefined }, { DIRECT_URL: `postgresql://u:p@${host}/other` }])
    assert.throws(() => check({ ...env, ...change }), undefined, JSON.stringify(Object.keys(change)));
  assert.equal(PRODUCTION_DB.project, 'fancy-union-28873755');
  assert.doesNotThrow(() => assertDatabaseIdentity({ branch: PRODUCTION_DB.branch, endpoint: PRODUCTION_DB.endpoint, project: PRODUCTION_DB.project }, PRODUCTION_DB));
  assert.throws(() => assertDatabaseIdentity({ branch: PRODUCTION_DB.branch, endpoint: PRODUCTION_DB.endpoint }, PRODUCTION_DB), /identity/, 'missing project refused');
  assert.throws(() => assertDatabaseIdentity({ branch: PRODUCTION_DB.branch, endpoint: PRODUCTION_DB.endpoint, project: 'other-project-1' }, PRODUCTION_DB), /identity/, 'wrong project refused');
  assert.throws(() => assertDatabaseIdentity({ branch: DEVELOPMENT_DB.branch, endpoint: DEVELOPMENT_DB.endpoint }, PRODUCTION_DB));
  assert.throws(() => assertDatabaseIdentity({ ...DEVELOPMENT_DB, project: 'other' }, DEVELOPMENT_DB));
});

test('deployed-media HEAD check refuses missing, redirected, wrong-type and stale files', async () => {
  const items = productionCatalogSubset(catalog).catalog.items;
  const sizes = new Map(); const localSize = p => { if (!sizes.has(p)) sizes.set(p, fs.statSync(path.join(mediaRoot, ...p.slice('/media/'.length).split('/'))).size); return sizes.get(p); };
  const calls = [];
  const ok = async (url, init) => { calls.push([url, init.method, init.redirect]); const p = '/media/' + url.split('/media/')[1]; return { status: 200, headers: new Headers({ 'content-type': p.endsWith('.mp3') ? 'audio/mpeg' : 'image/webp', 'content-length': String(localSize(p)) }) }; };
  assert.deepEqual(await checkDeployedMedia(items, 'https://site.invalid/media/', { fetchImpl: ok, localSize }), []);
  assert.equal(calls.length, 12); assert.ok(calls.every(([u, m, r]) => u.startsWith('https://site.invalid/media/') && m === 'HEAD' && r === 'manual'));
  const scenario = async respond => checkDeployedMedia(items.slice(0, 1), 'https://site.invalid/media/', { fetchImpl: respond, localSize });
  assert.match((await scenario(async () => ({ status: 404, headers: new Headers() })))[0], /HTTP 404/);
  assert.match((await scenario(async () => ({ status: 308, headers: new Headers({ location: '/' }) })))[0], /HTTP 308/);
  assert.match((await scenario(async () => ({ status: 200, headers: new Headers({ 'content-type': 'text/html' }) })))[0], /Content-Type text\/html/);
  assert.match((await scenario(async (url) => ({ status: 200, headers: new Headers({ 'content-type': url.endsWith('.mp3') ? 'audio/mpeg' : 'image/webp', 'content-length': '1' }) })))[0], /differs from local/);
  assert.match((await scenario(async () => { throw new TypeError('offline'); }))[0], /not reachable/);
});
