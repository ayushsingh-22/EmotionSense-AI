-- Phase 2B.2: unified identity foundation (Firebase <-> users.id).
--
-- NOT PURELY ADDITIVE. This migration contains exactly ONE relaxation of an existing
-- column constraint, and ONE new unique constraint on an existing table:
--   1. users.password_hash: NOT NULL is DROPPED (ALTER COLUMN ... DROP NOT NULL).
--      Existing values are untouched. NULL is reserved for accounts with no password
--      credential (Firebase-only); application code already treats a NULL hash as
--      "cannot authenticate" (frontend/lib/passwordVerify.ts).
--   2. users gains UNIQUE INDEX on lower(email) (case-insensitive uniqueness). This can
--      FAIL if case-insensitive duplicate emails exist; the guard below aborts the whole
--      migration with a clear message instead (no user rows are ever modified or merged).
-- Everything else is new: users.email_verified_at (nullable, no backfill: historic web
-- accounts are NOT marked verified) and the auth_identities table.
-- No DROP / DELETE / UPDATE / TRUNCATE / RENAME statements. users.id, users.email and all
-- 16 foreign keys referencing users are unchanged. Migrations 20260923032421_init and
-- 20261012181122_add_wellbeing_v2 are not touched.

-- Locking / failure behaviour (all statements run in ONE transaction, so the migration is
-- all-or-nothing). ALTER TABLE users takes a brief ACCESS EXCLUSIVE lock (metadata-only: no
-- rewrite, no default), CREATE UNIQUE INDEX takes a SHARE lock (reads allowed, writes wait),
-- and the foreign key briefly locks users against writes. Locks are held until commit. To
-- avoid queueing behind a long-running transaction (which would in turn block every login),
-- the migration gives up after 5s of lock waiting instead of waiting indefinitely. A failure
-- leaves the schema unchanged; only Prisma's _prisma_migrations row is left marked failed.
-- SET LOCAL lasts only until the end of this transaction (no session-level change).
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- Guard: refuse to proceed (rolling back the whole migration) on case-insensitive
-- duplicate emails. Intentionally prints no email addresses.
DO $$
DECLARE dup_groups integer;
BEGIN
  -- Fail closed: SET LOCAL only takes effect inside a transaction block. If the statements of
  -- this file were ever executed one-by-one (autocommit), the migration would no longer be
  -- atomic, so refuse to run before any DDL is attempted.
  IF current_setting('lock_timeout') <> '5s' THEN
    RAISE EXCEPTION 'migration is not running inside a single transaction (SET LOCAL had no effect); refusing to run non-atomically';
  END IF;
  SELECT count(*) INTO dup_groups
  FROM (SELECT 1 FROM "users" GROUP BY lower("email") HAVING count(*) > 1) d;
  IF dup_groups > 0 THEN
    RAISE EXCEPTION 'users has % case-insensitive duplicate email group(s); resolve them manually before applying this migration', dup_groups;
  END IF;
END $$;

-- AlterTable (constraint relaxation + new nullable column)
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;
ALTER TABLE "users" ADD COLUMN "email_verified_at" TIMESTAMPTZ(6);

-- CreateIndex (case-insensitive email uniqueness; the existing case-sensitive
-- "users_email_key" is kept so Prisma's findUnique({ email }) keeps working)
CREATE UNIQUE INDEX "users_email_lower_key" ON "users"(lower("email"));

-- CreateTable
CREATE TABLE "auth_identities" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "user_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_project" TEXT NOT NULL,
    "provider_sub" TEXT NOT NULL,
    "sign_in_method" TEXT,
    "email_at_link" TEXT,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "link_method" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_login_at" TIMESTAMPTZ(6),
    "disabled_at" TIMESTAMPTZ(6),

    CONSTRAINT "auth_identities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "auth_identities_user_id_idx" ON "auth_identities"("user_id");

-- CreateIndex (one provider subject maps to exactly one user)
CREATE UNIQUE INDEX "auth_identities_provider_project_sub_key" ON "auth_identities"("provider", "provider_project", "provider_sub");

-- AddForeignKey (deleting a user removes their identity links; never the reverse)
ALTER TABLE "auth_identities" ADD CONSTRAINT "auth_identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Data-integrity checks (not expressible in Prisma, same convention as the V2 migration)
ALTER TABLE "auth_identities" ADD CONSTRAINT "auth_identities_provider_format" CHECK ("provider" ~ '^[a-z][a-z0-9_-]{1,31}$');
ALTER TABLE "auth_identities" ADD CONSTRAINT "auth_identities_project_not_empty" CHECK (length(trim("provider_project")) > 0 AND length("provider_project") <= 256);
ALTER TABLE "auth_identities" ADD CONSTRAINT "auth_identities_sub_not_empty" CHECK (length(trim("provider_sub")) > 0 AND length("provider_sub") <= 256);
-- No 'email' / 'auto' value exists on purpose: linking by email alone is not representable.
ALTER TABLE "auth_identities" ADD CONSTRAINT "auth_identities_link_method_allowed" CHECK ("link_method" IN ('created', 'password_proof', 'email_link', 'admin'));
ALTER TABLE "auth_identities" ADD CONSTRAINT "auth_identities_sign_in_method_not_empty" CHECK ("sign_in_method" IS NULL OR length(trim("sign_in_method")) > 0);
ALTER TABLE "auth_identities" ADD CONSTRAINT "auth_identities_email_at_link_normalised" CHECK ("email_at_link" IS NULL OR ("email_at_link" = lower("email_at_link") AND length("email_at_link") BETWEEN 3 AND 254));
