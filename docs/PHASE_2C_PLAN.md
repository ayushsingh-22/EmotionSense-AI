# Phase 2C ? Wellbeing APIs design (review draft)

Scope: design only; Phase 3 recommendations excluded. Development catalog verified read-only on `br-flat-scene-b3f7jcb4` / `ep-shiny-fire-b3nfje3k`. No user records read.

## 1. Inventory

Catalog snapshot: nullability and PostgreSQL defaults are shown. Constraint definitions include NOT NULL, primary keys, checks and foreign keys; indexes include primary and unique indexes. Prisma models arrays as non-null, but the deployed array columns are nullable; normalize NULL to `[]` on reads.

### `user_preferences`

No runtime read/write; frontend preferences are separate client state.

Columns:
- `user_id`: text NOT NULL
- `preferred_language`: text NOT NULL; default `'en'::text`
- `preferred_support_modes`: ARRAY NULL; default `ARRAY[]::text[]`
- `preferred_activity_types`: ARRAY NULL; default `ARRAY[]::text[]`
- `timezone`: text NOT NULL; default `'UTC'::text`
- `accessibility_preferences`: jsonb NOT NULL; default `'{}'::jsonb`
- `updated_at`: timestamp with time zone NOT NULL; default `CURRENT_TIMESTAMP`

Constraints:
- `user_preferences_accessibility_preferences_not_null`: `NOT NULL accessibility_preferences`
- `user_preferences_pkey`: `PRIMARY KEY (user_id)`
- `user_preferences_preferred_language_not_null`: `NOT NULL preferred_language`
- `user_preferences_timezone_not_null`: `NOT NULL timezone`
- `user_preferences_updated_at_not_null`: `NOT NULL updated_at`
- `user_preferences_user_id_fkey`: `FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE`
- `user_preferences_user_id_not_null`: `NOT NULL user_id`

Indexes:
- `user_preferences_pkey`: `CREATE UNIQUE INDEX user_preferences_pkey ON public.user_preferences USING btree (user_id)`

### `user_consents`

Emergency contact creation/replacement and enable append grants in backend storage; no general consent read/API. Disable/delete does not append withdrawal.

Columns:
- `id`: text NOT NULL; default `(gen_random_uuid())::text`
- `user_id`: text NOT NULL
- `purpose`: text NOT NULL
- `notice_version`: text NOT NULL
- `granted`: boolean NOT NULL
- `recorded_at`: timestamp with time zone NOT NULL; default `CURRENT_TIMESTAMP`
- `source`: text NOT NULL; default `'in_app'::text`

Constraints:
- `user_consents_granted_not_null`: `NOT NULL granted`
- `user_consents_id_not_null`: `NOT NULL id`
- `user_consents_notice_version_not_null`: `NOT NULL notice_version`
- `user_consents_pkey`: `PRIMARY KEY (id)`
- `user_consents_purpose_not_empty`: `CHECK ((length(TRIM(BOTH FROM purpose)) > 0))`
- `user_consents_purpose_not_null`: `NOT NULL purpose`
- `user_consents_recorded_at_not_null`: `NOT NULL recorded_at`
- `user_consents_source_not_null`: `NOT NULL source`
- `user_consents_user_id_fkey`: `FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE`
- `user_consents_user_id_not_null`: `NOT NULL user_id`

Indexes:
- `user_consents_pkey`: `CREATE UNIQUE INDEX user_consents_pkey ON public.user_consents USING btree (id)`
- `user_consents_user_purpose_time_idx`: `CREATE INDEX user_consents_user_purpose_time_idx ON public.user_consents USING btree (user_id, purpose, recorded_at DESC)`

### `mood_checkins`

No current runtime read/write found.

Columns:
- `id`: text NOT NULL; default `(gen_random_uuid())::text`
- `user_id`: text NOT NULL
- `mood_label`: text NOT NULL
- `mood_score`: smallint NULL
- `energy_score`: smallint NULL
- `note`: text NULL
- `created_at`: timestamp with time zone NOT NULL; default `CURRENT_TIMESTAMP`

