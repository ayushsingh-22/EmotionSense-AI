# Deployment environment

Values below are placeholders. Never commit credentials. Secrets are explicitly marked; generate the indicated application secrets fresh and distinct for production.

## Required on Render for the listed production features

| Name | Feature and format |
| --- | --- |
| `NODE_ENV` | production; production security and scheduler mode |
| `DATABASE_URL` | SECRET; pooled PostgreSQL connection, e.g. `postgresql://<pooled-host>/<database>`; backend queries |
| `DIRECT_URL` | SECRET; direct PostgreSQL connection, e.g. `postgresql://<direct-host>/<database>`; migrations and journal lock |
| `API_JWT_SECRET` | SECRET; fresh random >= 32 bytes; access JWT signing |
| `AUTH_CODE_HMAC_SECRET` | SECRET; fresh random >= 32 bytes, distinct from other secrets; code HMAC |
| `AUTH_REFRESH_REPLAY_KEY` | SECRET; fresh random 32-byte key encoded as 64 hex characters; refresh retry encryption |
| `CRON_SECRET` | SECRET; fresh random secret; external nightly trigger and cron endpoints |
| `CORS_ORIGIN` | comma-separated HTTPS website origins, e.g. `https://<site-host>`; browser API calls |
| `API_BASE_URL` | public HTTPS backend origin, e.g. `https://<backend-host>`; generated voice-audio URLs |
| `GROQ_API_KEY` | SECRET; Groq API key; default voice speech-to-text |
| `GEMINI_API_KEY` | SECRET; Gemini API key; primary chat and journal generation, and default Google TTS key fallback |

`GEMINI_API_KEY1` or `GEMINI_API_KEY2` can supply the primary Gemini LLM if the preferred key is absent. Google TTS falls back only to `GEMINI_API_KEY`, not those numbered keys. `GOOGLE_TTS_API_KEY` needs a key enabled for Cloud Text-to-Speech; if unavailable, TTS tries configured Sarvam then Murf. `STT_PROVIDER` does not select a different implementation in the live voice routes.

## Email provider

Production defaults to `EMAIL_PROVIDER=gmail`. The Gmail adapter is used for verification, password reset and emergency alerts. Configuration is validated without making a network call during startup.

| Name | Status / format |
| --- | --- |
| `EMAIL_PROVIDER` | Production default `gmail`; set `resend` to use the alternate provider. Non-production default: `resend`. |
| `GMAIL_CLIENT_ID` | Required for Gmail; desktop OAuth client ID. |
| `GMAIL_CLIENT_SECRET` | SECRET; required for Gmail; desktop OAuth client secret. |
| `GMAIL_REFRESH_TOKEN` | SECRET; required for Gmail; OAuth refresh token granted only `gmail.send`. |
| `GMAIL_SENDER` | Required for Gmail; dedicated sender account address. |
| `EMAIL_FROM_NAME` | Optional; default `MindHaven`; display name without control characters. |
| `RESEND_API_KEY` | SECRET; required only for `EMAIL_PROVIDER=resend`. |
| `RESEND_FROM` | Required only for `EMAIL_PROVIDER=resend`; verified sender address. |

Google's [Gmail send method](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/send) uses the `gmail.send` scope; [OAuth refresh](https://developers.google.com/identity/protocols/oauth2/web-server#offline) obtains an access token. The Gmail sender has account sending limits; provider approval and deliverability should be checked before launch.

## Optional provider credentials on Render

| Name | Use / default |
| --- | --- |
| `GEMINI_API_KEY1` | SECRET; optional extra/alternate Gemini rotation key; unset by default |
| `GEMINI_API_KEY2` | SECRET; optional extra/alternate Gemini rotation key; unset by default |
| `GOOGLE_TTS_API_KEY` | SECRET; Google TTS key, optional when GEMINI_API_KEY is valid for that API; defaults to GEMINI_API_KEY |
| `GOOGLE_STT_API_KEY` | SECRET; optional Google STT helper; no live caller currently; unset by default |
| `HUGGINGFACE_API_KEY` | SECRET; optional remote emotion-model inference; unset by default |
| `SARVAM_API_KEY` | SECRET; optional Sarvam TTS fallback after Google; unset by default |
| `MURF_API_KEY` | SECRET; optional Murf TTS fallback after Google and Sarvam; unset by default |

