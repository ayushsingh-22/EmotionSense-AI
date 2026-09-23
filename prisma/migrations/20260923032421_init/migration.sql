-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT,
    "avatar_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "session_title" TEXT NOT NULL DEFAULT 'New Chat',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "emotion" TEXT,
    "emotion_confidence" DOUBLE PRECISION,
    "audio_url" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emergency_contacts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "contact_name" TEXT NOT NULL,
    "contact_email" TEXT NOT NULL,
    "contact_phone" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "emergency_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "safety_alerts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "emergency_contact_id" TEXT,
    "detected_emotion" TEXT,
    "message_text" TEXT,
    "alert_sent" BOOLEAN NOT NULL DEFAULT false,
    "alert_sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "safety_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emotion_analysis" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "input_text" TEXT,
    "transcript" TEXT,
    "emotion" TEXT,
    "confidence" DOUBLE PRECISION,
    "scores" JSONB,
    "audio_features" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "emotion_analysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emotion_flow_segments" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "segment" TEXT,
    "dominant_emotion" TEXT,
    "intensity" DOUBLE PRECISION,
    "summary" TEXT,

    CONSTRAINT "emotion_flow_segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_emotion_summary" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "dominant_emotion" TEXT,
    "emotion_distribution" JSONB,
    "mood_score" DOUBLE PRECISION,
    "total_entries" INTEGER NOT NULL DEFAULT 0,
    "time_segments" JSONB,
    "trend_points" JSONB,
    "compass_points" JSONB,
    "emotion_flow" JSONB,
    "segment_summary" JSONB,
    "key_moments" JSONB,
    "summary_text" TEXT,
    "ejournal_entry" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_emotion_summary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weekly_emotion_summary" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "week_start" TEXT NOT NULL,
    "week_end" TEXT NOT NULL,
    "dominant_emotion" TEXT,
    "weekly_arc" JSONB,
    "average_mood_score" DOUBLE PRECISION,
    "key_highlights" JSONB,
    "weekly_moment_flow" JSONB,
    "weekly_reflection" TEXT,
    "weekly_summary_text" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "weekly_emotion_summary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_user_activity" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "session_id" TEXT,
    "activity_type" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "content" TEXT,
    "emotion_data" JSONB,
    "metadata" JSONB,
    "local_date" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "master_user_activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "contact_email" TEXT,
    "alert_type" TEXT NOT NULL DEFAULT 'emotional_distress',
    "message_excerpt" TEXT,
    "additional_data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alert_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "emergency_contacts_user_id_key" ON "emergency_contacts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "daily_emotion_summary_user_id_date_key" ON "daily_emotion_summary"("user_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "weekly_emotion_summary_user_id_week_start_week_end_key" ON "weekly_emotion_summary"("user_id", "week_start", "week_end");

-- AddForeignKey
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "chat_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergency_contacts" ADD CONSTRAINT "emergency_contacts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "safety_alerts" ADD CONSTRAINT "safety_alerts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emotion_analysis" ADD CONSTRAINT "emotion_analysis_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emotion_flow_segments" ADD CONSTRAINT "emotion_flow_segments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_emotion_summary" ADD CONSTRAINT "daily_emotion_summary_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_emotion_summary" ADD CONSTRAINT "weekly_emotion_summary_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_user_activity" ADD CONSTRAINT "master_user_activity_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_logs" ADD CONSTRAINT "alert_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