Constraints:
- `mood_checkins_created_at_not_null`: `NOT NULL created_at`
- `mood_checkins_energy_score_range`: `CHECK (((energy_score IS NULL) OR ((energy_score >= 1) AND (energy_score <= 10))))`
- `mood_checkins_id_not_null`: `NOT NULL id`
- `mood_checkins_mood_label_not_null`: `NOT NULL mood_label`
- `mood_checkins_mood_score_range`: `CHECK (((mood_score IS NULL) OR ((mood_score >= 1) AND (mood_score <= 10))))`
- `mood_checkins_pkey`: `PRIMARY KEY (id)`
- `mood_checkins_user_id_fkey`: `FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE`
- `mood_checkins_user_id_not_null`: `NOT NULL user_id`

Indexes:
- `mood_checkins_pkey`: `CREATE UNIQUE INDEX mood_checkins_pkey ON public.mood_checkins USING btree (id)`
- `mood_checkins_user_time_idx`: `CREATE INDEX mood_checkins_user_time_idx ON public.mood_checkins USING btree (user_id, created_at DESC)`

### `content_items`

No current runtime read/write found.

Columns:
- `id`: text NOT NULL; default `(gen_random_uuid())::text`
- `title`: text NOT NULL
- `description`: text NULL
- `content_type`: text NOT NULL
- `language`: text NOT NULL; default `'en'::text`
- `duration_seconds`: integer NULL
- `need_tags`: ARRAY NULL; default `ARRAY[]::text[]`
- `suitability_tags`: ARRAY NULL; default `ARRAY[]::text[]`
- `media_asset_id`: text NULL
- `status`: text NOT NULL; default `'draft'::text`
- `review_version`: text NULL
- `created_at`: timestamp with time zone NOT NULL; default `CURRENT_TIMESTAMP`
- `updated_at`: timestamp with time zone NOT NULL; default `CURRENT_TIMESTAMP`

Constraints:
- `content_items_content_type_not_null`: `NOT NULL content_type`
- `content_items_created_at_not_null`: `NOT NULL created_at`
- `content_items_duration_check`: `CHECK (((duration_seconds IS NULL) OR (duration_seconds >= 0)))`
- `content_items_id_not_null`: `NOT NULL id`
- `content_items_language_not_null`: `NOT NULL language`
- `content_items_media_asset_id_fkey`: `FOREIGN KEY (media_asset_id) REFERENCES media_assets(id) ON UPDATE CASCADE ON DELETE SET NULL`
- `content_items_pkey`: `PRIMARY KEY (id)`
- `content_items_status_check`: `CHECK ((status = ANY (ARRAY['draft'::text, 'in_review'::text, 'published'::text, 'archived'::text])))`
- `content_items_status_not_null`: `NOT NULL status`
- `content_items_title_not_null`: `NOT NULL title`
- `content_items_updated_at_not_null`: `NOT NULL updated_at`

Indexes:
- `content_items_pkey`: `CREATE UNIQUE INDEX content_items_pkey ON public.content_items USING btree (id)`
- `content_items_type_status_idx`: `CREATE INDEX content_items_type_status_idx ON public.content_items USING btree (content_type, status)`

### `media_assets`

No current runtime read/write found.

Columns:
- `id`: text NOT NULL; default `(gen_random_uuid())::text`
- `storage_provider`: text NOT NULL
- `object_key`: text NOT NULL
- `mime_type`: text NOT NULL
- `duration_seconds`: integer NULL
- `license_note`: text NULL
- `visibility`: text NOT NULL; default `'private'::text`
- `legacy_source`: text NULL
- `legacy_asset_id`: text NULL
- `created_at`: timestamp with time zone NOT NULL; default `CURRENT_TIMESTAMP`

