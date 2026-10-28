-- Prisma executes the migration as one transaction, as in 20261014/20261016.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- Fail closed if transaction-local settings are ineffective or either table has rows.
-- Locks prevent inserts between the checks and the drops.
DO $$
BEGIN
  IF current_setting('lock_timeout') <> '5s' THEN
    RAISE EXCEPTION 'migration is not running inside a single transaction; refusing to run non-atomically';
  END IF;
  LOCK TABLE "auth_link_challenges", "auth_identities" IN ACCESS EXCLUSIVE MODE;
  IF EXISTS (SELECT 1 FROM "auth_identities") THEN
    RAISE EXCEPTION 'auth_identities is not empty; refusing to drop it';
  END IF;
  IF EXISTS (SELECT 1 FROM "auth_link_challenges") THEN
    RAISE EXCEPTION 'auth_link_challenges is not empty; refusing to drop it';
  END IF;
END $$;

DROP TABLE "auth_link_challenges";
DROP TABLE "auth_identities";

CREATE TABLE "auth_sessions" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "user_id" TEXT NOT NULL,
    "family_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "device_label" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMPTZ(6),
    "first_used_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "consumed_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),
    "replaced_by_id" TEXT,
    -- Authenticated encryption of the already-issued child pair; backend policy is 30 seconds.
    "replay_ciphertext" BYTEA,
    "replay_expires_at" TIMESTAMPTZ(6),
    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "auth_sessions_expiry_check" CHECK ("expires_at" > "created_at"),
    CONSTRAINT "auth_sessions_replay_check" CHECK (
      ("replay_ciphertext" IS NULL AND "replay_expires_at" IS NULL)
      OR ("replay_ciphertext" IS NOT NULL AND "replay_expires_at" IS NOT NULL
          AND "consumed_at" IS NOT NULL AND "replay_expires_at" > "consumed_at"
          AND "replay_expires_at" <= "consumed_at" + INTERVAL '5 minutes')
    )
);

CREATE UNIQUE INDEX "auth_sessions_token_hash_key" ON "auth_sessions"("token_hash");
CREATE UNIQUE INDEX "auth_sessions_replaced_by_id_key" ON "auth_sessions"("replaced_by_id");
CREATE INDEX "auth_sessions_user_id_idx" ON "auth_sessions"("user_id");
CREATE INDEX "auth_sessions_family_id_idx" ON "auth_sessions"("family_id");
CREATE INDEX "auth_sessions_expires_at_idx" ON "auth_sessions"("expires_at");
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_replaced_by_id_fkey"
  FOREIGN KEY ("replaced_by_id") REFERENCES "auth_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "auth_challenges" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "user_id" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "consumed_at" TIMESTAMPTZ(6),
    "invalidated_at" TIMESTAMPTZ(6),
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "last_sent_at" TIMESTAMPTZ(6),
    CONSTRAINT "auth_challenges_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "auth_challenges_purpose_check" CHECK ("purpose" IN ('verify_email', 'reset_password')),
    CONSTRAINT "auth_challenges_expiry_check" CHECK ("expires_at" > "created_at" AND "expires_at" <= "created_at" + INTERVAL '60 minutes'),
    CONSTRAINT "auth_challenges_attempts_check" CHECK ("max_attempts" > 0 AND "attempt_count" >= 0 AND "attempt_count" <= "max_attempts")
);

CREATE INDEX "auth_challenges_user_purpose_created_idx" ON "auth_challenges"("user_id", "purpose", "created_at");
CREATE INDEX "auth_challenges_expires_at_idx" ON "auth_challenges"("expires_at");
-- Expired challenges must be invalidated transactionally before creating a replacement.
CREATE UNIQUE INDEX "auth_challenges_one_active_key" ON "auth_challenges"("user_id", "purpose")
  WHERE "consumed_at" IS NULL AND "invalidated_at" IS NULL;
ALTER TABLE "auth_challenges" ADD CONSTRAINT "auth_challenges_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

