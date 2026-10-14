-- CreateTable
CREATE TABLE "user_preferences" (
    "user_id" TEXT NOT NULL,
    "preferred_language" TEXT NOT NULL DEFAULT 'en',
    "preferred_support_modes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "preferred_activity_types" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "accessibility_preferences" JSONB NOT NULL DEFAULT '{}',
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "user_consents" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "user_id" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "notice_version" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "recorded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'in_app',

    CONSTRAINT "user_consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mood_checkins" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "user_id" TEXT NOT NULL,
    "mood_label" TEXT NOT NULL,
    "mood_score" SMALLINT,
    "energy_score" SMALLINT,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mood_checkins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_entries" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "user_id" TEXT NOT NULL,
    "title" TEXT,
    "body" TEXT NOT NULL,
    "origin" TEXT NOT NULL DEFAULT 'user',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_assets" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "storage_provider" TEXT NOT NULL,
    "object_key" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "duration_seconds" INTEGER,
    "license_note" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'private',
    "legacy_source" TEXT,
    "legacy_asset_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_items" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "content_type" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "duration_seconds" INTEGER,
    "need_tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "suitability_tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "media_asset_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "review_version" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_sessions" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "user_id" TEXT NOT NULL,
    "content_item_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'started',
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "activity_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_feedback" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "activity_session_id" TEXT NOT NULL,
    "helpfulness" TEXT NOT NULL,
    "before_mood_score" SMALLINT,
    "after_mood_score" SMALLINT,
    "submitted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendation_runs" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "user_id" TEXT NOT NULL,
    "mood_checkin_id" TEXT,
    "rules_version" TEXT NOT NULL,
    "context_code" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recommendation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendation_items" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "recommendation_run_id" TEXT NOT NULL,
    "content_item_id" TEXT NOT NULL,
    "position" SMALLINT NOT NULL,
    "score" DOUBLE PRECISION,
    "reason_code" TEXT,
    "selected_at" TIMESTAMPTZ(6),

    CONSTRAINT "recommendation_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_consents_user_purpose_time_idx" ON "user_consents"("user_id", "purpose", "recorded_at" DESC);

-- CreateIndex
CREATE INDEX "mood_checkins_user_time_idx" ON "mood_checkins"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "journal_entries_user_time_idx" ON "journal_entries"("user_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "media_assets_storage_provider_object_key_key" ON "media_assets"("storage_provider", "object_key");

-- CreateIndex
CREATE INDEX "content_items_type_status_idx" ON "content_items"("content_type", "status");

-- CreateIndex
CREATE INDEX "activity_sessions_user_time_idx" ON "activity_sessions"("user_id", "started_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "activity_feedback_activity_session_id_key" ON "activity_feedback"("activity_session_id");

-- CreateIndex
CREATE INDEX "recommendation_runs_user_time_idx" ON "recommendation_runs"("user_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "recommendation_items_recommendation_run_id_position_key" ON "recommendation_items"("recommendation_run_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "recommendation_items_recommendation_run_id_content_item_id_key" ON "recommendation_items"("recommendation_run_id", "content_item_id");

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_consents" ADD CONSTRAINT "user_consents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mood_checkins" ADD CONSTRAINT "mood_checkins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_media_asset_id_fkey" FOREIGN KEY ("media_asset_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_sessions" ADD CONSTRAINT "activity_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_sessions" ADD CONSTRAINT "activity_sessions_content_item_id_fkey" FOREIGN KEY ("content_item_id") REFERENCES "content_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_feedback" ADD CONSTRAINT "activity_feedback_activity_session_id_fkey" FOREIGN KEY ("activity_session_id") REFERENCES "activity_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_runs" ADD CONSTRAINT "recommendation_runs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_runs" ADD CONSTRAINT "recommendation_runs_mood_checkin_id_fkey" FOREIGN KEY ("mood_checkin_id") REFERENCES "mood_checkins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_items" ADD CONSTRAINT "recommendation_items_recommendation_run_id_fkey" FOREIGN KEY ("recommendation_run_id") REFERENCES "recommendation_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_items" ADD CONSTRAINT "recommendation_items_content_item_id_fkey" FOREIGN KEY ("content_item_id") REFERENCES "content_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CheckConstraint (not expressible in Prisma schema; added by hand)
ALTER TABLE "user_consents" ADD CONSTRAINT "user_consents_purpose_not_empty" CHECK (length(trim("purpose")) > 0);

ALTER TABLE "mood_checkins" ADD CONSTRAINT "mood_checkins_mood_score_range" CHECK ("mood_score" IS NULL OR "mood_score" BETWEEN 1 AND 10);
ALTER TABLE "mood_checkins" ADD CONSTRAINT "mood_checkins_energy_score_range" CHECK ("energy_score" IS NULL OR "energy_score" BETWEEN 1 AND 10);

ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_origin_check" CHECK ("origin" IN ('user', 'ai_assisted', 'ai_generated'));

ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_duration_check" CHECK ("duration_seconds" IS NULL OR "duration_seconds" >= 0);
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_visibility_check" CHECK ("visibility" IN ('private', 'public'));

ALTER TABLE "content_items" ADD CONSTRAINT "content_items_status_check" CHECK ("status" IN ('draft', 'in_review', 'published', 'archived'));
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_duration_check" CHECK ("duration_seconds" IS NULL OR "duration_seconds" >= 0);

ALTER TABLE "activity_sessions" ADD CONSTRAINT "activity_sessions_status_check" CHECK ("status" IN ('started', 'completed', 'abandoned'));
ALTER TABLE "activity_sessions" ADD CONSTRAINT "activity_sessions_completed_after_started" CHECK ("completed_at" IS NULL OR "completed_at" >= "started_at");

ALTER TABLE "activity_feedback" ADD CONSTRAINT "activity_feedback_helpfulness_check" CHECK ("helpfulness" IN ('better', 'same', 'worse', 'skipped'));
ALTER TABLE "activity_feedback" ADD CONSTRAINT "activity_feedback_before_mood_score_range" CHECK ("before_mood_score" IS NULL OR "before_mood_score" BETWEEN 1 AND 10);
ALTER TABLE "activity_feedback" ADD CONSTRAINT "activity_feedback_after_mood_score_range" CHECK ("after_mood_score" IS NULL OR "after_mood_score" BETWEEN 1 AND 10);

ALTER TABLE "recommendation_items" ADD CONSTRAINT "recommendation_items_position_check" CHECK ("position" >= 1);
ALTER TABLE "recommendation_items" ADD CONSTRAINT "recommendation_items_score_range" CHECK ("score" IS NULL OR ("score" >= 0 AND "score" <= 1));

-- Partial unique index (not expressible in Prisma schema; added by hand)
CREATE UNIQUE INDEX "media_assets_legacy_source_id_idx" ON "media_assets"("legacy_source", "legacy_asset_id")
  WHERE "legacy_source" IS NOT NULL AND "legacy_asset_id" IS NOT NULL;