Constraints:
- `media_assets_created_at_not_null`: `NOT NULL created_at`
- `media_assets_duration_check`: `CHECK (((duration_seconds IS NULL) OR (duration_seconds >= 0)))`
- `media_assets_id_not_null`: `NOT NULL id`
- `media_assets_mime_type_not_null`: `NOT NULL mime_type`
- `media_assets_object_key_not_null`: `NOT NULL object_key`
- `media_assets_pkey`: `PRIMARY KEY (id)`
- `media_assets_storage_provider_not_null`: `NOT NULL storage_provider`
- `media_assets_visibility_check`: `CHECK ((visibility = ANY (ARRAY['private'::text, 'public'::text])))`
- `media_assets_visibility_not_null`: `NOT NULL visibility`

Indexes:
- `media_assets_legacy_source_id_idx`: `CREATE UNIQUE INDEX media_assets_legacy_source_id_idx ON public.media_assets USING btree (legacy_source, legacy_asset_id) WHERE ((legacy_source IS NOT NULL) AND (legacy_asset_id IS NOT NULL))`
- `media_assets_pkey`: `CREATE UNIQUE INDEX media_assets_pkey ON public.media_assets USING btree (id)`
- `media_assets_storage_provider_object_key_key`: `CREATE UNIQUE INDEX media_assets_storage_provider_object_key_key ON public.media_assets USING btree (storage_provider, object_key)`

### `activity_sessions`

No current runtime read/write found.

Columns:
- `id`: text NOT NULL; default `(gen_random_uuid())::text`
- `user_id`: text NOT NULL
- `content_item_id`: text NOT NULL
- `status`: text NOT NULL; default `'started'::text`
- `started_at`: timestamp with time zone NOT NULL; default `CURRENT_TIMESTAMP`
- `completed_at`: timestamp with time zone NULL

Constraints:
- `activity_sessions_completed_after_started`: `CHECK (((completed_at IS NULL) OR (completed_at >= started_at)))`
- `activity_sessions_content_item_id_fkey`: `FOREIGN KEY (content_item_id) REFERENCES content_items(id) ON UPDATE CASCADE ON DELETE RESTRICT`
- `activity_sessions_content_item_id_not_null`: `NOT NULL content_item_id`
- `activity_sessions_id_not_null`: `NOT NULL id`
- `activity_sessions_pkey`: `PRIMARY KEY (id)`
- `activity_sessions_started_at_not_null`: `NOT NULL started_at`
- `activity_sessions_status_check`: `CHECK ((status = ANY (ARRAY['started'::text, 'completed'::text, 'abandoned'::text])))`
- `activity_sessions_status_not_null`: `NOT NULL status`
- `activity_sessions_user_id_fkey`: `FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE`
- `activity_sessions_user_id_not_null`: `NOT NULL user_id`

Indexes:
- `activity_sessions_pkey`: `CREATE UNIQUE INDEX activity_sessions_pkey ON public.activity_sessions USING btree (id)`
- `activity_sessions_user_time_idx`: `CREATE INDEX activity_sessions_user_time_idx ON public.activity_sessions USING btree (user_id, started_at DESC)`

### `activity_feedback`

No current runtime read/write found.

Columns:
- `id`: text NOT NULL; default `(gen_random_uuid())::text`
- `activity_session_id`: text NOT NULL
- `helpfulness`: text NOT NULL
- `before_mood_score`: smallint NULL
- `after_mood_score`: smallint NULL
- `submitted_at`: timestamp with time zone NOT NULL; default `CURRENT_TIMESTAMP`

Constraints:
- `activity_feedback_activity_session_id_fkey`: `FOREIGN KEY (activity_session_id) REFERENCES activity_sessions(id) ON UPDATE CASCADE ON DELETE CASCADE`
- `activity_feedback_activity_session_id_not_null`: `NOT NULL activity_session_id`
- `activity_feedback_after_mood_score_range`: `CHECK (((after_mood_score IS NULL) OR ((after_mood_score >= 1) AND (after_mood_score <= 10))))`
- `activity_feedback_before_mood_score_range`: `CHECK (((before_mood_score IS NULL) OR ((before_mood_score >= 1) AND (before_mood_score <= 10))))`
- `activity_feedback_helpfulness_check`: `CHECK ((helpfulness = ANY (ARRAY['better'::text, 'same'::text, 'worse'::text, 'skipped'::text])))`
- `activity_feedback_helpfulness_not_null`: `NOT NULL helpfulness`
- `activity_feedback_id_not_null`: `NOT NULL id`
- `activity_feedback_pkey`: `PRIMARY KEY (id)`
- `activity_feedback_submitted_at_not_null`: `NOT NULL submitted_at`

