# Phase 2B.5B.2 — Secure MantraAI ↔ MindHaven account linking (backend)

Backend only (`backend/`). No schema change, no migration: it uses `auth_link_challenges` (migration
`20261016120000_add_auth_link_challenges`) and `auth_identities.link_method = 'password_proof'` (already allowed).
Web (NextAuth) and Android are unchanged. **Disabled by default.**

> Names only below. Never put credentials, tokens, challenges or real e-mails in tickets, chat, logs or git.

## What was added

| Piece | File |
|---|---|
| Routes (`/start`, `/complete`), limits, error mapping | `backend/src/routes/accountLinkRoutes.js` |
| Protocol logic (claim checks, start, complete, reconciliation) | `backend/src/identity/linkService.js` |
| SQL (database clock, conditional single-use consume, locks) | `backend/src/identity/linkStore.js` |
| Server-side bcrypt proof + credential fingerprint | `backend/src/identity/passwordProof.js` |
| Link schema readiness gate | `createLinkSchemaReadiness` in `backend/src/identity/schemaReadiness.js` |
| `auth_time` exposed by the verifier (`claims.authTime`) | `backend/src/identity/firebaseVerifier.js` |
| `isLimited()` on the keyed limiter | `backend/src/identity/keyedLimiter.js` |
| Wiring | `backend/src/server.js` |

## Environment variables (NAMES ONLY)

