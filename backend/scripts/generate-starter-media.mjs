// Regenerates MindHaven's original starter media deterministically.
//
//   node scripts/generate-starter-media.mjs            create missing files (never overwrites)
//   node scripts/generate-starter-media.mjs --force    regenerate and overwrite
//   node scripts/generate-starter-media.mjs --verify   regenerate into a temp dir and compare
//                                                      SHA-256 with the committed files
//   add --catalog to (re)write the starter entries in content/catalog.json
//
// Requires an ffmpeg with libmp3lame and libwebp on PATH (or FFMPEG_PATH) plus ffprobe.
// Byte-identical output is guaranteed for the same ffmpeg build; the manifest
// records the build used. Run from backend/.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { STARTER_ITEMS, audioArgs, imageArgs, audioPath, imagePath, catalogEntry } from '../src/wellbeing/starterMedia.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const MEDIA = path.join(ROOT, 'frontend', 'public', 'media');
const CATALOG = path.join(ROOT, 'content', 'catalog.json');
const MANIFEST = path.join(ROOT, 'content', 'starter-media.manifest.json');
const args = process.argv.slice(2);
const known = ['--force', '--verify', '--catalog'];
if (args.some(a => !known.includes(a)) || (args.includes('--force') && args.includes('--verify'))) {
  console.error(`Usage: node scripts/generate-starter-media.mjs [--force | --verify] [--catalog]`); process.exit(1);
}
const ffmpeg = process.env.FFMPEG_PATH || 'ffmpeg';
const ffprobe = process.env.FFPROBE_PATH || 'ffprobe';
const run = (bin, argv) => execFileSync(bin, argv, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 16 * 1024 * 1024 });
let version;
try {
  version = run(ffmpeg, ['-hide_banner', '-version']).split('\n')[0].trim();
  const encoders = run(ffmpeg, ['-hide_banner', '-encoders']);
  if (!/libmp3lame/.test(encoders) || !/libwebp/.test(encoders)) throw new Error('missing encoders');
  run(ffprobe, ['-version']);
} catch { console.error('ffmpeg with libmp3lame and libwebp, plus ffprobe, must be installed (or set FFMPEG_PATH / FFPROBE_PATH).'); process.exit(1); }

const sha256 = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const duration = file => Number(run(ffprobe, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', file]).trim());
const target = (dir, mediaPath) => path.join(dir, ...mediaPath.slice('/media/'.length).split('/'));

const verify = args.includes('--verify');
const outDir = verify ? fs.mkdtempSync(path.join(os.tmpdir(), 'mindhaven-media-')) : MEDIA;
const results = [];
let mismatches = 0;
try {
  for (const item of STARTER_ITEMS) {
    const files = { audio: target(outDir, audioPath(item)), image: target(outDir, imagePath(item)) };
    for (const [kind, file] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      if (!verify && fs.existsSync(file) && !args.includes('--force')) { console.log(`exists  ${path.relative(ROOT, file)} (use --force to regenerate)`); continue; }
      run(ffmpeg, kind === 'audio' ? audioArgs(item, file) : imageArgs(item, file));
      console.log(`wrote   ${verify ? kind + ' (temp)' : path.relative(ROOT, file)}`);
    }
    const seconds = duration(files.audio);
    const record = { slug: item.slug, audio: audioPath(item), image: imagePath(item), durationSeconds: Math.round(seconds),
      audioBytes: fs.statSync(files.audio).size, audioSha256: sha256(files.audio), imageBytes: fs.statSync(files.image).size, imageSha256: sha256(files.image) };
    if (verify) {
      for (const [kind, key] of [['audio', 'audioSha256'], ['image', 'imageSha256']]) {
        const committed = target(MEDIA, kind === 'audio' ? audioPath(item) : imagePath(item));
        const same = fs.existsSync(committed) && sha256(committed) === record[key];
        if (!same) mismatches++;
        console.log(`${same ? 'match   ' : 'DIFFERS '} ${path.relative(ROOT, committed)}`);
      }
    }
    results.push(record);
  }
} finally { if (verify) fs.rmSync(outDir, { recursive: true, force: true }); }

if (!verify) fs.writeFileSync(MANIFEST, JSON.stringify({ generator: 'backend/scripts/generate-starter-media.mjs', ffmpeg: version, items: results }, null, 2) + '\n');
if (args.includes('--catalog')) {
  const catalog = JSON.parse(fs.readFileSync(CATALOG, 'utf8').replace(/^﻿/, ''));
  const entries = STARTER_ITEMS.map((item, i) => catalogEntry(item, results[i].durationSeconds));
  const ids = new Set(entries.map(e => e.id));
  // Starter items first, other items keep their order; existing starter entries are replaced, never duplicated.
  catalog.items = [...entries, ...catalog.items.filter(x => !ids.has(x.id))];
  fs.writeFileSync(CATALOG, JSON.stringify(catalog, null, 2) + '\n');
  console.log(`catalog ${path.relative(ROOT, CATALOG)}: ${entries.length} starter items written`);
}
console.log(`ffmpeg: ${version}`);
for (const r of results) console.log(`${r.slug.padEnd(16)} ${String(r.durationSeconds).padStart(4)} s  audio ${(r.audioBytes / 1048576).toFixed(2)} MB  image ${(r.imageBytes / 1024).toFixed(1)} KB`);
if (verify) { console.log(mismatches ? `${mismatches} file(s) differ from the committed media` : 'All committed starter media match a fresh generation.'); process.exitCode = mismatches ? 1 : 0; }