Indexes:
- `activity_feedback_activity_session_id_key`: `CREATE UNIQUE INDEX activity_feedback_activity_session_id_key ON public.activity_feedback USING btree (activity_session_id)`
- `activity_feedback_pkey`: `CREATE UNIQUE INDEX activity_feedback_pkey ON public.activity_feedback USING btree (id)`

### `journal_entries`

No runtime read/write; existing generated journals use daily_emotion_summary.

Columns:
- `id`: text NOT NULL; default `(gen_random_uuid())::text`
- `user_id`: text NOT NULL
- `title`: text NULL
- `body`: text NOT NULL
- `origin`: text NOT NULL; default `'user'::text`
- `created_at`: timestamp with time zone NOT NULL; default `CURRENT_TIMESTAMP`
- `updated_at`: timestamp with time zone NOT NULL; default `CURRENT_TIMESTAMP`

Constraints:
- `journal_entries_body_not_null`: `NOT NULL body`
- `journal_entries_created_at_not_null`: `NOT NULL created_at`
- `journal_entries_id_not_null`: `NOT NULL id`
- `journal_entries_origin_check`: `CHECK ((origin = ANY (ARRAY['user'::text, 'ai_assisted'::text, 'ai_generated'::text])))`
- `journal_entries_origin_not_null`: `NOT NULL origin`
- `journal_entries_pkey`: `PRIMARY KEY (id)`
- `journal_entries_updated_at_not_null`: `NOT NULL updated_at`
- `journal_entries_user_id_fkey`: `FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE`
- `journal_entries_user_id_not_null`: `NOT NULL user_id`

Indexes:
- `journal_entries_pkey`: `CREATE UNIQUE INDEX journal_entries_pkey ON public.journal_entries USING btree (id)`
- `journal_entries_user_time_idx`: `CREATE INDEX journal_entries_user_time_idx ON public.journal_entries USING btree (user_id, created_at DESC)`

### Journal overlap and model

`daily_emotion_summary.ejournal_entry` is the current canonical generated journal, unique by `(user_id,date)`. `backend/src/journal-service/journalGenerator.js` reads messages, generates and writes this field plus summary metadata; nightly jobs skip non-null generated entries and manual refresh may overwrite them. Existing journal routes, insights, and the web journal/calendar use that generated-journal shape. Some source comments saying `journal_entries` does not exist are stale. The V2 `journal_entries` table exists but has no runtime caller. Recommend user-authored entries only in V2 (`origin=user`), with multiple entries/day and CRUD; keep nightly generated journals in daily summaries and existing generated-journal endpoints. Return `kind: user` versus `kind: generated` where presented together. Never dual-write or backfill generated content in 2C. Preserve current clients and nightly idempotence; use distinct API paths and explicitly label generated material. A manual generation request is not a user-written entry.

## 2. Shared API contract

All endpoints below require existing `requireAuth` (JWT plus active session), including catalog. No user ID is accepted as authority: derive it from the session. JSON UTF-8; reject unknown fields, wrong types, invalid IDs, unbounded arrays and bodies over 8 KiB for these routes. Responses use `Cache-Control: no-store`; successful objects use `{ "data": ... }`. Dates use RFC 3339 UTC, local dates `YYYY-MM-DD`. Optional fields may be omitted; `null` explicitly clears only fields described as nullable.

Errors: `400 {"error":{"code":"INVALID_REQUEST","message":"Invalid request"}}`; `401 UNAUTHORIZED`; `403 CONSENT_REQUIRED` only where a gate applies; `404 NOT_FOUND` for absent or other-user resources; `409 CONFLICT` for state conflict; `429 RATE_LIMITED` with `Retry-After`; `503 SERVICE_UNAVAILABLE` with `Retry-After` for DB/provider outage. Do not leak details. New envelopes do not alter existing auth endpoints. Use current in-memory per-IP middleware plus authenticated per-user limits; proposals: 120 reads/min, 30 writes/min, 10 playback resolutions/min, 10 export requests/day, configurable. In-memory limits assume one Render instance; distributed enforcement is future work.

