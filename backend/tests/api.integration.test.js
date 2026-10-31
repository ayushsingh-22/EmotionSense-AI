/**
 * Integration / authorization regression tests against the REAL Express app
 * (all legacy routers) and the DEVELOPMENT Neon database.
 *
 * - Creates two throwaway users (email prefix "phase2a-test-") + their data, and
 *   deletes them (FK cascade) afterwards.
 * - Never calls an LLM/TTS/STT provider: every request that could reach one is
 *   rejected earlier (auth / validation / ownership / rate limit) by design.
 * - Skipped unless DATABASE_URL is set; refuses to run when NODE_ENV=production.
 */
import 'dotenv/config';
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { setTestEnv, bearer } from './helpers.js';

const originalNodeEnv = process.env.NODE_ENV;
if (String(originalNodeEnv || '').trim().toLowerCase() === 'production') throw new Error('Refusing to run integration tests with NODE_ENV=production');
setTestEnv({
  RATE_LIMIT_AI_PER_MIN: '3',
  RATE_LIMIT_AUTH_FAILURES_PER_15MIN: '10000',
  // Hard isolation from every external provider: with no keys and email disabled,
  // no test can reach an LLM / TTS / STT / email / notification service even by mistake.
  GEMINI_API_KEY: 'test-placeholder-not-a-real-key' /* keeps config's startup warning quiet; no call can be made */, GEMINI_API_KEY1: '', GEMINI_API_KEY2: '', GROQ_API_KEY: 'test-placeholder-not-a-real-key',
  GOOGLE_TTS_API_KEY: '', SARVAM_API_KEY: '', MURF_API_KEY: '', HUGGINGFACE_API_KEY: '',
  ENABLE_EMERGENCY_ALERTS: 'false'
});

const hasDb = !!process.env.DATABASE_URL;
const { buildApp } = await import('../src/server.js');
const prisma = hasDb ? (await import('../src/lib/prisma.js')).default : null;
const app = buildApp();
const { createAuthServices } = await import('../src/auth/index.js');
const services = hasDb ? createAuthServices({prisma}) : null;

const PREFIX = 'phase2a-test-';
let A; let B; let tokA; let tokB; let sessionB; let activityB;
const mintToken = async userId => {
  if(!dbApproved) throw new Error('Database guard must pass before creating test sessions');
  let user=await prisma.user.findUnique({where:{id:userId}});
  if(!user) user=await prisma.user.create({data:{id:userId,email:`${PREFIX}${randomUUID()}@example.invalid`,passwordHash:'!'}});
  return (await services.sessions.create({userId:user.id})).accessToken;
};

/**
 * Safety net: these tests WRITE rows (throwaway users + their data), so they run
 * ONLY against the Unified Neon V2 development branch. Before any write:
 *  - the DATABASE reports its own branch id / endpoint / project (neon.* settings);
 *  - production and recovery branches / the production endpoint are refused outright;
 *  - the reported ids must equal the development ids below AND EXPECTED_NEON_BRANCH_ID.
 * Cleanup only ever runs after this guard has passed (see `dbApproved`).
 * Tests never run migrations, reset schemas or truncate: they only INSERT/DELETE
 * rows whose email is  phase2a-test-*@example.invalid.
 */
const DEV = { branch: 'br-ancient-snow-b3si0kwz', endpoint: 'ep-cold-hill-b3lffx1r', project: 'fancy-union-28873755' };
let dbApproved = false;
const assertSafeTestDatabase = async () => {
  const url = new URL(process.env.DATABASE_URL);
  const schema = url.searchParams.get('schema') || 'public';
  if (url.hostname.split('.')[0].replace(/-pooler$/, '') !== DEV.endpoint || !url.hostname.endsWith('.aws.neon.tech')) throw new Error('Refusing unapproved database endpoint');
  const [id] = await prisma.$queryRawUnsafe(
    "select current_setting('neon.branch_id', true) as branch, current_setting('neon.endpoint_id', true) as endpoint, current_setting('neon.project_id', true) as project");
  const expected = process.env.EXPECTED_NEON_BRANCH_ID;
  if (!expected) throw new Error('Refusing to run: EXPECTED_NEON_BRANCH_ID must be set');
  if (id.branch !== DEV.branch || id.endpoint !== DEV.endpoint || id.project !== DEV.project) {
    throw new Error(`Refusing to run: database reports ${id.branch}/${id.endpoint}/${id.project}, expected the development branch`);
  }
  if (expected !== DEV.branch) throw new Error(`Refusing to run: EXPECTED_NEON_BRANCH_ID=${expected} is not the development branch`);
  dbApproved = true;
  console.log(`# test database verified: branch=${id.branch} endpoint=${id.endpoint} project=${id.project} schema=${schema}`);
};

