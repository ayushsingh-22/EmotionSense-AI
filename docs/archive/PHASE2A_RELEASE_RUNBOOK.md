Historical — refers to the deleted Neon project; not applicable.

# Phase 2A Release Runbook — API Security Hardening

Scope: Vercel (Next.js + NextAuth) and Render (Express) **production**, both on the
**production Neon branch `br-flat-tree-b3brt6b9`** (project `plain-wave-56430909`).
Local development uses **"Unified Neon V2"** (`br-weathered-hall-b3dn9bub`).
Production ALREADY has the V2 wellbeing tables (migration `20261012181122_add_wellbeing_v2`
applied 2026-10-12). Phase 2A uses none of them and contains no schema change.

> Names only below. Never paste secret values into tickets, chat or logs.

## 0. Hard rules

1. **Do not change `DATABASE_URL` on Vercel or Render.** They stay on the production branch.
2. **Do not set any variable from your local `.env` files on production.** Local `.env` /
   `.env.local` point at the dev branch and contain a dev `API_JWT_SECRET`. Generate a new
   production secret (section 2).
3. **Do not run `prisma migrate deploy`, `db push` or any migration against production as part of
   this release.** This release has none; V2 is already applied there. Neither `package.json`
   has a migrate step; keep it that way.
4. **Never roll the backend back to a pre-Phase-2A build** (it is unauthenticated). See section 7.

## 1. Pre-flight (before touching any dashboard)

- [ ] Repo history must match production: commit `prisma/migrations/20261012181122_add_wellbeing_v2/`
      (unchanged — its checksum is recorded in production) and the matching `prisma/schema.prisma`.
      Never edit that migration file. `neon_unified_v2/` is reference material and may stay out.
      No Phase 2A code touches V2 tables (proven by the legacy-schema test run).
- [ ] Confirm auto-deploy behaviour: a push to the connected branch on Render **and** Vercel
      normally deploys immediately. Push to a **release branch** that is not the production
      branch, or disable auto-deploy on Render for the window, so frontend and backend ship in
      the order below.
- [ ] Tag the Phase 2A commit: `phase2a-secured`. This is your only valid "last known good".
- [ ] Record, from the dashboards (no secrets): current Render `CORS_ORIGIN` value, `NODE_ENV`,
      `API_BASE_URL`, health-check path, and the production Vercel domain(s).
- [ ] Run locally: `cd backend && npm test` (all green) and `cd frontend && npm run build` (succeeds).

## 2. Secrets to generate (once)

Generate **one new** production signing secret (48+ random bytes, base64url) and keep it in
your password manager:

    node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"

Rules: identical value on Vercel and Render; **must differ from `NEXTAUTH_SECRET`**; at least
32 characters. There is no fallback — the backend refuses to start without it.

## 3. Environment variables

### Vercel (Project → Settings → Environment Variables → Production)

| Name | Action | Notes |
|---|---|---|
| `API_JWT_SECRET` | **ADD** | New value from section 2. Server-side only; **do not** prefix with `NEXT_PUBLIC_`. |
| `AUTH_RL_LOGIN_IP_PER_15MIN`, `AUTH_RL_LOGIN_ACCOUNT_PER_15MIN`, `AUTH_RL_REGISTER_IP_PER_HOUR`, `AUTH_RL_REGISTER_EMAIL_PER_HOUR` | optional | Per-instance auth throttles. Defaults 30 / 8 / 5 / 3. |
| `NEXTAUTH_SECRET` | keep unchanged | Rotating it logs everyone out; not needed. |
| `NEXTAUTH_URL` | keep | Production domain, `https://…`. |
| `DATABASE_URL` | **keep unchanged (production branch)** | |
| `NEXT_PUBLIC_API_URL` | keep | The Render service URL. |

Leave Preview/Development scopes without `API_JWT_SECRET` unless you intend previews to call
production (they should not).

### Render (Service → Environment)

| Name | Action | Notes |
|---|---|---|
| `API_JWT_SECRET` | **ADD** | Same value as Vercel. |
| `CORS_ORIGIN` | **SET / VERIFY (critical)** | Exact production Vercel origin(s), comma-separated, e.g. `https://<prod-domain>`. `*` is ignored now; if this is empty in production **all browser calls fail**. Optional pattern for previews: `https://<project>-*-<team>.vercel.app` (`*` = one DNS label). |
| `NODE_ENV` | **SET `production`** | Otherwise error responses include stack traces and HSTS is off. |
| `TRUST_PROXY_HOPS` | SET `1` | Render = one proxy hop; needed for correct per-IP rate limits. |
| `CRON_SECRET` | keep | Still used by `/api/cron/ping`; now also by diagnostics routes. |
| `API_BASE_URL` | verify | Public Render URL; used to build `/audio/...` links. If unset, audio links point at localhost. |
| `DATABASE_URL` | **keep unchanged (production branch)** | |
| `NEXTAUTH_SECRET` | optional: **remove** after release | Backend no longer reads it. Removing is safe and reduces blast radius. |
| `RATE_LIMIT_AI_PER_MIN` / `RATE_LIMIT_AI_PER_DAY` | optional | Defaults 20 / 500 per user. |
| `RATE_LIMIT_GLOBAL_PER_15MIN`, `RATE_LIMIT_AUTH_FAILURES_PER_15MIN`, `RATE_LIMIT_SENSITIVE_PER_HOUR` | optional | Defaults 1000 / 60 / 20. |
| `EXPECTED_NEON_BRANCH_ID` | **do not set** | Local test pin only. |
| `EXPOSE_ERROR_DETAILS` | **do not set** | Only ever `true` in local development. |
| `NODE_VERSION` | recommended | Pin Node 22.x for reproducible builds (see 9a). |

