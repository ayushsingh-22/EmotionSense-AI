-- Unified Wellbeing Platform V2: additive migration only.
-- Run first against an isolated Neon development branch with sanitized data.
-- This script creates NEW tables. It does not modify existing application tables.
-- Existing public.users(id) is TEXT according to supplied schema export.
BEGIN;

CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id TEXT PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  preferred_language TEXT NOT NULL DEFAULT 'en',
  preferred_support_modes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  preferred_activity_types TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  timezone TEXT NOT NULL DEFAULT 'UTC',
  accessibility_preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_consents (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL,
  notice_version TEXT NOT NULL,
  granted BOOLEAN NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source TEXT NOT NULL DEFAULT 'in_app',
  CHECK (length(trim(purpose)) > 0)
);
CREATE INDEX IF NOT EXISTS user_consents_user_purpose_time_idx ON public.user_consents(user_id, purpose, recorded_at DESC);

CREATE TABLE IF NOT EXISTS public.mood_checkins (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  mood_label TEXT NOT NULL,
  mood_score SMALLINT,
  energy_score SMALLINT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (mood_score IS NULL OR mood_score BETWEEN 1 AND 10),
  CHECK (energy_score IS NULL OR energy_score BETWEEN 1 AND 10)
);
CREATE INDEX IF NOT EXISTS mood_checkins_user_time_idx ON public.mood_checkins(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.journal_entries (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT,
  body TEXT NOT NULL,
  origin TEXT NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (origin IN ('user', 'ai_assisted', 'ai_generated'))
);
CREATE INDEX IF NOT EXISTS journal_entries_user_time_idx ON public.journal_entries(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.media_assets (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  storage_provider TEXT NOT NULL,
  object_key TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  duration_seconds INTEGER,
  license_note TEXT,
  visibility TEXT NOT NULL DEFAULT 'private',
  legacy_source TEXT,
  legacy_asset_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (storage_provider, object_key),
  CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  CHECK (visibility IN ('private','public'))
);
CREATE UNIQUE INDEX IF NOT EXISTS media_assets_legacy_source_id_idx ON public.media_assets(legacy_source, legacy_asset_id)
  WHERE legacy_source IS NOT NULL AND legacy_asset_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.content_items (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title TEXT NOT NULL,
  description TEXT,
  content_type TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'en',
  duration_seconds INTEGER,
  need_tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  suitability_tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  media_asset_id TEXT REFERENCES public.media_assets(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  review_version TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (status IN ('draft','in_review','published','archived')),
  CHECK (duration_seconds IS NULL OR duration_seconds >= 0)
);
CREATE INDEX IF NOT EXISTS content_items_type_status_idx ON public.content_items(content_type, status);

CREATE TABLE IF NOT EXISTS public.activity_sessions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content_item_id TEXT NOT NULL REFERENCES public.content_items(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'started',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  CHECK (status IN ('started','completed','abandoned')),
  CHECK (completed_at IS NULL OR completed_at >= started_at)
);
CREATE INDEX IF NOT EXISTS activity_sessions_user_time_idx ON public.activity_sessions(user_id, started_at DESC);

CREATE TABLE IF NOT EXISTS public.activity_feedback (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  activity_session_id TEXT NOT NULL UNIQUE REFERENCES public.activity_sessions(id) ON DELETE CASCADE,
  helpfulness TEXT NOT NULL,
  before_mood_score SMALLINT,
  after_mood_score SMALLINT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (helpfulness IN ('better','same','worse','skipped')),
  CHECK (before_mood_score IS NULL OR before_mood_score BETWEEN 1 AND 10),
  CHECK (after_mood_score IS NULL OR after_mood_score BETWEEN 1 AND 10)
);

CREATE TABLE IF NOT EXISTS public.recommendation_runs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  mood_checkin_id TEXT REFERENCES public.mood_checkins(id) ON DELETE SET NULL,
  rules_version TEXT NOT NULL,
  context_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS recommendation_runs_user_time_idx ON public.recommendation_runs(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.recommendation_items (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  recommendation_run_id TEXT NOT NULL REFERENCES public.recommendation_runs(id) ON DELETE CASCADE,
  content_item_id TEXT NOT NULL REFERENCES public.content_items(id) ON DELETE RESTRICT,
  position SMALLINT NOT NULL,
  score DOUBLE PRECISION,
  reason_code TEXT,
  selected_at TIMESTAMPTZ,
  UNIQUE (recommendation_run_id, position),
  UNIQUE (recommendation_run_id, content_item_id),
  CHECK (position >= 1),
  CHECK (score IS NULL OR (score >= 0 AND score <= 1))
);

COMMIT;
