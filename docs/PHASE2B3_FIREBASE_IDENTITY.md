# Phase 2B.3 — Firebase verification and unified identity API

Backend only (`backend/`). Web (NextAuth) is unchanged. Android is wired in Phase 2B.4.

> Names only below. Never put credential values in tickets, chat, logs or git.

## What was added

| Piece | File |
|---|---|
| Firebase Admin verification (pinned project, revocation check) | `backend/src/identity/firebaseVerifier.js` |
| Identity resolution against `auth_identities` | `backend/src/identity/identityService.js` |
| Schema readiness gate | `backend/src/identity/schemaReadiness.js` |
| Per-UID limiter | `backend/src/identity/keyedLimiter.js` |
| Routes | `backend/src/routes/identityRoutes.js` |
| Token minter (same contract as web) | `mintApiToken` in `backend/src/middleware/auth.js` |
| Wiring | `backend/src/server.js` |

## Environment variables (NAMES ONLY)

Backend (Render):

| Name | Required | Purpose |
|---|---|---|
| `FIREBASE_EXCHANGE_ENABLED` | to enable | Must be exactly `true`. Anything else: the route returns 404. **Default off.** |
| `FIREBASE_PROJECT_ID` | when enabled | The pinned Firebase project. Tokens for any other project are refused. |
| `FIREBASE_SERVICE_ACCOUNT_JSON_BASE64` | one of | Base64 of the Admin service-account JSON. Preferred. |
| `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY` | one of | Alternative to the line above (`\n` escapes accepted in the key). |
| `API_JWT_SECRET` | existing | Already used by Phase 2A; the exchange signs with it. |
| `RATE_LIMIT_EXCHANGE_PER_15MIN` | optional | Per-IP ceiling, default 60. |
| `RATE_LIMIT_EXCHANGE_FAILURES_PER_15MIN` | optional | Per-IP failed attempts (400/401/403), default 20. |
| `RATE_LIMIT_EXCHANGE_PER_UID_PER_15MIN` | optional | Per verified Firebase UID, default 30. |

Use separate Firebase projects (and therefore separate `FIREBASE_PROJECT_ID` + credentials) for development and production.
All the `FIREBASE_*` credential values are redacted from server logs by value.
If `FIREBASE_EXCHANGE_ENABLED=true` and Firebase is misconfigured, the **server refuses to boot**.

## Contracts

### `POST /api/auth/firebase/exchange` (public; no API token)

Request: `Content-Type: application/json`, max 8 KB, body `{ "idToken": "<Firebase ID token>" }`.
Nothing else in the body is read. Client-sent uid/userId/email are ignored.

200 OK:
```json
{ "success": true, "token": "<API JWT>", "tokenType": "Bearer", "expiresAt": 1760000000000, "expiresIn": 300,
  "provisioned": false, "user": { "id": "<users.id>", "email": "...", "fullName": "...", "avatarUrl": null } }
```
The JWT is the standard Phase 2A token: HS256, `iss=mantra-web`, `aud=mantra-api`, `sub=users.id` (never the Firebase UID),
claims `email`, `iat`, `exp` (+300 s).

Errors (all `{ "success": false, "error": "...", "code": "...", "requestId": "..." }`):

| HTTP | code | Meaning / client action |
|---|---|---|
| 400 | `VALIDATION_FAILED` | missing/invalid `idToken` |
| 401 | `INVALID_FIREBASE_TOKEN` | bad, expired, revoked, disabled/deleted user, wrong project. One uniform answer. Refresh the Firebase token once (`getIdToken(true)`), else sign the user out. |
| 403 | `EMAIL_NOT_VERIFIED` | send/ask for e-mail verification, then retry |
| 403 | `UNSUPPORTED_SIGN_IN_METHOD` | only `google.com` and `password` are accepted |
| 403 | `IDENTITY_DISABLED` | this mapping was disabled |
| 404 | (generic) | exchange not enabled in this environment |
| 409 | `ACCOUNT_LINK_REQUIRED` | an account with this verified e-mail exists and is not linked. **Nothing was linked or changed.** Linking is a later phase. |
| 415 / 413 | | wrong content type / body too large |
| 429 | `RATE_LIMITED` | back off (`Retry-After` when present) |
| 503 | `IDENTITY_UNAVAILABLE` | Firebase unreachable, not configured, or the database lacks the identity migration. Retry later; do not sign the user out. |

### `GET /api/identity/me` (Bearer API token)