const seed = async () => {
  await assertSafeTestDatabase();
  await cleanup(); // sweep leftovers of any previously crashed run (same strict email pattern)
  const mk = (tag) => prisma.user.create({
    data: { email: `${PREFIX}${tag}-${randomUUID()}@example.invalid`, passwordHash: '!', fullName: `Phase2A ${tag}` }
  });
  A = await mk('a');
  B = await mk('b');
  sessionB = await prisma.chatSession.create({ data: { userId: B.id, sessionTitle: 'B private chat' } });
  await prisma.message.create({
    data: { userId: B.id, sessionId: sessionB.id, role: 'user', content: 'B secret message' }
  });
  await prisma.emergencyContact.create({
    data: { userId: B.id, contactName: 'B Contact', contactEmail: 'b-contact@example.invalid', contactPhone: '+10000000000' }
  });
  activityB = await prisma.masterUserActivity.create({
    data: {
      userId: B.id, sessionId: sessionB.id, activityType: 'chat_message', role: 'user',
      source: 'test', content: 'B secret message', localDate: '2025-01-01'
    }
  });
  tokA = await mintToken(A.id);
  tokB = await mintToken(B.id);
};

const cleanup = async () => {
  if (!prisma || !dbApproved) return; // never delete anywhere the guard has not approved
  await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX, endsWith: '@example.invalid' } } });
};
const finish = async () => { await cleanup(); await prisma?.$disconnect(); };
after(async()=>{
  try {
    await cleanup();
    if(dbApproved){const [users,sessions,challenges]=await Promise.all([prisma.user.count(),prisma.authSession.count(),prisma.authChallenge.count()]);console.log(`FINAL_COUNTS users=${users} sessions=${sessions} challenges=${challenges}`);assert.equal(users+sessions+challenges,0)}
  } finally {await prisma?.$disconnect()}
});

describe('public surface', () => {
  test('GET /api/health and / are public and minimal', async () => {
    const h = await request(app).get('/api/health').expect(200);
    assert.ok(!('services' in h.body));
    await request(app).get('/').expect(200);
  });
  test('unknown route is 404 JSON', async () => {
    await request(app).get('/api/nope').expect(404);
  });
  test('security headers on every response; no x-powered-by', async () => {
    const r = await request(app).get('/api/health');
    assert.equal(r.headers['x-content-type-options'], 'nosniff');
    assert.equal(r.headers['x-powered-by'], undefined);
    assert.match(r.headers['x-request-id'], /^[0-9a-f-]{36}$/); // server-generated correlation id
  });
  test('request id is never taken from the client', async () => {
    const r = await request(app).get('/api/health').set('X-Request-Id', 'attacker-controlled');
    assert.notEqual(r.headers['x-request-id'], 'attacker-controlled');
    assert.match(r.headers['x-request-id'], /^[0-9a-f-]{36}$/);
  });
  test('error responses carry a requestId and no internal text', async () => {
    const r = await request(app).post('/api/chat/message').set('Authorization', 'Bearer garbage').send({ message: 'hi' }).expect(401);
    assert.equal(r.body.success, false);
    assert.ok(!/prisma|postgres|stack/i.test(JSON.stringify(r.body)));
  });
  test('diagnostic / admin endpoints are not public', async () => {
    await request(app).get('/api/health/detailed').expect(401);
    await request(app).get('/api/health/email').expect(401);
    await request(app).get('/api/cron/ping').expect(401);
  });
  test('/audio does not list directories or serve dotfiles', async () => {
    await request(app).get('/audio/').expect(404);
    await request(app).get('/audio/.gitkeep').expect(404);
  });
});