## Optional tuning on Render

Leave each variable unset to use the default shown. Keyword lists are comma-separated strings, not credentials.

| Name | Default |
| --- | --- |
| `ALLOWED_AUDIO_FORMATS` | wav,mp3,ogg,webm (comma-separated) |
| `AUTH_ACCESS_TTL_SECONDS` | 900 seconds |
| `AUTH_BCRYPT_COST` | 12 |
| `AUTH_CHALLENGE_TTL_SECONDS` | 600 seconds |
| `AUTH_PASSWORD_MIN_LENGTH` | 12 Unicode code points; bcrypt maximum 72 UTF-8 bytes |
| `AUTH_TRANSACTION_MAX_WAIT_MS` | 10000 ms |
| `AUTH_TRANSACTION_TIMEOUT_MS` | 15000 ms |
| `BILSTM_LABELS` | angry,disgust,fear,happy,neutral,sad (comma-separated) |
| `BILSTM_MAX_LENGTH` | 80 |
| `BILSTM_MODEL_PATH` | ./src/models/emotion_bilstm_final.onnx |
| `BILSTM_TEXT_ENABLED` | true |
| `BILSTM_THRESHOLD` | 0.5 |
| `CHAT_MEMORY_LENGTH` | 10 |
| `CONFIDENCE_THRESHOLD` | 0.6 |
| `DASHBOARD_DAY_START_HOUR` | 5 |
| `DASHBOARD_GENERATE_STORIES` | true |
| `DASHBOARD_LOOKBACK_DAYS` | 3650 |
| `DASHBOARD_MAX_TIMELINE_DAYS` | 45 |
| `DASHBOARD_WEEK_START` | monday |
| `EMOTION_FUSION_STRATEGY` | weighted |
| `ENABLE_EMERGENCY_ALERTS` | true |
| `GEMINI_MAX_TOKENS` | 1024 |
| `GEMINI_MODEL` | unset; auto-discovered model |
| `GEMINI_TEMPERATURE` | 0.7 |
| `GEMINI_TOP_K` | 40 |
| `GEMINI_TOP_P` | 0.95 |
| `GOOGLE_TTS_AUDIO_ENCODING` | MP3 |
| `GOOGLE_TTS_LANGUAGE` | en-US |
| `GOOGLE_TTS_PITCH` | 0 |
| `GOOGLE_TTS_SPEED` | 1 |
| `GOOGLE_TTS_VOICE` | en-US-Neural2-C |
| `GROQ_MODEL` | unset; auto-discovered model |
| `GROQ_RESPONSE_FORMAT` | verbose_json |
| `GROQ_TEMPERATURE` | 0 |
| `HIGH_RISK_KEYWORDS` | built-in comma-separated keyword list |
| `JOURNAL_CRON_SCHEDULE` | 30 23 * * * (Asia/Kolkata) |
| `JOURNAL_SCHEDULER_ENABLED` | unset; production registers regardless |
| `LLAMA_ENABLED` | false |
| `LLAMA_MAX_TOKENS` | 1024 |
| `LLAMA_MODEL` | unset; auto-discovered model |
| `LLAMA_PROVIDER` | groq |
| `LLAMA_TEMPERATURE` | 0.7 |
| `LOG_LEVEL` | info (read by config; current privacy logger ignores it) |
| `MAX_AUDIO_FILE_SIZE` | 10485760 bytes |
| `MEDIUM_RISK_KEYWORDS` | built-in comma-separated keyword list |
| `MURF_LOCALE` | en-US |
| `MURF_MODEL` | FALCON |
| `MURF_VOICE_ID` | Matthew |
| `PORT` | Render supplies it; server fallback 3000 |
| `RATE_LIMIT_AI_PER_DAY` | 500 |
| `RATE_LIMIT_AI_PER_MIN` | 20 |
| `RATE_LIMIT_AUTH_FAILURES_PER_15MIN` | 60 |
| `RATE_LIMIT_GLOBAL_PER_15MIN` | 1000 |
| `RATE_LIMIT_SENSITIVE_PER_HOUR` | 20 |
| `RENDER_GIT_COMMIT` | Render-supplied; otherwise unknown |
| `STT_LANGUAGE` | unset; automatic language detection |
| `STT_PROVIDER` | groq; configured status value; live voice routes call Groq directly |
| `TEMP_AUDIO_PATH` | ./temp/audio |
| `TEXT_EMOTION_MODEL` | michellejieli/emotion_text_classifier |
| `TEXT_EMOTION_WEIGHT` | 0.5 |
| `TRUST_PROXY_HOPS` | 1 |
| `TTS_ENABLED` | true |
| `TTS_PROVIDER` | google; other values rejected by the primary TTS service |
| `VOICE_EMOTION_MODEL` | superb/wav2vec2-base-superb-er |
| `VOICE_EMOTION_WEIGHT` | 0.5 |

