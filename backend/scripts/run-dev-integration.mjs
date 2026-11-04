import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import dotenv from 'dotenv';

let settings;
try { settings = dotenv.parse(readFileSync('.env.test')); }
catch { console.error('Create backend/.env.test before running integration tests.'); process.exit(1); }
for (const key of ['DATABASE_URL', 'DIRECT_URL', 'EXPECTED_NEON_BRANCH_ID']) {
  if (!settings[key]) { console.error(`Missing required setting: ${key}`); process.exit(1); }
}
const randomSecret = () => randomBytes(32).toString('hex');
const env = {
  ...process.env, DATABASE_URL: settings.DATABASE_URL, DIRECT_URL: settings.DIRECT_URL,
  EXPECTED_NEON_BRANCH_ID: settings.EXPECTED_NEON_BRANCH_ID,
  NODE_ENV: 'test', RUN_AUTH_DB_TESTS: '1',
  API_JWT_SECRET: randomSecret(), AUTH_CODE_HMAC_SECRET: randomSecret(), AUTH_REFRESH_REPLAY_KEY: randomSecret(),
  GEMINI_API_KEY: '', GEMINI_API_KEY1: '', GEMINI_API_KEY2: '', GROQ_API_KEY: '',
  GOOGLE_TTS_API_KEY: '', SARVAM_API_KEY: '', MURF_API_KEY: '', HUGGINGFACE_API_KEY: '',
  RESEND_API_KEY: '', GMAIL_REFRESH_TOKEN: '', ENABLE_EMERGENCY_ALERTS: 'false'
};
const result = spawnSync(process.execPath, ['--test', '--test-concurrency=1', 'tests/api.integration.test.js', 'tests/backendAuth.integration.test.js', 'tests/nightlyLock.integration.test.js'], { env, stdio: 'inherit' });
if (result.error) { console.error('Unable to start integration tests.'); process.exit(1); }
process.exit(result.status ?? 1);
