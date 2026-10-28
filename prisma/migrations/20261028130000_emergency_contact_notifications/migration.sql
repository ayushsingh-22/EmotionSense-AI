-- Prisma executes the migration as one transaction, as in the preceding migrations.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $$
BEGIN
  IF current_setting('lock_timeout') <> '5s' THEN
    RAISE EXCEPTION 'migration is not running inside a single transaction';
  END IF;
  LOCK TABLE "emergency_contacts" IN ACCESS EXCLUSIVE MODE;
  IF EXISTS (SELECT 1 FROM "emergency_contacts") THEN
    RAISE EXCEPTION 'emergency_contacts is not empty; refusing to change notification defaults';
  END IF;
END $$;

ALTER TABLE "emergency_contacts"
  ADD COLUMN "notify_enabled" BOOLEAN NOT NULL DEFAULT true;