Page response: `{ "data": [ ... ], "nextCursor": "opaque-or-null" }`; default 20, max 50. Signed, bounded cursor contains sort tuple plus filter hash; stable `(created_at DESC,id DESC)` or `(started_at DESC,id DESC)`. Reject invalid cursor or changed filters. Date bounds are inclusive local calendar dates in the stored IANA timezone, converted to `[start-of-first-day, start-of-day-after-last)` UTC with DST rules, not fixed 24-hour increments. UTC is default. Limit ranges to 366 days; changing timezone later changes displayed date grouping, not stored instants.

### Preferences

- `GET /api/me/preferences` → 200 `{ "data": { "language":"en", "timezone":"UTC", "activityTypes":[], "supportModes":[], "accessibility":{} } }`; synthesize defaults without inserting when absent.
- `PUT /api/me/preferences` full replacement, e.g. `{ "language":"en", "timezone":"Asia/Kolkata", "activityTypes":["audio"], "supportModes":["self_guided"], "accessibility":{"reduceMotion":true,"largeText":false} }`; 200 same shape. Language supported BCP-47 subset 2–35 chars; IANA timezone via runtime validator; lists unique, max 10 allowlisted values of 1–40 chars; accessibility exact supported booleans, no arbitrary JSON/URLs. Require all fields on PUT. Upsert scoped row; set `updated_at` explicitly in transaction. Initial activity types `audio`, `breathing`, `meditation`, `sleep`; support modes `self_guided`, `conversation`; review vocabulary before implementation.

### Consent

- `GET /api/me/consents` → 200 `{ "data": [{ "purpose":"personalized_recommendations", "granted":false, "noticeVersion":null, "recordedAt":null }] }`; return each supported purpose, default false if no applicable record. No contact details.
- `POST /api/me/consents` with `{ "purpose":"personalized_recommendations", "granted":true, "noticeVersion":"wellbeing-v1" }` → 201 `{ "data": { "purpose":"personalized_recommendations", "granted":true, "noticeVersion":"wellbeing-v1", "recordedAt":"2026-01-01T00:00:00Z" } }`; reject unknown purpose or stale/unknown notice version; server sets source `in_app`. Each actual change appends a row. Lock per user/purpose in transaction; use database timestamps with strictly monotonic order under the lock (e.g. `greatest(clock_timestamp(), max(recorded_at)+interval '1 microsecond')`), and select latest by `(recorded_at DESC,id DESC)` in database precision; do not truncate to JavaScript milliseconds before ordering. Duplicate same-state requests return current state without a new row, using 200. Withdrawal takes effect in the same transaction as feature state.
- Emergency purpose needs reconciliation: current create/replace and enable append grants, but disabling/deleting contacts does not append a withdrawal, and sending checks `notify_enabled`. Update those paths transactionally under a consistent per-user lock: append withdrawal on disable/delete, grant on enable/new contact, and make dispatch require both current contact `notify_enabled` and latest applicable grant. No historical backfill is needed because no user data exists; a stale prior grant must not imply enabled. Do not let a generic grant silently create/enable a contact. Lock ordering is auth-user (account deletion only), then emergency-contact, then consent; A short transaction checks permission and records dispatching, then releases all locks before the provider call. Withdrawal stops alerts not yet handed to the email provider. Each retry rechecks permission; already-handed-off messages cannot be recalled. With check then release, a narrow race remains if withdrawal commits after the final check but before the provider accepts the request; this design does not claim atomic cancellation.

### Mood check-ins