Identity comes only from the token subject; a different `userId`/`user_id` in the query/body is rejected (403).
```json
{ "success": true, "user": { "id": "...", "email": "...", "fullName": null, "avatarUrl": null, "createdAt": "...",
  "emailVerified": true, "hasPassword": false,
  "identities": [ { "provider": "firebase", "signInMethod": "google.com", "emailVerified": true,
                    "linkMethod": "created", "linkedAt": "...", "lastLoginAt": "...", "disabled": false } ] } }
```
Never returned: password hashes, provider subjects (Firebase UID), provider project, tokens, other users' data.

## Identity resolution flow

1. Firebase Admin verifies the ID token (signature, expiry, issuer, audience, subject) with `checkRevoked=true`;
   the backend additionally pins `aud`/`iss` to `FIREBASE_PROJECT_ID`.
2. Find `auth_identities` by (`firebase`, project, uid):
   - found and enabled -> canonical `users.id` (last login touched at most once a minute);
   - found and disabled -> 403.
3. Not found: the e-mail must be present and `email_verified === true`, and the sign-in method allowed.
4. One transaction: if any user has that e-mail (case-insensitive) -> **409, no write**. Otherwise create the user
   (`password_hash` NULL, `email_verified_at` set) and the identity (`link_method = 'created'`).
5. Concurrent first logins: the database uniqueness (identity triple, `lower(email)`) decides the winner; losers re-read
   and return the winner's mapping or 409. No duplicate users.
6. Historic web users are never modified; no data is merged or moved.

Revocation / deletion policy: revoked, disabled or deleted Firebase users are refused at the exchange. Already minted API tokens
live at most 5 minutes (not individually revocable). Deleting a Firebase account does not delete the Neon user (a later
account-deletion endpoint must do both). If the Neon user is deleted, identities cascade; signing in again with the same Firebase
account creates a NEW empty user. If the Firebase account was recreated (new UID, same e-mail) the result is 409 (linking required).

## Production deployment order and compatibility

1. **Do not enable anything first.** The new code is inert: without `FIREBASE_EXCHANGE_ENABLED=true` the route is a 404, and
   `/api/identity/me` only serves callers that already hold an API token.
2. Apply the identity migration to production with the guarded procedure used on development (new recovery branch first,
   `.gitattributes` committed first, verify checksum `99c5fdb6…`). Old backend and web code keep working against the migrated schema
   (new column ignored; `password_hash` nullable; extra table unused).
3. `prisma generate` happens in the normal build (`postinstall`); deploy the backend with the flag still off.
4. Set the Firebase variables (production Firebase project only), then `FIREBASE_EXCHANGE_ENABLED=true`, redeploy.
   Even if the flag is set before step 2 the endpoint answers **503** (schema readiness probe), never partial behaviour.
5. Smoke test with a synthetic Firebase account; confirm `GET /api/identity/me`.
6. Roll back by unsetting `FIREBASE_EXCHANGE_ENABLED` (route disappears); the database does not need to change.
Do **not** roll the backend back to a pre-2B.3 build after users were provisioned unless you accept `/api/identity/me` disappearing.

## Remaining risks

* Pre-registration takeover: the web has no e-mail verification. The exchange never links by e-mail (409), so a pre-registered web
  account cannot be taken over, but the real owner must go through the (future) linking flow to use Android with that e-mail.
* A Firebase e-mail/password account must verify its e-mail before it can sign in to the backend (by design).
* Rate limits are per server instance (in memory), like the existing ones.
* API tokens cannot be revoked within their 5-minute life.
* `FIREBASE_EXCHANGE_ENABLED` and the credentials are the only protection against enabling the wrong Firebase project: keep
  development and production projects separate.

## Phase 2B.4 — Android integration (separate repository `C:\Users\abhin\Desktop\MindHavenApp`)

1. Add OkHttp/Retrofit + a JSON library and a `BuildConfig` base URL (HTTPS only; set `usesCleartextTraffic=false`).
2. After any Firebase sign-in (Google or e-mail/password; require `isEmailVerified` first for e-mail/password):
   `val idToken = firebaseUser.getIdToken(false).await().token`.
3. `POST {BASE}/api/auth/firebase/exchange` with `{"idToken": idToken}`. Keep the returned API token **in memory only**
   (never SharedPreferences/logs); refresh when `expiresAt - now < 30s` by repeating step 2–3.
4. Call every other endpoint with `Authorization: Bearer <API token>`; never send a `userId`.
5. Error handling: 401 -> `getIdToken(true)` once, then sign out; 403 EMAIL_NOT_VERIFIED -> prompt to verify; 409 ACCOUNT_LINK_REQUIRED ->
   show "this email already has an account" (linking comes later); 503/network -> retry with backoff, keep the user signed in.
6. Logout: `FirebaseAuth.signOut()` and drop the in-memory token. Restore the missing `AuthViewModel`/repository first.
7. Test against the development backend + the development Firebase project only.
