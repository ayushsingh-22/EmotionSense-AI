# Operations

Runbook for keeping production email (registration codes, password resets, emergency alerts) working.

## Email health check

`GET /api/internal/email-health` checks whether the backend can currently send email. **It sends no email.**

- **What it does:** for Gmail, one OAuth refresh-token exchange with Google. It always performs a fresh exchange: a cached access token can keep working for up to an hour after the refresh token has been revoked. For Resend (a static API key), it is a configuration check only.
- **Auth:** `Authorization: Bearer <CRON_SECRET>`, compared in constant time. If `CRON_SECRET` is not set, the endpoint returns 404.
- **Rate limit:** 10 requests per 15 minutes per IP, counting wrong-secret attempts.
- **Responses:** these never contain tokens, addresses or provider messages, and are `Cache-Control: no-store`.

| Status | Body | Meaning |
|---|---|---|
| 200 | `{"ok":true}` | Email provider credentials work |
| 503 | `{"ok":false,"code":"EMAIL_AUTH_INVALID"}` | Gmail refresh token revoked or expired: rotate it (below) |
| 503 | `{"ok":false,"code":"EMAIL_AUTH_UNAVAILABLE"}` | Google's token service failed or returned an error; retry later |
| 503 | `{"ok":false,"code":"EMAIL_NOT_CONFIGURED"}` | `EMAIL_PROVIDER` / `GMAIL_*` (or `RESEND_*`) settings are missing |
| 503 | `{"ok":false,"code":"EMAIL_TIMEOUT"}` / `"EMAIL_NETWORK_ERROR"` | Google not reachable from the server |
| 401 / 404 / 429 | — | Wrong or missing secret / `CRON_SECRET` unset / rate limited |

Manual check (PowerShell or bash, with the secret in an environment variable, never typed into a shared terminal history):

```bash
curl -sS -H "Authorization: Bearer $CRON_SECRET" https://<backend-host>/api/internal/email-health
```

Every check also writes one log line: `{"event":"email provider check","ok":…,"code":…,"provider":"google","trigger":"endpoint"}`. The backend runs the same check once at **startup** (in the background, without delaying boot) and logs it with `"trigger":"startup"`. After any deploy or restart, search the Render logs for `email provider check`.

Related log events (all PII-free): `auth email sent`, `auth email delivery failed` (with `code`), `emergency alert delivery failed` (with `code`), `gmail refresh token invalid`.

## Daily check with cron-job.org

cron-job.org is a free external scheduler. Menu labels below may differ slightly from the current website.

1. Sign up at <https://cron-job.org> with the email address that should receive failure alerts, and confirm it.
2. **Create cronjob:**
   - **Title:** `MindHaven email health`
   - **URL:** `https://<backend-host>/api/internal/email-health`
   - **Schedule:** once a day, for example 08:00 in your timezone.
3. **Advanced** tab:
   - **Request method:** `GET`.
   - **Headers:** add `Authorization` with value `Bearer <CRON_SECRET>`. Put the secret in a header, never in the URL: URLs end up in logs.
   - **Timeout:** use the maximum the site allows (about 30 seconds at the time of writing).
4. **Notifications:**
   - Enable **notify on failure**, and set it to alert after **2 consecutive failures**. A sleeping Render free instance can take longer to wake than cron-job.org waits, so a single failure may be a cold start rather than a real problem.
   - Enable **notify when the job succeeds again after a failure**, so you know when it recovered.
   - Notifications go to the account email address.
5. Run the job once with **Test run**, or wait for the first scheduled run. The result should be HTTP 200 with `{"ok":true}`. Any non-2xx status counts as a failure.
6. When you rotate `CRON_SECRET`, update the header in cron-job.org at the same time.

When a failure notification arrives, check the response body's `code` and the table above. For `EMAIL_AUTH_INVALID`, rotate the Gmail token.

## Rotate the Gmail refresh token

Do this when the check reports `EMAIL_AUTH_INVALID`, or proactively if any item in the list below has happened.

1. **Stop weekly expiry first.** In the Google Cloud Console, go to **APIs & Services → OAuth consent screen** for the sending project and check **Publishing status**. If it says *Testing*, choose **Publish app**. Refresh tokens issued in Testing mode expire after 7 days. Google may then show an "unverified app" warning when you sign in; that is acceptable for this single sending account.
2. **Issue a new token.** From `backend/`, in a normal interactive terminal (not CI):
   ```bash
   node scripts/gmail-oauth-setup.mjs
   ```
   Enter the Desktop OAuth client ID and secret, sign in in the browser **as the sending account** (the address in `GMAIL_SENDER`), and grant only the `gmail.send` permission. The script prints the new refresh token and writes no files.
3. **Install it.** On Render, set `GMAIL_REFRESH_TOKEN` to the new value and save; the service restarts. Update your local `backend/.env` too if you use Gmail locally. Do not paste the token into chat, tickets or commits.
4. **Verify.** In the Render logs, look for `email provider check` with `"ok":true` (`"trigger":"startup"`). Then call the health endpoint (or run the cron job's test run) and expect `{"ok":true}`. Finally, register a test address and look for `auth email sent`.
5. **Optional clean-up.** Under Google Account → Security → *Third-party apps with account access*, remove stale grants for this app from previous tokens, but **not** the one you just created. Removing access revokes every token for the app, including the new one; if you are unsure, skip this step.

## What revokes or expires a Gmail refresh token

Any of these makes sending fail with `EMAIL_AUTH_INVALID` until a new token is issued:

1. **Testing publishing status:** the OAuth consent screen is in *Testing* with user type *External*. Tokens expire after **7 days**. (This caused the November 2026 outage.)
2. **Access removed:** someone removed the app under Google Account → Security → *Third-party apps with account access*.
3. **Password change** on the sending account (tokens with Gmail scopes are revoked).
4. **Unused for 6 months:** the token was not used for six months. The daily health check prevents this.
5. **Token limit:** more than **100** refresh tokens were issued to this OAuth client for the same account. The oldest is silently invalidated, so avoid running the setup script repeatedly.
6. **Client changed:** the OAuth client was deleted, its client secret was rotated or deleted, or the Google Cloud project was deleted or suspended.
7. **API disabled:** the Gmail API was disabled for the project.
8. **Workspace policy** (if the sender is a Google Workspace account): an admin session-length limit, an app-access restriction, or the admin removing the app's access.
9. **Account problems:** the sending account was suspended, deleted, or locked for suspicious activity and then recovered.
10. **Security event:** Google revoked tokens after detecting suspicious activity on the account.

Because several of these happen without warning, the daily health check plus the startup log line are the early-warning system. Rotation itself takes about five minutes.