describe('every protected endpoint rejects unauthenticated callers (401)', () => {
  const U = '00000000-0000-0000-0000-000000000000';
  const endpoints = [
    ['get', '/api/chat/sessions'],
    ['post', '/api/chat/sessions'],
    ['get', `/api/chat/sessions/${U}/messages`],
    ['put', `/api/chat/sessions/${U}/title`],
    ['delete', `/api/chat/sessions/${U}`],
    ['post', '/api/chat/message'],
    ['post', '/api/chat/message/stream'],
    ['post', '/api/chat/voice'],
    ['post', '/api/chat/voice/stream'],
    ['post', '/api/chat/transcribe'],
    ['post', '/api/analyze/text'],
    ['post', '/api/analyze/voice'],
    ['post', '/api/analyze/multimodal'],
    ['post', '/api/response/generate'],
    ['post', '/api/response/chat'],
    ['post', '/api/tts'],
    ['post', '/api/tts/generate'],
    ['post', '/api/tts/sarvam'],
    ['get', '/api/tts/health'],
    ['post', '/api/emergency/save'],
    ['post', '/api/emergency/update'],
    ['put', '/api/emergency/update'],
    ['get', `/api/emergency/${U}`],
    ['get', `/api/emergency/check/${U}`],
    ['delete', `/api/emergency/${U}`],
    ['get', '/api/insights/daily'],
    ['get', '/api/insights/weekly'],
    ['get', '/api/insights/monthly'],
    ['get', '/api/insights/stats'],
    ['get', '/api/insights/moments'],
    ['get', '/api/insights/timeline/2025-01-01'],
    ['get', '/api/journal/today'],
    ['get', '/api/journal/list'],
    ['get', '/api/journal/status'],
    ['get', '/api/journal/2025-01-01'],
    ['post', '/api/journal/generate'],
    ['post', '/api/journal/refresh'],
    ['post', '/api/journal/test-generation'],
    ['post', '/api/activity'],
    ['get', `/api/activity/history/${U}`],
    ['get', `/api/activity/latest/${U}`],
    ['get', `/api/activity/insights/${U}`],
    ['get', `/api/activity/stats/${U}`],
    ['get', `/api/activity/session/${U}`],
    ['get', `/api/activity/session/${U}/messages`],
    ['get', '/api/activity/types'],
    ['put', `/api/activity/${U}`],
    ['delete', `/api/activity/${U}`]
  ];
  for (const [method, path] of endpoints) {
    test(`${method.toUpperCase()} ${path}`, async () => {
      await request(app)[method](path).send({}).expect(401);
    });
  }
  test('garbage bearer token is rejected on a paid endpoint', async () => {
    await request(app).post('/api/chat/message').set(bearer('garbage')).send({ message: 'hi' }).expect(401);
  });
});

