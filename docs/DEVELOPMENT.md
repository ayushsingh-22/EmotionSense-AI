# Development and test database

Production is never used for testing. Integration tests may create and clean up synthetic users only on project `fancy-union-28873755`, branch `development` (`br-flat-scene-b3f7jcb4`), endpoint `ep-shiny-fire-b3nfje3k`. The guard checks the configured endpoint and branch pin and the branch, endpoint and project reported by Neon before test writes. It refuses `NODE_ENV=production` and mismatched direct connections. Never use production credentials or URLs for tests.

## Local setup

1. Install Node.js 22 and the dependencies with `npm ci` in both `backend` and `frontend`. Android development uses the project's Gradle wrapper and Android SDK 36.
2. In Neon Console, select the **development** branch and obtain its pooled and direct connection values. Store them only in the git-ignored `backend/.env.test`, with these variable names:

   ```text
   DATABASE_URL=<development pooled connection>
   DIRECT_URL=<development direct connection>
   EXPECTED_NEON_BRANCH_ID=br-flat-scene-b3f7jcb4
   ```

   Do not paste connection values into tickets, logs or source files. Keep your normal application environment separate. The integration runner explicitly loads this file and creates temporary test-only auth secrets; it does not need email provider credentials.
3. Run `npm run test:unit` in `backend`, and `npm test`, `npx tsc --noEmit`, and `npm run build` in `frontend`. Configure the frontend's local origin and backend URL as described in `frontend/.env.local.example`.
4. For real-database integration tests, from `backend` run:

   ```powershell
   node .\scripts\run-dev-integration.mjs
   ```

   This runs the authorization, auth and nightly-lock integration files serially against the guarded development target, with fake email and synthetic accounts. The tests clean up their synthetic users. A failed guard must never be bypassed.

The development branch was created schema-only and its six existing migrations were baselined on 3 November 2026 with `prisma migrate resolve --applied` against its direct connection. `prisma migrate status` reports up to date. A development URL-to-datamodel diff reports only the known 11 `gen_random_uuid()::text` default-expression normalization differences; do not apply that drift output. For any new schema-only clone, verify its schema against each migration before baselining its history; do not repeat resolve on already-baselined migrations.

Apply and verify **new migrations on development first, then production**, using `prisma migrate deploy` only after the appropriate review and approval. Never use production for integration tests. No production migration or production database write is authorized by this guide.

GitHub Actions runs the database-free unit and build checks on pull requests and pushes to `main`; integration tests remain local. Both repositories' workflows use read-only repository permissions.
