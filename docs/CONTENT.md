# Content and media

How activity content (audio + artwork) gets into MindHaven, and how to change it safely.

## How it fits together

- **`content/catalog.json`** is the single catalogue for every environment. Each item has a stable `id`, metadata, a `status` (`draft`, `in_review`, `published`, `archived`) and two assets (`audio`, `image`). Each asset has its own stable `id`, a `path`, a MIME type, `sourceUrl`, `license` and `attribution`.
- **Media files** live in `frontend/public/media/audio/` and `frontend/public/media/images/`. The website deployment serves them as static files at `PUBLIC_MEDIA_BASE_URL` (for example `https://<site>/media/`).
- **The database** stores only metadata. `backend/scripts/seed-catalog.mjs` copies the catalogue into the `content_items` and `media_assets` tables. The API only returns `published` items, and builds playback URLs from `PUBLIC_MEDIA_BASE_URL` + the asset path.
- **Seeding never deletes.** Removing an item from the file leaves its database row as it was. To take something down, set its status to `archived` (see below).

## Rules that are enforced

| Rule | Enforced by |
|---|---|
| Every asset file exists locally, is inside `/media/audio` or `/media/images`, and matches its MIME signature | `validateCatalog` (both targets) |
| Items a production run takes have an HTTPS, non-test `sourceUrl` and a real licence (not "TESTING ONLY") | production guard (`check-catalog-production.mjs` in CI, and the production seed) |
| Drafts with test-only sources are **excluded** from production runs entirely. A test item with any other status fails the guard | `productionCatalogSubset` |
| Production seeding writes only after every referenced file answers `HEAD 200` at the live `PUBLIC_MEDIA_BASE_URL`, with the right `Content-Type` and the same size as the local file | `checkDeployedMedia` |
| Production seeding verifies branch `br-ancient-snow-b3si0kwz` / endpoint `ep-cold-hill-b3lffx1r` from the env file and again from the live connection | `assertProductionTarget`, `assertDatabaseIdentity` |
| `http://` media origins are allowed only with `NODE_ENV=development`, and never for production seeding | `mediaBaseUrl.js` |

## Licence requirements

Every asset needs a `license` and an HTTPS `sourceUrl`; `attribution` is required whenever the licence requires it (it may be empty for CC0 or owned work).

- **Owned, generated media** (the starter set): licence `Original work — owned by MindHaven (generated)`, `sourceUrl` = the generator script in this repository, empty attribution.
- **Third-party media:** keep proof of the licence (the source page URL and the licence text/version). Use only licences that allow commercial use and modification (for example CC0, CC BY with attribution, or a paid licence you hold). Do not use "non-commercial" or "no derivatives" material; transcoding is a derivative.
- **Test media:** licence `TESTING ONLY - replace before production`, sources on reserved domains (`example.invalid` and similar). Test items must stay `draft`, and their files must never be committed or deployed (see `.gitignore`).

## Version suffixes

File names carry a version: `pink-noise-v1.mp3`, `pink-noise-v1.webp`. **Never overwrite a published file in place.** Browsers, CDNs and the Android app may cache it, and the deployed-media check compares sizes. To change a file, add `-v2` and point the catalogue at it (see "Replace media"). The content item `id` stays the same, and the new file gets a new asset `id`.

Starter IDs are UUIDv5 (namespace `bb9de5f2-a478-5f3e-8930-488ee5ed53b8`), built from `<slug>:content` for the item and `<slug>-v<N>:audio` / `<slug>-v<N>:images` for assets, the same scheme as `backend/scripts/prepare-media.py`.

## Audio encoding defaults

Noise, ambience and breathing or tone guides are **mono 96 kbps MP3**, 48 kHz, −16 LUFS integrated, −1.5 dBTP ceiling. That's about 0.7 MB per minute. Stereo adds nothing to these sounds, and at a fixed bitrate mono puts every bit into one channel. Use **stereo 128 kbps** only for content with a real stereo image, such as music or the chime. Both `generate-starter-media.mjs` (`AMBIENT_ENCODING` is the default, `STEREO_ENCODING` is opt-in per item) and `prepare-media.py` (`audio_profile`) follow this.

