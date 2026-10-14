# MantraAI + MindHaven unified Neon V2 — code review package

## Verified inputs
- Supplied `schema.prisma` (235 lines) has 11 Prisma models for legacy MantraAI tables.
- Supplied baseline `migration.sql` creates those 11 tables, with `TEXT` IDs and existing unique indexes.
- Supplied `migration_lock.toml` says `provider = "postgresql"`.
- Existing `User.id` is a Prisma `String` mapped to PostgreSQL `TEXT`; V2 foreign keys retain `TEXT` rather than switching to UUID.
- Both original backend and frontend Prisma Client generators are preserved verbatim. **Confirm their output paths relative to the actual on-disk schema location**, because they are `../backend` and `../frontend`.

## Deliverables
- `schema.v2.prisma`: merged reference of the user's actual legacy schema and ten new models, with `User` inverse relations wired up.
- `001_additive_wellbeing_v2.sql`: new tables only, copied from the prior starter (must be reviewed before deployment).
- `002_verify_readonly.sql`: post-migration checks.
- `003_soundtracks_import_template.csv`: Appwrite track migration data capture.

## IMPORTANT — not executed against Neon or fully CLI validated
No live credentials were used and no database writes performed. Validation of schema against your installed Prisma version, real schema path, and deployed Neon branch remains mandatory. Do not replace the existing migration baseline or run `db push` on production. Do not run the SQL and *also* generate an equivalent Prisma migration: choose one migration workflow and reconcile `_prisma_migrations` correctly.

## Recommended rollout
1. Commit the existing schema and baseline migrations; capture a reliable backup before changes.
2. Verify schema location and `prisma` and `@prisma/client` versions in frontend/backend `package.json`.
3. Create an isolated Neon **schema-only or sanitized** dev branch; do not copy sensitive production user content unnecessarily.
4. Compare `schema.v2.prisma` with the actual Prisma CLI version. Run `prisma format` and `prisma validate` in an isolated working copy; review resulting diffs.
5. Inspect existing auth and authorization; new tables must only be reachable via a secured backend. RLS is currently disabled in supplied audit.
6. Use reviewed Prisma Migrate migration files as the source of truth, or explicitly baseline equivalent applied raw SQL if you choose that approach.
7. Verify new tables, permissions, referential constraints and test flows with anonymized users.
8. Migrate five Appwrite audio files to controlled object storage; import titles/durations/licenses/keys into Neon, verify playback, then retire Appwrite.
9. Production rollout only after staging tests and rollback rehearsal. Existing orphaned legacy activity must be preserved until separately reconciled.

## Known legacy schema risks (not silently modified)
- `messages.user_id` and `chat_sessions.user_id` each reference `users`, but database FK doesn't enforce their equality.
- `master_user_activity.session_id` has no FK, and prior audit found one unmatched record.
- `safety_alerts.emergency_contact_id` has no FK; links and contact consent need review.
- `emergency_contacts.user_id` is unique: one emergency contact per user in the legacy schema.
- Legacy dates use string for local date/week; timestamps use timestamp without time zone.
- The legacy `password_hash` and dual Prisma clients imply auth flows must be audited before identity changes.
- `emotion_analysis` was empty during prior audit; verify its write path before relying on it.
- No vector/PostGIS extensions are required for the V2 first migration. Add only as product use requires.

## Developer validation commands (from your actual repo, adjust prisma --schema path)
```bash
npx prisma validate --schema ./prisma/schema.prisma
npx prisma format --schema ./prisma/schema.prisma
npx prisma migrate status --schema ./prisma/schema.prisma
```
**The example path is illustrative**: your comment says the schema is at repo root, but your generator outputs use `../backend` and `../frontend`, which would resolve outside the root. Verify deployment layout before generating client code.