describe('ownership / IDOR (user A attacking user B)', { skip: !hasDb && 'DATABASE_URL not set' }, () => {
  before(seed);
  after(finish);

  test('profile and emotion history are scoped to the authenticated user', async () => {
    const profile = await request(app).get('/api/profile').set(bearer(tokA));
    assert.equal(profile.status, 200); assert.equal(profile.body.id, A.id);
    assert.equal((await request(app).get('/api/profile').query({userId:B.id}).set(bearer(tokA))).status, 403);
    assert.equal((await request(app).patch('/api/profile').send({userId:B.id,fullName:'unauthorized'}).set(bearer(tokA))).status, 403);
    assert.equal((await prisma.user.findUnique({where:{id:B.id},select:{fullName:true}})).fullName, B.fullName);
    assert.equal((await request(app).patch('/api/profile').send({fullName:'Updated'}).set(bearer(tokA))).status, 200);
    const privateMessage = await prisma.message.create({data:{userId:B.id,sessionId:sessionB.id,role:'user',content:'private',emotion:'sadness'}});
    const history = await request(app).get('/api/messages/emotion-history').set(bearer(tokA));
    assert.equal(history.status, 200); assert.ok(history.body.messages.every(m => m.id !== privateMessage.id));
    const ownHistory = await request(app).get('/api/messages/emotion-history').set(bearer(tokB));
    assert.ok(ownHistory.body.messages.some(m => m.id === privateMessage.id));
    assert.equal((await request(app).get('/api/messages/emotion-history').query({userId:B.id}).set(bearer(tokA))).status, 403);
    await prisma.message.delete({where:{id:privateMessage.id}});
  });

  test('chat: supplying B as userId is rejected, never silently honoured', async () => {
    await request(app).get(`/api/chat/sessions?userId=${B.id}`).set(bearer(tokA)).expect(403);
    await request(app).post('/api/chat/sessions').set(bearer(tokA)).send({ userId: B.id }).expect(403);
    await request(app).post('/api/chat/message').set(bearer(tokA)).send({ userId: B.id, message: 'hi' }).expect(403);
  });

  test("chat: A cannot see B's sessions or messages", async () => {
    const list = await request(app).get('/api/chat/sessions').set(bearer(tokA)).expect(200);
    assert.ok(!JSON.stringify(list.body).includes(sessionB.id));
    assert.ok(!JSON.stringify(list.body).includes('B secret message'));
    const msgs = await request(app).get(`/api/chat/sessions/${sessionB.id}/messages`).set(bearer(tokA));
    assert.ok(!JSON.stringify(msgs.body).includes('B secret message'));
  });

  test("chat: A cannot rename or delete B's session", async () => {
    const put = await request(app).put(`/api/chat/sessions/${sessionB.id}/title`).set(bearer(tokA)).send({ title: 'pwned' });
    assert.ok(put.status >= 400);
    await request(app).delete(`/api/chat/sessions/${sessionB.id}`).set(bearer(tokA));
    const still = await prisma.chatSession.findUnique({ where: { id: sessionB.id } });
    assert.equal(still.sessionTitle, 'B private chat');
    assert.equal(await prisma.message.count({ where: { sessionId: sessionB.id } }), 1);
  });

  test("chat: A cannot post into B's session (404 before any LLM work)", async () => {
    for (const path of ['/api/chat/message', '/api/chat/message/stream']) {
      await request(app).post(path).set(bearer(tokA)).send({ message: 'inject', sessionId: sessionB.id }).expect(404);
    }
    assert.equal(await prisma.message.count({ where: { sessionId: sessionB.id } }), 1);
  });

  test("chat: B can still use B's own data (positive control)", async () => {
    const list = await request(app).get('/api/chat/sessions').set(bearer(tokB)).expect(200);
    assert.ok(JSON.stringify(list.body).includes(sessionB.id));
    const msgs = await request(app).get(`/api/chat/sessions/${sessionB.id}/messages`).set(bearer(tokB)).expect(200);
    assert.ok(JSON.stringify(msgs.body).includes('B secret message'));
  });

  test("emergency: A cannot read, overwrite or delete B's contact", async () => {
    await request(app).get(`/api/emergency/${B.id}`).set(bearer(tokA)).expect(403);
    await request(app).get(`/api/emergency/check/${B.id}`).set(bearer(tokA)).expect(403);
    await request(app).delete(`/api/emergency/${B.id}`).set(bearer(tokA)).expect(403);
    await request(app).post('/api/emergency/save').set(bearer(tokA))
      .send({ userId: B.id, contactName: 'Evil', contactEmail: 'evil@example.invalid' }).expect(403);
    await request(app).put('/api/emergency/update').set(bearer(tokA))
      .send({ userId: B.id, contactName: 'Evil', contactEmail: 'evil@example.invalid' }).expect(403);
    const c = await prisma.emergencyContact.findUnique({ where: { userId: B.id } });
    assert.equal(c.contactName, 'B Contact');
  });

  test('emergency: A saving without userId writes to A (identity from token) and never touches B', async () => {
    await request(app).post('/api/emergency/save').set(bearer(tokA))
      .send({ contactName: 'A Contact', contactEmail: 'a-contact@example.invalid' }).expect(200);
    assert.equal((await prisma.emergencyContact.findUnique({ where: { userId: A.id } })).contactName, 'A Contact');
    assert.equal((await prisma.emergencyContact.findUnique({ where: { userId: B.id } })).contactName, 'B Contact');
    await request(app).get(`/api/emergency/${A.id}`).set(bearer(tokA)).expect(200);
  });

  test('emergency: invalid email rejected before DB', async () => {
    await request(app).post('/api/emergency/save').set(bearer(tokA))
      .send({ contactName: 'x', contactEmail: 'not-an-email' }).expect(400);
  });

  test('journal / insights: other userId query is forbidden', async () => {
    for (const p of ['/api/journal/today', '/api/journal/list', '/api/journal/2025-01-01',
      '/api/insights/daily', '/api/insights/weekly', '/api/insights/monthly', '/api/insights/stats', '/api/insights/moments']) {
      await request(app).get(`${p}${p.includes('?') ? '&' : '?'}userId=${B.id}`).set(bearer(tokA)).expect(403);
    }
    await request(app).post('/api/journal/generate').set(bearer(tokA)).send({ userId: B.id }).expect(403);
    await request(app).post('/api/journal/refresh').set(bearer(tokA)).send({ userId: B.id }).expect(403);
  });

  test('journal: malformed date / unbounded limit rejected; test-generation needs the cron secret', async () => {
    await request(app).get('/api/journal/not-a-date').set(bearer(tokA)).expect(400);
    await request(app).get('/api/journal/list?limit=999999').set(bearer(tokA)).expect(400);
    await request(app).post('/api/journal/test-generation').set(bearer(tokA)).send({}).expect(401);
  });

  test("activity: A cannot read, update or delete B's activity rows", async () => {
    await request(app).get(`/api/activity/history/${B.id}`).set(bearer(tokA)).expect(403);
    await request(app).get(`/api/activity/latest/${B.id}`).set(bearer(tokA)).expect(403);
    await request(app).get(`/api/activity/stats/${B.id}`).set(bearer(tokA)).expect(403);
    await request(app).post('/api/activity').set(bearer(tokA))
      .send({ user_id: B.id, activity_type: 'chat_message', content: 'x' }).expect(403);

    const sess = await request(app).get(`/api/activity/session/${sessionB.id}`).set(bearer(tokA)).expect(200);
    assert.equal(sess.body.count, 0);
    const msgs = await request(app).get(`/api/activity/session/${sessionB.id}/messages`).set(bearer(tokA)).expect(200);
    assert.equal(msgs.body.count, 0);

    await request(app).put(`/api/activity/${activityB.id}`).set(bearer(tokA)).send({ content: 'pwned' }).expect(404);
    await request(app).delete(`/api/activity/${activityB.id}`).set(bearer(tokA)).expect(404);
    const row = await prisma.masterUserActivity.findUnique({ where: { id: activityB.id } });
    assert.equal(row.content, 'B secret message');
    assert.equal(row.userId, B.id);
  });

  test('activity: owner can update and delete own row; user_id cannot be reassigned', async () => {
    await request(app).put(`/api/activity/${activityB.id}`).set(bearer(tokB))
      .send({ content: 'edited', user_id: A.id }).expect(403);
    await request(app).put(`/api/activity/${activityB.id}`).set(bearer(tokB))
      .send({ content: 'edited' }).expect(200);
    const row = await prisma.masterUserActivity.findUnique({ where: { id: activityB.id } });
    assert.equal(row.content, 'edited');
    assert.equal(row.userId, B.id);
    await request(app).delete(`/api/activity/${activityB.id}`).set(bearer(tokB)).expect(200);
  });
});

describe('paid endpoints: rate limits and validation before provider calls', { skip: !hasDb && 'DATABASE_URL not set' }, () => {
  test('oversized text/TTS payloads are rejected (400) without reaching a provider', async () => {
    const token = await mintToken(randomUUID());
    await request(app).post('/api/tts').set(bearer(token)).send({ text: 'x'.repeat(5001) }).expect(400);
  });

  test('per-user AI burst limit returns 429 (limit=3/min in this suite)', async () => {
    const token = await mintToken(randomUUID());
    const statuses = [];
    for (let i = 0; i < 5; i++) {
      const r = await request(app).post('/api/tts').set(bearer(token)).send({});
      statuses.push(r.status);
    }
    assert.deepEqual(statuses.slice(0, 3), [400, 400, 400]);
    assert.ok(statuses.slice(3).every((s) => s === 429), `got ${statuses}`);
    // another user is unaffected
    const other = await mintToken(randomUUID());
    await request(app).post('/api/tts').set(bearer(other)).send({}).expect(400);
  });
});