All existing AI/TTS/email variables stay as they are.

## 4. Deployment order (frontend first, backend second)

Why this order: the new frontend sends a bearer token that the old backend simply ignores, so
nothing breaks in between. The reverse order would lock every existing user out of chat until
the frontend shipped. The frontend degrades safely if token minting fails (it sends the
request without a token, so a broken secret shows as a clear 401, not a frozen UI).

**Step A — Vercel (frontend)**
1. Add `API_JWT_SECRET` (section 3).
2. Deploy the release branch to **Preview** first; sign in on the preview and confirm
   `GET /api/backend-token` returns 200 while signed in. (Preview calls the old production
   backend; chat should still work because the old backend ignores the token.)
3. Promote / deploy to **Production**.
4. Production check: sign in, open chat, send a message — still works (old backend still live).
   `GET https://<prod-domain>/api/backend-token` while signed out → 401.

**Step B — Render (backend)**
1. Set/verify `CORS_ORIGIN`, `NODE_ENV`, `TRUST_PROXY_HOPS`, `API_JWT_SECRET` **before** deploying.
2. Deploy the release branch. Watch the log for `🚀 Server Running` and
   `CORS Mode → allow-list`. A boot failure mentioning `API_JWT_SECRET` means a missing,
   short, or equal-to-`NEXTAUTH_SECRET` value.
3. **Important:** if the new deploy fails its health check, Render keeps serving the *previous*
   (unauthenticated) build. A green dashboard is not proof. Run:

        cd backend
        node scripts/verify-deployment.mjs \
          --backend  https://<render-service>.onrender.com \
          --frontend https://<prod-domain> \
          --origin   https://<prod-domain>

   Every line must say `PASS`, especially `authenticated build is live (health.release = phase2a-auth-1)`.
   The script is read-only and safe to run even against the old build.
4. Browser smoke test (signed in, production): load chat history, send a text message, send a
   voice message, open Insights, open Journal, save and read the emergency contact.
5. Confirm `/api/cron/ping` still succeeds with your cron service (`Authorization: Bearer <CRON_SECRET>`).
6. Watch Render logs for 15–30 minutes: look for `Auth rejected`, 403 `USER_MISMATCH`, and 429s.
   A burst of `Auth rejected (ERR_JWT_EXPIRED)` right after deploy is normal for old open tabs.

## 5. Go / no-go checklist

- [ ] `node scripts/verify-deployment.mjs …` all PASS
- [ ] Production login works (existing test account), logout works
- [ ] Chat text + stream + voice work; session list shows only own sessions
- [ ] Emergency contact save/read works
- [ ] No unexpected 401/403/429 for a normally behaving user in the logs
- [ ] Production migration history unchanged: still exactly `init` and `add_wellbeing_v2`, no new rows

## 6. Expected one-time user impact

- Browser tabs opened before the deploy hold the old JS and send no token; one page reload fixes it.
- The Android app is not affected (it does not call this API yet; Phase 2B adds Firebase token exchange).
- Diagnostic routes (`/api/health/detailed`, `/api/health/email`, `/api/emergency/email/status`,
  `/api/journal/test-generation`) now require `Authorization: Bearer <CRON_SECRET>`.

## 7. Recovery strategy that never re-exposes the unauthenticated backend

The old backend is unsafe: **do not redeploy any commit before `phase2a-secured` on Render.**
Use this ladder instead (cheapest first):

| Symptom | Fix | Redeploy needed? |
|---|---|---|
| Every browser call blocked / CORS errors | Correct `CORS_ORIGIN` on Render (exact origin, https, no trailing slash) | No (env change restarts service) |
| Everyone gets 401 | Verify `API_JWT_SECRET` is **byte-identical** on Vercel and Render, ≥32 chars, ≠ `NEXTAUTH_SECRET`; redeploy Vercel after changing it | Vercel yes |
| Legit users hit 429 | Raise `RATE_LIMIT_AI_PER_MIN` / `RATE_LIMIT_AI_PER_DAY` / `RATE_LIMIT_GLOBAL_PER_15MIN` | No |
| Audio links wrong host | Set `API_BASE_URL` | No |
| A bug in the new code | Fix forward on the release branch → redeploy; or redeploy `phase2a-secured` | Yes |
| Need to stop traffic immediately | **Suspend the Render service** (503) rather than reverting. An outage is safer than open endpoints | — |
| Suspected token-secret leak | Generate a new `API_JWT_SECRET`; set on Render, then Vercel; redeploy Vercel. Old tokens expire in ≤ 5 minutes | Vercel yes |