- `POST /api/me/mood-checkins` `{ "moodLabel":"calm", "moodScore":7, "energyScore":5, "note":"optional" }` → 201 `{ "data": { "id":"…", "moodLabel":"calm", "moodScore":7, "energyScore":5, "note":"optional", "createdAt":"…" } }`. Label 1–40 chars from approved vocabulary; optional nullable integer scores 1–10; note nullable, max 2,000 UTF-8 bytes; server sets time. Never send notes to AI/recommendations without separate informed consent. No schema field stores client timestamp.
- `GET /api/me/mood-checkins?from=YYYY-MM-DD&to=YYYY-MM-DD&limit=20&cursor=…` → page of same shape with timezone rules above; require both bounds, from ≤ to.
- `DELETE /api/me/mood-checkins/{id}` → 204; user-scoped delete, 404 if absent or other-user. Future recommendation FK uses SET NULL.

### Catalog and playback

- `GET /api/content?type=audio&need=relax&language=en&maxDurationSeconds=900&limit=20&cursor=…` → 200 `{ "data":[{"id":"…","title":"…","description":null,"type":"audio","language":"en","durationSeconds":600,"needTags":["relax"],"suitabilityTags":[],"hasAudio":true}], "nextCursor":null }`. Published only; reject unknown types/tags, max one each initially, duration 0–86400 seconds. Never expose provider key, object key, raw admin URL, license notes or drafts.
- `GET /api/content/{id}` returns the public item or 404. `POST /api/content/{id}/playback` with `{}` returns 200 `{ "data": { "url":"https://<website-host>/media/audio/<file>" } }` for a published static asset, 404 if missing, and 503 if the HTTPS website origin is not configured. The URL is public and fixed; no token, expiry or proxy.

### Activity sessions and feedback

- `POST /api/me/activity-sessions` `{ "contentItemId":"…" }` → 201 `{ "data":{"id":"…","contentItemId":"…","status":"started","startedAt":"…","completedAt":null} }`; content must be published at start. No automatic replay of ambiguous creates; show uncertainty before retry.
- `PATCH /api/me/activity-sessions/{id}` `{ "status":"completed" }` or `{ "status":"abandoned" }` → 200 same session. Conditional owned update from `started` only; complete sets server `completedAt`, abandon leaves it null. Repeating same terminal action returns same object; other transitions return 409. Atomic conditional update handles races. No client-supplied user/time.
- `GET /api/me/activity-sessions?limit=20&cursor=…` → page of owned sessions. `GET /api/me/activity-sessions/{id}` → owned session or 404.
- `POST /api/me/activity-sessions/{id}/feedback` `{ "helpfulness":"better", "beforeMoodScore":4, "afterMoodScore":7 }` → 201 `{ "data":{"id":"…","sessionId":"…","helpfulness":"better","beforeMoodScore":4,"afterMoodScore":7,"submittedAt":"…"} }`. Helpfulness `better|same|worse|skipped`; nullable scores integers 1–10. Require owned completed/abandoned session. Unique FK enforces one feedback; exact duplicate retry → 200 existing, different second submission → 409, transaction handles race. Other user's session → 404. `GET /api/me/activity-sessions/{id}/feedback` → 200 or 404.

### User-written journals

- `POST /api/me/journals` `{ "title":"optional", "body":"…" }` → 201 `{ "data":{"id":"…","title":"optional","body":"…","origin":"user","createdAt":"…","updatedAt":"…"} }`.
- `GET /api/me/journals?from=YYYY-MM-DD&to=YYYY-MM-DD&limit=20&cursor=…` → page; `GET /api/me/journals/{id}` → owned entry; `PATCH /api/me/journals/{id}` `{ "title":null,"body":"updated" }` → updated entry; `DELETE /api/me/journals/{id}` → 204. Other-user IDs → 404. Title max 200 characters, body nonempty max 6,000 UTF-8 bytes within 8 KiB request; server controls origin and timestamps. Default list includes body. Explicit optimistic concurrency is deferred; document last-writer-wins. No automatic summarization/AI processing of user-written entries.

## 3. Consent purposes and enforcement