## Required on Vercel

| Name | Feature and format |
| --- | --- |
| `NODE_ENV` | `production`; production mode (normally platform supplied) |
| `NEXTAUTH_URL` | canonical HTTPS website origin, e.g. `https://<site-host>`; session cookies and same-origin checks |
| `NEXT_PUBLIC_API_URL` | public HTTPS backend origin, e.g. `https://<backend-host>`; browser and server auth calls |
| `NEXTAUTH_SECRET` | SECRET; fresh random secret; NextAuth cookie encryption |

## Optional tuning on Vercel

Leave unset to use the defaults: `AUTH_RL_LOGIN_IP_PER_15MIN` = 30, `AUTH_RL_LOGIN_ACCOUNT_PER_15MIN` = 8, `AUTH_RL_REGISTER_IP_PER_HOUR` = 5, and `AUTH_RL_REGISTER_EMAIL_PER_HOUR` = 3. They are positive integers.

## Must be off or absent in production

- Render: `EXPOSE_ERROR_DETAILS` unset or `false`; set `NODE_ENV=production`.
- Vercel: `AUTH_TEST_FORCE_REFRESH` unset or `false`; set `NODE_ENV=production`.

## Render proxy trust

Use `TRUST_PROXY_HOPS=1` for the standard Render Express deployment, as in [Render?s Express example](https://render.com/articles/how-to-implement-authentication-and-authorization). With one trusted hop, Express uses the rightmost forwarded address; [Render describes its edge and forwarded headers](https://render.com/articles/how-render-handles-ddos-attacks), and [Express documents hop-based trust](https://expressjs.com/en/guide/behind-proxies.html). Verify the actual ingress chain before launch: too few hops can group clients under a proxy IP; too many can trust a caller-supplied address and undermine per-IP rate limits. The proxy unit test checks which address Express selects; it does not prove the live Render ingress topology.

## Remove obsolete values

Remove `SMTP_*`, `GMAIL_EMAIL`, `GMAIL_APP_PASSWORD`, `OUTLOOK_*`, `SENDGRID_*`, `SUPABASE_*`, `DATABASE_TYPE`, `OPENAI_API_KEY`, `EMAIL_ENABLED`, `TTS_MODEL`, `TTS_VOICE`, `TTS_SPEED`, `RECOVERY_DATABASE_URL`, Firebase/account-linking flags and old bridge secrets. Remove `DATABASE_URL`, `DIRECT_URL`, and backend secrets from Vercel.

## Email and nightly trigger

Gmail is the default production email provider; Resend is optional and requires a verified sender domain. POST `/api/internal/journal/run` with `Authorization: Bearer <CRON_SECRET>`; it returns 202 and runs asynchronously using the direct connection for its advisory lock.

The protected `GET /api/internal/client-ip` endpoint accepts the same `CRON_SECRET` bearer credential and reports the resolved IP, forwarded-entry count and trusted hop count.