Frontend rollback is allowed *only* together with a secured backend: an old frontend (no token)
against the new backend simply gets 401s. Never "fix" that by reverting the backend.

If Render's dashboard offers one-click rollback, treat any pre-`phase2a-secured` deploy in its
history as **forbidden** (consider deleting or disabling those deploy entries/auto-rollback).

## 8. After release

- Remove `NEXTAUTH_SECRET` from Render (unused there).
- Rotate any credentials that were accessible via the previously open API (emergency contact
  data was readable by anyone): review whether notification emails/phones need user notice.
- Phase 2B (Firebase exchange, auth tables) is a separate release and needs its own approval.

## 9. Public auth abuse protection, error disclosure, and remaining gaps

**Implemented (local, tested):**
- Login (`NextAuth` credentials) and `/api/auth/register` are throttled per IP and per account/email
  (`frontend/lib/rateLimit.ts`). Throttling is keyed by what the caller typed, so it reveals nothing about
  whether an account exists. A throttled login surfaces as `TooManyAttempts` ("try again in a few minutes").
- Login: identical outcome and comparable timing for unknown user vs wrong password (dummy bcrypt compare),
  bounded input, case-insensitive email matching for legacy mixed-case accounts. Existing hashes and passwords are untouched.
- Registration: neutral failure text (no "already exists"), email normalised to lower-case, hashing done before
  the existence check, 8 KB body cap, name/email validated. **New** passwords: >= 10 characters, <= 72 bytes
  (bcrypt truncation), common-password and repetition block-list, must not contain email name / full name.
  Existing users are never re-validated.
- Express API: no internal error text ever reaches clients (35 sites + errorHandler + STT/TTS provider errors);
  every error carries a server-generated `requestId` (also the `X-Request-Id` header). Logs keep the full
  diagnostics but pass through value-based and pattern-based secret redaction (`utils/logRedaction.js`).
  Stack traces need `NODE_ENV=development` AND `EXPOSE_ERROR_DETAILS=true`.

**HONEST LIMITS — what is NOT solved:**
1. **The rate limiter is per serverless instance** (in-memory). It slows naive brute force but is not a
   global guarantee on Vercel. For real enforcement enable **Vercel Firewall rate limiting** on
   `POST /api/auth/register` and `POST /api/auth/callback/credentials` (suggested: 10 requests / minute / IP,
   deny or challenge) **before** relying on this release, or approve one of the shared-store options below.
   `setRateLimitStore()` lets a shared store be plugged in without changing any route.
2. **Account enumeration via registration is reduced, not eliminated.** Without email verification, "this address
   is taken" cannot be hidden from someone who can complete the form. Mitigations: neutral text, equal timing,
   strict per-IP/per-email throttles. Full fix = email verification (Phase 2B).
3. No CAPTCHA/bot challenge, no MFA, no account lockout notification, no password-reset flow yet.
4. No token revocation (5-minute API tokens; NextAuth sessions last 30 days); `/audio` files are
   unguessable-URL public; both services use the Neon owner role and RLS is off.
5. `nodemailer` ^6.9 has published HIGH-severity advisories (address-parser / SMTP-injection class). The
   emergency-alert feature sends mail to user-supplied addresses, so upgrade to a patched major (and re-test
   alerts) soon. `uuid` (via node-cron) has a moderate advisory.

**Shared-store options for distributed rate limiting (needs your decision):**
| Option | New service / credential | Notes |
|---|---|---|
| A. Vercel Firewall rate-limit rules | None (dashboard config) | Zero code, enforced at the edge, recommended immediately |
| B. Neon table (`auth_rate_limits`) | None | Needs a Phase 2B migration (production + dev) and one extra DB round-trip per attempt |
| C. Upstash Redis / Vercel Marketplace KV | Yes (free tier exists) | Fastest and simplest shared store; adds a credential and a vendor |

## 9a. Backend dependency installation (reproducibility)

`backend/package-lock.json` is **git-ignored** (`backend/.gitignore` line 3), so Render resolves fresh
versions on every build (`npm install` in the `build` script). Recommended fix: stop ignoring the lockfile
and commit it (a complete, consistent lockfileVersion-3 file already exists locally), change the Render
build command to `npm ci && npx prisma generate --schema=../prisma/schema.prisma` (the
`postinstall` hook already runs `prisma generate`), and pin Node with the `NODE_VERSION` env var (22.x).
Do not switch to `npm ci` until the lockfile is committed or the build will fail.

## 10. Auto-deploy behaviour (must be confirmed in the dashboards)

The repo has no `vercel.json`, `render.yaml` or CI workflow, so deploy triggers live only in the
Vercel and Render dashboards. The git remote is `origin` (GitHub). The common default is
"deploy on every push to the production branch" for both services — assume that is true until
you have looked. Therefore: **never push this work to `main`**. Push a release branch
(e.g. `release/phase2a-security`); deploy frontend first from that branch/preview, then backend.
Before the Render step, pause Render auto-deploy (or point it at the release branch) so the
backend cannot ship before the frontend.