| Purpose | Default | Gate |
|---|---|---|
| `emergency_alert_sharing` | off without an explicit contact/consent; current contact creation grants and enables under existing policy | sharing minimal alert with chosen contact; transactional contact state + latest consent as above |
| `personalized_recommendations` | off | Phase 3 use of mood/activity data for personalization; no recommendation engine in 2C. Basic catalog browsing and voluntary activity remain available. |
| `voice_processing` | off until explicitly granted at first use | sending audio to STT/emotion providers; block before upload/provider call when not granted. Enforce in 2C-1 before upload or provider call; web and Android prompts ship together in 2C-5. Existing web voice is blocked on this feature branch until then. |

No separate consent proposed for core account/session processing or voluntary journal storage; legal basis and wording require review. Withdrawal stops future gated processing, does not silently delete data, and must invalidate queued work. Notice versions are server-owned, never arbitrary client choices. Consent history cascades on account deletion; no claim of immutable retention after deletion. Voice consent is approved and required.

## 4. Catalog and media: approved static website assets

Appwrite holds no data; the five old Android file IDs do not resolve and are not migration inputs. Neon is the only database and there are no existing users or legacy data. Audio and images will be reviewed, publicly licensed static assets in `frontend/public/media/audio/` and `frontend/public/media/images/`, served over HTTPS from the configured Vercel website domain. No token or proxy is part of this design. Android Appwrite code/dependencies are removed in 2C-5.

`media_assets` uses `storage_provider=static_web`, `visibility=public`, `object_key` as an allowlisted normalized `/media/` path, correct MIME/duration and mandatory `license_note` recording source, licence and required attribution. The repository's reviewed catalog JSON records each source URL and licence. The idempotent seed script validates the whole file, local file existence and license metadata, rejects missing license notes and path traversal, starts with dry run, verifies branch identity and uses stable IDs. Apply development first, then production only with separate approval. No publishing until licensing and attribution are verified.

The resolver interface validates the configured HTTPS website origin and object path and returns a fixed public URL from the playback endpoint. No tokens and no proxy. The interface permits future providers without changing API consumers; these public URLs are not secrets and have no artificial expiry.

One reviewed migration in 2C-3 adds `content_items.image_asset_id TEXT NULL` and foreign key to `media_assets(id) ON DELETE SET NULL ON UPDATE CASCADE`. Show exact SQL before applying to development only. Keep audio in `media_asset_id` and image in `image_asset_id`; explicit select and independent metadata validation.

## 5. Privacy and security

Ownership is checked inside every query and mutation, including feedback via session join; 404 prevents cross-user existence disclosure. Validate request sizes, JSON shapes and allowlists; avoid dynamic SQL and mass assignment. Notes, journal bodies, scores and preferences are sensitive: authenticated transport, encryption at rest as provided by deployment, explicit selects, no content in logs/URLs/analytics/traces, no AI use without approved notice and consent. Use the existing privacy logger with allowlisted structured events only. Do not promise additional field encryption without key management. Deletion cascades user → preferences/consents/mood/journals/sessions → feedback; shared catalog assets remain; future recommendation mood FK is SET NULL. Verify deployed FKs and account-delete behavior with development integration tests.

Propose `POST /api/me/exports` returning a short-lived one-time download or synchronous bounded export only after reauthentication, with non-PII audit event, no-store, size limits, explicit expiry and provider-data limits; decide scope/format before implementation. Do not promise access to provider-held copies. Rate limits and consent gating as above.

## 6. Schema and correctness decision

**2C-1 and 2C-2 need no migration; 2C-3 requires the approved image FK migration**, using existing checks, keys and scoped transactions. No offline queue and no request replay guarantee for mood writes avoid inventing idempotency/time semantics. Critical limits: no DB constraint makes consent event ordering strict at equal timestamps; use per-purpose advisory lock and database-precision monotonic timestamp in every writer. Existing emergency writers must be migrated to the same rule atomically. JSON has no schema enforcement; validate in API. Session table lacks optimistic version and idempotency key; conditional transitions suffice but initial POST response loss is ambiguous. The approved thumbnail requirement needs the one 2C-3 migration described above; content external identifier, provider configuration, and licensing enforcement need application-level validation. Catalog uses stable IDs and existing indexes.