| Name | Default | Purpose |
|---|---|---|
| `ACCOUNT_LINKING_ENABLED` | off | Must be exactly `true`. **And** `FIREBASE_EXCHANGE_ENABLED` must be exactly `true`. Otherwise both routes are a plain 404. |
| `ACCOUNT_LINK_MAX_AUTH_AGE_SECONDS` | 600 | Max age of the Firebase sign-in (`auth_time`) at both steps. Clamped to 60–3600. |
| `RATE_LIMIT_LINK_PER_15MIN` | 30 | Per IP, all link requests (start + complete share it). |
| `RATE_LIMIT_LINK_FAILURES_PER_15MIN` | 15 | Per IP, failed (400/401/403) link requests. |
| `RATE_LIMIT_LINK_PER_UID_PER_15MIN` | 15 | Per verified Firebase identity. |
| `RATE_LIMIT_LINK_PASSWORD_FAILURES_PER_15MIN` | 5 | Per target account (keyed by the caller's verified e-mail), wrong-password attempts. |

Firebase Admin and `API_JWT_SECRET` are the existing Phase 2B.3 / 2A variables. Production keeps the flag unset.

## Why these paths

The routes are public in the Phase 2A sense: after `409 ACCOUNT_LINK_REQUIRED` the app has **no API token**. They are
mounted at `/api/auth/firebase/link`, next to the public exchange, and **not** under `/api/identity`, so the authenticated
namespace keeps its blanket `requireAuth` chain (`/api/identity/link/*` answers 401). The router is terminal: only
`POST /start` and `POST /complete` exist; anything else under it is 404/405 and never reaches another router.

## Contracts

All requests: `Content-Type: application/json`, body ≤ 8 KB, **strict** schema (any unknown field such as `userId`,
`uid`, `projectId`, `email`, `emailVerified` → 400). All responses carry `Cache-Control: no-store`. Errors are
`{ "success": false, "error": "<user-facing text>", "code": "<CODE>", "requestId": "..." }`.

### `POST /api/auth/firebase/link/start`

```json
{ "idToken": "<fresh Firebase ID token>", "password": "<current MantraAI web password>", "consent": true }
```

201 Created:
```json
{ "success": true, "challenge": "<43-char base64url>", "expiresAt": 1760000300000, "expiresIn": 300 }
```
No API token, no user id, no account details. The target account is the MantraAI account whose e-mail equals the
**verified** Firebase e-mail (case-insensitive); the client cannot choose another one.

### `POST /api/auth/firebase/link/complete`

```json
{ "idToken": "<fresh Firebase ID token, SAME Firebase user>", "challenge": "<from start>", "consent": true }
```

200 OK (the normal Phase 2A token, identical to the exchange):
```json
{ "success": true, "token": "<API JWT>", "tokenType": "Bearer", "expiresAt": 1760000600000, "expiresIn": 300,
  "linked": true, "user": { "id": "<ORIGINAL users.id>", "email": "...", "fullName": "...", "avatarUrl": null } }
```
JWT: HS256, `iss=mantra-web`, `aud=mantra-api`, `sub=users.id` (never the Firebase UID), 5 minutes.

### Error codes

| HTTP | code | Step | Meaning → Android action |
|---|---|---|---|
| 400 | `CONSENT_REQUIRED` | both | `consent` was not the boolean `true`. Programming error: always send it after the user confirmed. |
| 400 | `VALIDATION_FAILED` | both | Bad/unknown fields or sizes. Programming error. |
| 400 | `LINK_CHALLENGE_INVALID` | complete | Expired, already used, unknown, tampered, other identity, or the web password/e-mail changed since start. **First call the exchange** (a lost response may already have linked); if it still says 409, restart from `start`. |
| 401 | `INVALID_FIREBASE_TOKEN` | both | Bad/expired/revoked token, wrong project, disabled/deleted Firebase user. `getIdToken(true)` once and retry; else sign out. |
| 401 | `REAUTHENTICATION_REQUIRED` | both | Firebase sign-in is older than 10 minutes. Re-authenticate the Firebase user (Google again, or e-mail/password `reauthenticate`), then restart. |
| 401 | `LINK_PROOF_FAILED` | start | Wrong password. Same answer if the account has no password or does not exist. Let the user retry (limited). |
| 403 | `EMAIL_NOT_VERIFIED` | both | Verify the Firebase e-mail first. |
| 403 | `UNSUPPORTED_SIGN_IN_METHOD` | both | Only `google.com` and `password` are accepted. |
| 403 | `IDENTITY_DISABLED` | both | This mapping was disabled. Stop. |
| 404 | (generic) | both | Linking not enabled in this environment. Show "not available yet". |
| 405 / 413 / 415 | | both | Wrong method / body too large / wrong content type. Programming error. |
| 409 | `IDENTITY_ALREADY_LINKED` | both | This Firebase user is already mapped. Call the exchange and continue normally. |
| 429 | `RATE_LIMITED` | both | Back off (`Retry-After` when present). After 5 wrong passwords the account is locked for linking for up to 15 min. |
| 503 | `IDENTITY_UNAVAILABLE` | both | Firebase/DB unavailable, not configured, or schema missing. Retry later; keep the user signed in to Firebase. |
| 500 | (generic) | both | Unexpected. If it happened on `complete`, call the exchange before retrying (the link may have committed). |

## Android flow (Phase 2B.5B.3)

1. Exchange returns `409 ACCOUNT_LINK_REQUIRED` → show a linking screen: "An account with this e-mail already exists on
   MantraAI. Enter its password to connect it to this MindHaven sign-in." Include an explicit confirmation control;
   **send `consent: true` only after the user confirms.** Offer Cancel (sign out of Firebase, nothing is changed).
2. Get a token: `getIdToken(false)`. If the Firebase sign-in is older than ~9 minutes (or `start` answers
   `REAUTHENTICATION_REQUIRED`), re-authenticate the Firebase user first.
3. `POST …/link/start` with `idToken`, `password`, `consent`. Clear the password from memory immediately afterwards;
   never log it or persist it.
4. Keep the `challenge` **in memory only** (never disk, logs or analytics). It is useless without a fresh Firebase token for
   the same user, and dies after 5 minutes or one use.
5. Get a fresh token again (`getIdToken(false)`; force refresh if near expiry) and `POST …/link/complete` with
   `idToken`, `challenge`, `consent`.
6. On 200, use `token` exactly like an exchange token (in memory, refresh via the **exchange**, which now returns the same
   `users.id`). Drop the challenge. Continue to the app as the unified account.
7. Cancellation / retry: dropping the challenge cancels (it expires unused; a new `start` replaces it). On network
   failure or 5xx during `complete`, **do not blindly resend**: call the exchange; 200 → linked; 409 → restart from step 2.
8. Never send `userId`, Firebase UID, project or e-mail-verified flags. The server derives everything from the token.

## Security model

* **Two proofs, never e-mail alone.** Firebase: Admin SDK verification with pinned project and revocation check, verified
  e-mail, supported method, `auth_time` ≤ 10 minutes at **both** steps. Web: current password via bcrypt server-side, with
  constant work (dummy hash) and one answer for no account / no password / wrong password.
* **Binding.** The stored row binds the SHA-256 digest of a 32-byte CSPRNG challenge to the target `users.id`
  (server-derived), `(firebase, project, uid)`, purpose `link_firebase` and a SHA-256 fingerprint of the password hash.
  Completion requires the same identity, a live and unconsumed row, an unchanged password hash and an unchanged e-mail.
* **Lifetime.** 300 s, computed by the database clock; the table CHECK makes > 5 minutes impossible.
* **Single use and concurrency.** One `UPDATE … SET consumed_at = now() WHERE … consumed_at IS NULL AND expires_at > now()
  RETURNING` inside the link transaction. Concurrent completions serialise on the row lock; the loser matches 0 rows. The
  target user is read `FOR SHARE` (blocks a concurrent password/e-mail change). The identity insert is protected by the
  unique index; a lost race is mapped to `IDENTITY_ALREADY_LINKED`, never resolved by reassigning. Any refusal rolls back
  the consume. No network call happens inside the transaction.
* **Ambiguous outcomes.** If the transaction fails in a way that might have committed, the service performs a read-only
  lookup of the mapping; if it belongs to the intended user the request succeeds (`reconciled`), otherwise the error
  propagates. Nothing is retried blindly.
* **Enumeration.** The target is derived from an e-mail the caller has just proven to own; proof failures are uniform.
* **Logging.** Reason codes and request ids only. Passwords, ID tokens, challenges, e-mails, Firebase UIDs and users.id
  are never logged.
* **What linking never does.** Create users, modify `users` rows (password, e-mail, verification), move or merge data, or
  change the exchange's behaviour for unlinked identities (still 409).

## Remaining limitations

* Rate limits are in memory per process (like the existing ones); several instances multiply the budgets.
* A MantraAI account without a password (Firebase-created) cannot be a link target (no second proof exists).
* Row-lock serialisation was verified with a model and against single-connection PostgreSQL (PGlite); true multi-session
  blocking on Neon has not been exercised (it is standard PostgreSQL READ COMMITTED behaviour).
* The API token is minted after commit; if minting fails the link is still committed. The client recovers through the
  exchange (documented above).
* Old consumed challenge rows are kept (audit). Unconsumed ones of an identity are replaced on each `start`. A periodic
  cleanup of expired rows is a later, separate task.
