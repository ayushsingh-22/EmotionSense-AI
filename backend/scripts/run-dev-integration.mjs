import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import dotenv from 'dotenv';
import pg from 'pg';

let settings;
try { settings = dotenv.parse(readFileSync('.env.test')); }
catch { console.error('Create backend/.env.test before running integration tests.'); process.exit(1); }
for (const key of ['DATABASE_URL', 'DIRECT_URL', 'EXPECTED_NEON_BRANCH_ID']) {
  if (!settings[key]) { console.error(`Missing required setting: ${key}`); process.exit(1); }
}
if(settings.EXPECTED_NEON_BRANCH_ID!=='br-flat-scene-b3f7jcb4' || ![settings.DATABASE_URL,settings.DIRECT_URL].every(value=>{try{return new URL(value).hostname.replace('-pooler.','.').startsWith('ep-shiny-fire-b3nfje3k.') && new URL(value).hostname.endsWith('.aws.neon.tech')}catch{return false}})){console.error('Integration tests require the approved development endpoint.');process.exit(1)}
let ready=false;const until=Date.now()+30000;
while(Date.now()<until&&!ready){const client=new pg.Client({connectionString:settings.DIRECT_URL,connectionTimeoutMillis:5000,query_timeout:5000});try{await client.connect();const result=await client.query("SELECT 1 AS ok, current_setting('neon.branch_id',true) AS branch");if(result.rows[0].branch!=='br-flat-scene-b3f7jcb4'){console.error('Integration tests refused an unexpected database branch.');process.exit(1)}ready=result.rows[0].ok===1}catch{}finally{await client.end().catch(()=>{})}if(!ready&&Date.now()<until)await new Promise(r=>setTimeout(r,1000))}
if(!ready){console.error('Development database did not become reachable within approximately 30 seconds.');process.exit(1)}
console.log('Development database warm-up succeeded.');
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
if (process.argv.length > 3 || (process.argv[2] && !['--wellbeing-only','--nightly-only','--consent-only','--catalog-only'].includes(process.argv[2]))) { console.error('Unknown integration test option'); process.exit(1); }
const files = process.argv[2] === '--catalog-only' ? ['tests/catalog.integration.test.js'] : process.argv[2] === '--consent-only' ? ['tests/wellbeing.integration.test.js'] : process.argv[2] === '--nightly-only' ? ['tests/nightlyLock.integration.test.js'] : process.argv[2] === '--wellbeing-only' ? ['tests/api.integration.test.js', 'tests/wellbeing.integration.test.js'] : ['tests/api.integration.test.js', 'tests/backendAuth.integration.test.js', 'tests/nightlyLock.integration.test.js', 'tests/wellbeing.integration.test.js', 'tests/catalog.integration.test.js'];
const result = spawnSync(process.execPath, ['--test', '--test-concurrency=1', ...files], { env, stdio: 'inherit' });
if (result.error) { console.error('Unable to start integration tests.'); process.exit(1); }
process.exit(result.status ?? 1);