If reliable offline check-ins are required, propose a **separate reviewed migration**: add nullable `client_request_id UUID` and nullable `occurred_at TIMESTAMPTZ(6)` to `mood_checkins`, unique `(user_id,client_request_id)` where not null, retain `created_at` as receipt time; define timezone, dedupe and conflict policies before implementing. Do not apply in this phase. A consent sequence column or per-purpose state table may be preferable if cross-writer monotonic ordering cannot be assured; STOP and review rather than silently weaken latest-wins. Apply any reviewed migration to development first, then production only after approval.

## 7. Client impact and offline

Website calls APIs via existing `lib/api.ts` access-token path; introduce typed modules, calendar rendering for user-authored versus generated journals, consent explanation/toggle and privacy-safe error states. Android removes dead Appwrite code and dependency in 2C-5, replacing hardcoded lists with catalog IDs and static playback resolution; use existing authenticated networking and screens, preserve playback service. Android can cache public catalog metadata with expiry; static public playback URLs are not bearer tokens. Approved: **no offline mood queue in 2C**: show offline and keep unsent input only in screen memory; submit after reconnect, never imply saved. Encrypted durable queue, client occurrence time, idempotency keys, logout/deletion handling and conflict resolution need the migration and design above. Devices may lose drafts on process death; state this in UX. Do not use Android clocks as authoritative creation timestamps.

## 8. Tests and delivery phases

- **2C-1 — contracts, preferences and consents (2–3 days):** schemas, auth and timezone validation, fake unit tests, real-development integration for ownership, default state, grant/withdraw races, existing emergency-contact reconciliation and stale notice. STOP for review.
- **2C-2 — moods and user journals (2–3 days):** date/DST boundaries, byte limits, timestamp cursor ties, cross-user 404, cascade, no AI use; generated journal regression and nightly idempotence. STOP.
- **2C-3 — reviewed catalog and playback (2–4 days):** seed dry-run/idempotence/target guard, five-file review, publication filtering, static path safety, asset availability, license metadata, fixed public URL origin. No production seed until separately approved. STOP.
- **2C-4 — sessions and feedback (2–3 days):** state transition, duplicate terminal action, concurrent feedback uniqueness, cross-user attacks, no accepted feedback for started session, account-delete cascade. STOP.
- **2C-5 — client wiring and end-to-end (3–5 days):** web unit/build/manual, Android JVM/Compose as available and physical-phone offline/reconnect/playback, two users, consent withdrawal and account revocation; development-only synthetic accounts cleaned in finally and counts checked. STOP. Estimates are engineering days excluding licensing, consent/legal review and production rollout; total 11–18 days.

- **2C-6 ? Data export (estimate after scope review):** required before public launch; define export coverage, reauthentication, expiry, security and tests before implementation. STOP for review.

## 9. Approved decisions and delivery conditions

1. **Journal split:** recommend V2 user-written and existing daily summary generated, separate routes; no migration of old generated entries.
2. **Emergency consent reconciliation:** recommend append withdrawals and enforce both latest consent and contact flag; no backfill because there are no existing users or legacy data.
3. **Voice consent:** approved opt-in before uploads/provider calls in 2C-1; web and Android prompts ship together in 2C-5.
4. **Personalization:** recommend opt-in default off, gate Phase 3 only; no recommendations in 2C.
5. **Mood/offline:** recommend no durable queue in 2C; approve a separate migration only if reliable offline submission is required.
6. **Content licensing and thumbnails:** source new licensed files; apply the approved image relation migration in 2C-3 after showing SQL.
7. **Static media:** public Vercel assets only; no tokens, no Appwrite, no proxy.
8. **Catalog taxonomy, timezone semantics, body limits and rate limits:** approved as proposed.
9. **Data export:** required before public launch in the named phase **2C-6 Data export**; approve scope and reauthentication/expiry before building.
10. **Consent ordering:** approved advisory-lock/monotonic timestamp protocol across every writer; choose minimal migration if concurrency proof fails.