## Order of operations: deploy first, then seed

A published item whose file isn't live yet shows a broken player. So always:

1. Add or replace the files and update `content/catalog.json` in one pull request. CI runs the production guard.
2. Merge, and wait for the **website** deployment that contains the files to finish.
3. Seed development (dry run → `--apply` → dry run shows all `UNCHANGED`), then test playback.
4. Seed production with a dry run first. The script refuses if any file isn't live yet.

```bash
cd backend
node scripts/seed-catalog.mjs --target=development             # dry run
node scripts/seed-catalog.mjs --target=development --apply
node scripts/seed-catalog.mjs --target=production --approve-production --env-file=<path>          # dry run
node scripts/seed-catalog.mjs --target=production --approve-production --env-file=<path> --apply  # only with approval
```

The production env file needs `DATABASE_URL`, `DIRECT_URL` (production endpoint), `EXPECTED_NEON_BRANCH_ID=br-ancient-snow-b3si0kwz` and an HTTPS `PUBLIC_MEDIA_BASE_URL`. Keep that file outside the repository. `.env.test` is refused as a production target.

## Add an item

- **Owned or generated media:** add a definition to `STARTER_ITEMS` in `backend/src/wellbeing/starterMedia.js`, then run `node scripts/generate-starter-media.mjs --catalog` from `backend/`. It writes only the files that are missing, updates `content/starter-media.manifest.json` (sizes, durations, SHA-256, ffmpeg build), and writes the item's catalogue entry.
- **Third-party media:** use `backend/scripts/prepare-media.py <folder>` with a `sources.csv`. It loudness-normalises (−16 LUFS, −1.5 dBTP, 48 kHz MP3) and converts images to WebP, then writes a review draft. Set the optional `audio_profile` column to `ambient` (the default: mono 96 kbps, for noise, ambience and tone guides) or `music` (stereo 128 kbps, for content that genuinely uses stereo). Fill in the descriptions and tags, then move the entries into `catalog.json` as `draft` until reviewed.
- Then follow "deploy first, then seed". Set `published` only after the files and licence are verified.

## Edit an item

Metadata (title, description, tags, duration, status) can change at any time. Edit `catalog.json` and seed again; the dry run lists exactly which fields change. Keep `id` values unchanged.

## Archive an item (instead of deleting)

Set `"status": "archived"` and seed. The API stops listing it, while past activity sessions, feedback and recommendations keep their reference (`content_items` rows are `Restrict`-referenced, so deleting them would fail or lose history). Keep the files deployed until no client could still be playing them; it's safe to remove them in a later release.

## Replace media

1. Add the new file with the next version suffix (`-v2`). For a starter item, increase `version` in `STARTER_ITEMS` and run the generator with `--catalog`.
2. In `catalog.json`, point the item's `audio`/`image` at the new path and the new asset `id`. Keep the item `id`.
3. Deploy first, then seed. The old asset row stays in the database, unreferenced, and the old file can be removed in a later release.

## Regenerate or verify the starter media

```bash
cd backend
node scripts/generate-starter-media.mjs --verify   # regenerate into a temp dir, compare SHA-256
node scripts/generate-starter-media.mjs --force    # overwrite (only if you intend to change files; bump the version instead)
```

It needs ffmpeg with `libmp3lame` and `libwebp`, plus `ffprobe`, on `PATH` (or `FFMPEG_PATH`/`FFPROBE_PATH`). Output is byte-identical for the same ffmpeg build, which is recorded in the manifest; another build may differ at the byte level while sounding the same.

## When to move media to object storage

Static website assets are the right choice while the library is small. Move audio to object storage with a CDN (the `media_assets.storage_provider` column exists for this) when any of these apply:

- media in the repository exceeds about 200 MB, or single files exceed about 25 MB (Git history keeps every version forever);
- content needs to change without a website deployment, or is managed by non-engineers;
- you need private or per-user media (signed URLs), regional delivery, or download/bandwidth metrics;
- website deployments slow down noticeably because of media.

The starter set is about 28 MB, so static hosting is fine for now.
