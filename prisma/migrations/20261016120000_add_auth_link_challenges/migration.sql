-- Phase 2B.5B.1: one-time account-linking challenges (database foundation only).
--
-- PURELY ADDITIVE: creates one new table with its indexes, foreign key and CHECK constraints. No existing table,
-- column, constraint or row is altered. No backfill (in particular users.email_verified_at is not touched).
-- No DROP / DELETE / UPDATE / TRUNCATE / RENAME statements.
--
-- What is stored: a hex SHA-256 DIGEST of a 32-byte random challenge (never the challenge itself), the target
-- canonical users.id (server-derived), the proven Firebase identity (provider, project, subject), the purpose, and a hex
-- SHA-256 fingerprint of the target's password hash at proof time (never the hash itself). Never stored: passwords,
-- password hashes, Firebase ID tokens, API tokens, raw challenges.
--
-- Locking / failure behaviour: one transaction (all-or-nothing). CREATE TABLE / CREATE INDEX on the new, empty table
-- take no locks on existing tables; the FOREIGN KEY briefly takes a SHARE ROW EXCLUSIVE lock on "users" (blocks writes
-- to users for milliseconds, reads continue). The migration gives up after 5s of lock waiting instead of queueing behind
-- a long transaction. SET LOCAL lasts only until the end of this transaction.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- Fail closed: SET LOCAL only takes effect inside a transaction block. If the statements of this file were ever
-- executed one-by-one (autocommit), refuse before any DDL is attempted. (Detects an ineffective SET LOCAL; it is not by
-- itself a proof of atomicity.)
DO $$
BEGIN
  IF current_setting('lock_timeout') <> '5s' THEN
    RAISE EXCEPTION 'migration is not running inside a single transaction (SET LOCAL had no effect); refusing to run non-atomically';
  END IF;
END $$;

-- CreateTable
CREATE TABLE "auth_link_challenges" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "challenge_hash" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_project" TEXT NOT NULL,
    "provider_sub" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "credential_fingerprint" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "consumed_at" TIMESTAMPTZ(6),

    CONSTRAINT "auth_link_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (lookup by digest; uniqueness makes a digest collision / double insert impossible)
CREATE UNIQUE INDEX "auth_link_challenges_challenge_hash_key" ON "auth_link_challenges"("challenge_hash");

-- CreateIndex (per-user lookups and the ON DELETE CASCADE from users)
CREATE INDEX "auth_link_challenges_user_id_idx" ON "auth_link_challenges"("user_id");

-- CreateIndex (cleanup of expired challenges)
CREATE INDEX "auth_link_challenges_expires_at_idx" ON "auth_link_challenges"("expires_at");

-- CreateIndex (invalidate earlier open challenges of the same Firebase identity; rate/abuse checks)
CREATE INDEX "auth_link_challenges_provider_identity_idx" ON "auth_link_challenges"("provider", "provider_project", "provider_sub");

-- AddForeignKey (deleting a user removes their challenges; a challenge can never outlive its target account)
ALTER TABLE "auth_link_challenges" ADD CONSTRAINT "auth_link_challenges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Data-integrity checks (not expressible in Prisma; same convention as the earlier migrations)
-- Only a 64-hex-char SHA-256 digest can be stored: a raw (base64url) challenge or any other value is rejected.
ALTER TABLE "auth_link_challenges" ADD CONSTRAINT "auth_link_challenges_challenge_hash_format" CHECK ("challenge_hash" ~ '^[0-9a-f]{64}$');
ALTER TABLE "auth_link_challenges" ADD CONSTRAINT "auth_link_challenges_credential_fingerprint_format" CHECK ("credential_fingerprint" ~ '^[0-9a-f]{64}$');
ALTER TABLE "auth_link_challenges" ADD CONSTRAINT "auth_link_challenges_purpose_allowed" CHECK ("purpose" IN ('link_firebase'));
ALTER TABLE "auth_link_challenges" ADD CONSTRAINT "auth_link_challenges_provider_format" CHECK ("provider" ~ '^[a-z][a-z0-9_-]{1,31}$');
ALTER TABLE "auth_link_challenges" ADD CONSTRAINT "auth_link_challenges_project_not_empty" CHECK (length(trim("provider_project")) > 0 AND length("provider_project") <= 256);
ALTER TABLE "auth_link_challenges" ADD CONSTRAINT "auth_link_challenges_sub_not_empty" CHECK (length(trim("provider_sub")) > 0 AND length("provider_sub") <= 256);
-- Lifetime is enforced by the database itself: strictly positive and never longer than 5 minutes.
ALTER TABLE "auth_link_challenges" ADD CONSTRAINT "auth_link_challenges_lifetime" CHECK ("expires_at" > "created_at" AND "expires_at" <= "created_at" + interval '5 minutes');
-- A challenge can only be consumed inside its validity window (never before creation, never after expiry).
ALTER TABLE "auth_link_challenges" ADD CONSTRAINT "auth_link_challenges_consumed_in_window" CHECK ("consumed_at" IS NULL OR ("consumed_at" >= "created_at" AND "consumed_at" <= "expires_at"));
