import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import { createPasswordService } from '../src/auth/passwordService.js';
import { createExportRouter } from '../src/routes/exportRoutes.js';
import { buildUserExport, sanitizeJson, findForbiddenKeys, isForbiddenKey, exportFilename, README } from '../src/wellbeing/dataExport.js';

const passwords = createPasswordService({ cost: 4 });
const PASSWORD = 'synthetic-export-password';
const HASH = await passwords.hash(PASSWORD);
const OTHER_HASH = await passwords.hash('other-user-password-123');
const A = 'user-a', B = 'user-b';
const at = new Date('2026-11-01T10:00:00Z');

// Minimal Prisma stand-in: filters rows by `userId` (and nested `session.userId`)
// and records every where clause so tests can prove each query is owner-scoped.
function fakeDb({ empty = false, bigNote = 0 } = {}) {
  const calls = [];
  const rows = {
    user: [{ id: A, email: 'a@example.invalid', fullName: 'Synthetic A', passwordHash: HASH, createdAt: at }, { id: B, email: 'b@example.invalid', fullName: 'Synthetic B', passwordHash: OTHER_HASH, createdAt: at }],
    userPreference: empty ? [] : [{ userId: A, preferredLanguage: 'en', timezone: 'UTC', preferredActivityTypes: ['audio'], preferredSupportModes: [], accessibilityPreferences: { reduceMotion: true }, updatedAt: at }, { userId: B, preferredLanguage: 'hi', timezone: 'Asia/Kolkata', preferredActivityTypes: [], preferredSupportModes: [], accessibilityPreferences: {}, updatedAt: at }],
    userConsent: empty ? [] : [{ id: 'c1', userId: A, purpose: 'voice_processing', granted: true, noticeVersion: 'voice-processing-v1', source: 'in_app', recordedAt: at }, { id: 'c2', userId: B, purpose: 'voice_processing', granted: true, noticeVersion: 'voice-processing-v1', source: 'in_app', recordedAt: at }],
    moodCheckin: empty ? [] : [{ id: 'm1', userId: A, moodLabel: 'calm', moodScore: 7, energyScore: null, note: bigNote ? 'x'.repeat(bigNote) : 'A note', createdAt: at }, { id: 'm2', userId: B, moodLabel: 'sad', moodScore: 2, energyScore: null, note: 'B-PRIVATE-NOTE', createdAt: at }],
    journalEntry: empty ? [] : [{ id: 'j1', userId: A, title: 'T', body: 'A journal', origin: 'user', createdAt: at, updatedAt: at }, { id: 'j2', userId: B, title: 'T', body: 'B-PRIVATE-JOURNAL', origin: 'user', createdAt: at, updatedAt: at }],
    dailyEmotionSummary: empty ? [] : [{ id: 'd1', userId: A, date: '2026-11-01', dominantEmotion: 'joy', moodScore: 6, totalEntries: 2, summaryText: 'S', eJournalEntry: 'Generated journal', createdAt: at, updatedAt: at, emotionDistribution: { joy: 1 }, timeSegments: null, trendPoints: null, compassPoints: null, emotionFlow: null, segmentSummary: null, keyMoments: [{ text: 'k', apiKey: 'leak', token: 'leak' }] }],
    weeklyEmotionSummary: [], emotionFlowSegment: [],
    chatSession: empty ? [] : [{ id: 's1', userId: A, sessionTitle: 'Chat', createdAt: at, updatedAt: at }, { id: 's2', userId: B, sessionTitle: 'B chat', createdAt: at, updatedAt: at }],
    message: empty ? [] : [
      { id: 'msg1', userId: A, sessionId: 's1', role: 'user', content: 'hello', emotion: 'joy', emotionConfidence: 0.9, metadata: { model: 'x', user_id: B, nested: { refreshToken: 'eyJabc.def.ghi', ok: 1 }, audio_url: '/audio/secret.mp3' }, createdAt: at },
      { id: 'msg2', userId: B, sessionId: 's2', role: 'user', content: 'B-PRIVATE-MESSAGE', emotion: null, emotionConfidence: null, metadata: null, createdAt: at }],
    emotionAnalysis: [], activitySession: empty ? [] : [{ id: 'a1', userId: A, contentItemId: 'ci1', status: 'completed', startedAt: at, completedAt: at, contentItem: { title: 'Breathe', contentType: 'breathing' }, feedback: { helpfulness: 'better', beforeMoodScore: 3, afterMoodScore: 6, submittedAt: at } }],
    emergencyContact: empty ? [] : [{ userId: A, contactName: 'Friend', contactEmail: 'friend@example.invalid', contactPhone: null, notifyEnabled: true, createdAt: at, updatedAt: at }],
    alertLog: empty ? [] : [{ id: 'l1', userId: A, alertType: 'emergency_dispatch', contactEmail: 'friend@example.invalid', messageExcerpt: 'PRIVATE-EXCERPT', additionalData: { status: 'accepted', alertSent: true }, createdAt: at }],
    safetyAlert: empty ? [] : [{ id: 'sa1', userId: A, alertSent: false, alertSentAt: null, messageText: 'PRIVATE-TEXT', emergencyContactId: 'x', createdAt: at }],
    masterUserActivity: empty ? [] : [
      { id: 'ma1', userId: A, sessionId: 's1', activityType: 'chat_message', role: 'user', source: 'web', content: 'A activity', emotionData: { emotion: 'joy', api_key: 'leak' }, metadata: null, localDate: '2026-11-01', createdAt: at },
      { id: 'ma2', userId: B, sessionId: 's2', activityType: 'chat_message', role: 'user', source: 'web', content: 'B-PRIVATE-ACTIVITY', emotionData: null, metadata: null, localDate: '2026-11-01', createdAt: at }],
    recommendationRun: empty ? [] : [
      { id: 'r1', userId: A, moodCheckinId: 'm1', rulesVersion: 'rules-v1', contextCode: null, createdAt: at, items: [{ contentItemId: 'ci1', position: 1, score: 0.5, reasonCode: 'calm', selectedAt: null }] },
      { id: 'r2', userId: B, moodCheckinId: 'm2', rulesVersion: 'B-PRIVATE-RULES', contextCode: null, createdAt: at, items: [] }],
    authSession: [
      { id: 'as1', userId: A, familyId: 'FAMILY-ID-VALUE', tokenHash: 'TOKEN-HASH-VALUE', replayCiphertext: 'REPLAY-VALUE', deviceLabel: 'Synthetic phone', createdAt: new Date('2026-11-20T00:00:00Z'), lastUsedAt: new Date('2026-11-20T01:00:00Z'), expiresAt: new Date('2026-12-20T00:00:00Z'), consumedAt: new Date('2026-11-21T00:00:00Z'), revokedAt: null },
      { id: 'as2', userId: A, familyId: 'FAMILY-ID-VALUE', tokenHash: 'TOKEN-HASH-VALUE-2', replayCiphertext: null, deviceLabel: null, createdAt: new Date('2026-11-21T00:00:00Z'), lastUsedAt: new Date('2026-11-25T00:00:00Z'), expiresAt: new Date('2026-12-20T00:00:00Z'), consumedAt: null, revokedAt: null },
      { id: 'as3', userId: A, familyId: 'FAMILY-ID-OLD', tokenHash: 'TOKEN-HASH-VALUE-3', replayCiphertext: null, deviceLabel: 'Old laptop', createdAt: new Date('2026-10-01T00:00:00Z'), lastUsedAt: null, expiresAt: new Date('2026-10-31T00:00:00Z'), consumedAt: null, revokedAt: new Date('2026-10-02T00:00:00Z') },
      { id: 'as4', userId: B, familyId: 'FAMILY-ID-B', tokenHash: 'TOKEN-HASH-B', replayCiphertext: null, deviceLabel: 'B-PRIVATE-DEVICE', createdAt: at, lastUsedAt: null, expiresAt: new Date('2026-12-30T00:00:00Z'), consumedAt: null, revokedAt: null }],
    authChallenge: [{ id: 'ch1', userId: A, codeHash: 'CODE-HASH-VALUE' }]
  };
  const matches = (row, where = {}) => Object.entries(where).every(([k, v]) => k === 'session' ? rows.chatSession.some(s => s.id === row.sessionId && s.userId === v.userId) : row[k] === v);
  const project = (row, select) => Object.fromEntries(Object.keys(select).map(k => [k, row[k] ?? null]));
  const model = name => ({
    findUnique: async ({ where, select }) => { calls.push({ name, where }); const r = rows[name].find(x => matches(x, where)); return r ? project(r, select) : null; },
    findMany: async ({ where, select }) => { calls.push({ name, where, select }); return rows[name].filter(x => matches(x, where)).map(x => project(x, select)); }
  });
  const db = Object.fromEntries(Object.keys(rows).map(n => [n, model(n)]));
  db.$transaction = async (fn, opts) => { calls.push({ name: '$transaction', opts }); return fn(db); };
  return { db, calls, rows };
}

function appFor(db, userId = A, opts = {}) {
  const app = express(); const events = [];
  app.use(express.json());
  app.use((req, _res, next) => { req.userId = userId; req.id = '00000000-0000-4000-8000-000000000000'; next(); });
  app.use('/api/me/export', createExportRouter({ db, passwords, log: { info: e => events.push(e) }, clock: () => new Date('2026-11-26T08:00:00Z'), ...opts }));
  return { app, events };
}

const allKeys = (v, out = []) => { if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { if (!Array.isArray(v)) out.push(k); allKeys(x, out); } return out; };

test('successful export: headers, filename, sections and readme', async () => {
  const { db } = fakeDb(); const { app, events } = appFor(db);
  const r = await request(app).post('/api/me/export').send({ password: PASSWORD });
  assert.equal(r.status, 200);
  assert.equal(r.headers['cache-control'], 'no-store');
  assert.match(r.headers['content-type'], /^application\/json/);
  assert.equal(r.headers['content-disposition'], 'attachment; filename="mindhaven-export-2026-11-26.json"');
  const doc = JSON.parse(r.text);
  assert.equal(doc.format, 'mindhaven-export'); assert.equal(doc.formatVersion, 1);
  for (const s of ['profile', 'preferences', 'consentHistory', 'moodCheckins', 'journals', 'generatedJournals', 'chat', 'emotionAnalyses', 'activitySessions', 'emergencyContact', 'alerts']) {
    assert.ok(Object.hasOwn(doc, s), s); assert.equal(typeof doc.readme.sections[s], 'string', `readme for ${s}`);
  }
  assert.deepEqual(Object.keys(doc.readme.sections).sort(), Object.keys(README.sections).sort());
  assert.deepEqual(doc.profile, { name: 'Synthetic A', email: 'a@example.invalid', createdAt: at.toISOString() });
  assert.equal(doc.chat.sessions[0].messages.length, 1);
  assert.equal(doc.generatedJournals.dailySummaries[0].dailyJournal, 'Generated journal');
  assert.equal(doc.activitySessions[0].feedback.helpfulness, 'better');
  assert.equal(doc.emergencyContact.notifyEnabled, true);
  assert.deepEqual(doc.alerts.alertLogs, [{ createdAt: at.toISOString(), alertType: 'emergency_dispatch', outcome: 'accepted', alertSent: true }]);
  assert.deepEqual(doc.alerts.safetyAlerts, [{ createdAt: at.toISOString(), alertSent: false, alertSentAt: null }]);
  assert.deepEqual(events.map(e => e.event), ['data export completed']);
  assert.ok(events.every(e => Object.keys(e).every(k => ['event', 'route', 'requestId', 'code'].includes(k))));
});

test('ownership: every query is scoped to the requester and other users never appear', async () => {
  const { db, calls } = fakeDb(); const { app } = appFor(db);
  const r = await request(app).post('/api/me/export').send({ password: PASSWORD });
  assert.equal(r.status, 200);
  for (const c of calls.filter(c => c.name !== '$transaction')) {
    const scoped = c.name === 'user' ? c.where.id === A : c.where.userId === A;
    assert.ok(scoped, `${c.name} query not owner-scoped`);
    if (c.name === 'message') assert.deepEqual(c.where.session, { userId: A });
  }
  assert.ok(!calls.some(c => c.name === 'authChallenge'), 'challenge codes must never be read');
  for (const c of calls.filter(c => c.name === 'authSession'))
    for (const secret of ['tokenHash', 'replayCiphertext', 'replayExpiresAt', 'replacedById']) assert.ok(!c.select[secret], `authSession select includes ${secret}`);
  for (const secret of ['B-PRIVATE', 'b@example.invalid', B, 'Synthetic B', 'Asia/Kolkata']) assert.ok(!r.text.includes(secret), `leaked ${secret}`);
  assert.equal(calls.find(c => c.name === '$transaction').opts.isolationLevel, 'RepeatableRead');
});

test('crafted requests: extra fields or query parameters are rejected, never used', async () => {
  const { db, calls } = fakeDb(); const { app } = appFor(db);
  for (const body of [{ password: PASSWORD, userId: B }, { password: PASSWORD, user_id: B }, [PASSWORD]]) {
    const r = await request(app).post('/api/me/export').send(body);
    assert.equal(r.status, 400); assert.equal(r.body.error.code, 'INVALID_REQUEST');
  }
  const q = await request(app).post('/api/me/export').query({ userId: B }).send({ password: PASSWORD });
  assert.equal(q.status, 400);
  assert.equal(calls.length, 0, 'no DB access on rejected requests');
  // B's own password cannot export A's data, and A's token with B's password fails.
  const w = await request(app).post('/api/me/export').send({ password: 'other-user-password-123' });
  assert.equal(w.status, 401);
});

test('excluded fields never appear (key search over the whole document)', async () => {
  const { db } = fakeDb(); const { app } = appFor(db);
  const r = await request(app).post('/api/me/export').send({ password: PASSWORD });
  const doc = JSON.parse(r.text);
  const keys = allKeys(doc).map(k => k.toLowerCase().replace(/[^a-z0-9]/g, ''));
  for (const banned of ['passwordhash', 'password', 'tokenhash', 'token', 'refreshtoken', 'accesstoken', 'codehash', 'replayciphertext', 'familyid', 'userid', 'apikey', 'secret', 'emergencycontactid', 'audiourl', 'messageexcerpt', 'messagetext', 'sessionid'])
    assert.ok(!keys.includes(banned), `key ${banned} present`);
  assert.deepEqual(findForbiddenKeys(doc), []);
  for (const value of [HASH, OTHER_HASH, 'TOKEN-HASH-VALUE', 'CODE-HASH-VALUE', 'eyJabc.def.ghi', '/audio/secret.mp3', 'PRIVATE-EXCERPT', 'PRIVATE-TEXT', 'leak'])
    assert.ok(!r.text.includes(value), `value leaked: ${value}`);
  assert.deepEqual(doc.chat.sessions[0].messages[0].metadata, { model: 'x', nested: { ok: 1 } });
});

test('wrong, missing or malformed password returns the change-password generic error', async () => {
  const { db } = fakeDb(); const { app, events } = appFor(db);
  for (const body of [{ password: 'wrong-password-value' }, {}, { password: 42 }, { password: 'x'.repeat(200) }]) {
    const r = await request(app).post('/api/me/export').send(body);
    assert.equal(r.status, 401);
    assert.deepEqual(r.body, { success: false, error: 'Invalid credentials or session', code: 'UNAUTHENTICATED' });
    assert.equal(r.headers['content-disposition'], undefined);
  }
  assert.ok(events.every(e => e.event === 'data export denied' && e.code === 'UNAUTHENTICATED'));
});

test('account with no password hash or deleted account cannot export', async () => {
  const { db, rows } = fakeDb(); rows.user[0].passwordHash = null;
  assert.equal((await request(appFor(db).app).post('/api/me/export').send({ password: PASSWORD })).status, 401);
  assert.equal((await request(appFor(fakeDb().db, 'missing-user').app).post('/api/me/export').send({ password: PASSWORD })).status, 401);
});

test('rate limit: 3 successful exports per user per day; failures do not consume the quota', async () => {
  const { db } = fakeDb(); const { app, events } = appFor(db);
  assert.equal((await request(app).post('/api/me/export').send({ password: 'wrong-password-value' })).status, 401);
  for (let i = 0; i < 3; i++) assert.equal((await request(app).post('/api/me/export').send({ password: PASSWORD })).status, 200);
  const r = await request(app).post('/api/me/export').send({ password: PASSWORD });
  assert.equal(r.status, 429); assert.equal(r.body.error.code, 'RATE_LIMITED');
  assert.ok(Number(r.headers['retry-after']) > 3600, 'retry after roughly a day');
  assert.equal(events.at(-1).event, 'data export rate limited');
});

test('rate limit is keyed per user on one router', async () => {
  const { db } = fakeDb(); const router = createExportRouter({ db, passwords, log: { info() {} } });
  let who = A; const app = express(); app.use(express.json()); app.use((req, _r, n) => { req.userId = who; n(); }); app.use('/x', router);
  for (let i = 0; i < 3; i++) assert.equal((await request(app).post('/x').send({ password: PASSWORD })).status, 200);
  assert.equal((await request(app).post('/x').send({ password: PASSWORD })).status, 429);
  who = B;
  assert.equal((await request(app).post('/x').send({ password: 'other-user-password-123' })).status, 200);
});

test('repeated failures are limited to 5 per hour', async () => {
  const { db } = fakeDb(); const { app } = appFor(db);
  for (let i = 0; i < 5; i++) assert.equal((await request(app).post('/api/me/export').send({ password: 'wrong-password-value' })).status, 401);
  assert.equal((await request(app).post('/api/me/export').send({ password: PASSWORD })).status, 429);
});

test('size cap: oversized data returns 413 with a clear error, never a truncated file', async () => {
  const { db } = fakeDb({ bigNote: 4096 }); const { app, events } = appFor(db, A, { maxBytes: 2048 });
  const r = await request(app).post('/api/me/export').send({ password: PASSWORD });
  assert.equal(r.status, 413); assert.equal(r.body.error.code, 'EXPORT_TOO_LARGE');
  assert.match(r.body.error.message, /export limit/);
  assert.equal(r.headers['content-disposition'], undefined);
  assert.ok(!r.text.includes('xxxx'));
  assert.equal(events.at(-1).event, 'data export too large');
  // Just under the cap succeeds and the file is complete JSON.
  const ok = await buildUserExport(fakeDb().db, A, { maxBytes: 1024 * 1024 });
  assert.ok(ok.bytes <= 1024 * 1024); JSON.parse(ok.text);
});

test('account with no data exports empty sections', async () => {
  const { db } = fakeDb({ empty: true }); const { app } = appFor(db);
  const r = await request(app).post('/api/me/export').send({ password: PASSWORD });
  assert.equal(r.status, 200);
  const doc = JSON.parse(r.text);
  assert.equal(doc.preferences, null); assert.equal(doc.emergencyContact, null);
  for (const list of [doc.consentHistory, doc.moodCheckins, doc.journals, doc.chat.sessions, doc.emotionAnalyses, doc.activitySessions, doc.alerts.alertLogs, doc.alerts.safetyAlerts, doc.generatedJournals.dailySummaries]) assert.deepEqual(list, []);
  assert.equal(doc.profile.email, 'a@example.invalid');
});

test('database outage returns 503 without detail', async () => {
  const { db } = fakeDb(); db.$transaction = async () => { throw Object.assign(new Error('connection to secret-host failed'), { code: 'P1001' }); };
  const r = await request(appFor(db).app).post('/api/me/export').send({ password: PASSWORD });
  assert.equal(r.status, 503); assert.ok(!r.text.includes('secret-host')); assert.equal(r.headers['retry-after'], '5');
});

test('sanitizer helpers', () => {
  for (const k of ['passwordHash', 'password_hash', 'refreshToken', 'API_KEY', 'user_id', 'userId', 'sid', 'codeHash', 'Authorization', 'audio_url']) assert.ok(isForbiddenKey(k), k);
  for (const k of ['emotion', 'compassPoints', 'sessionTitle', 'noticeVersion', 'keyMoments', 'email', 'id']) assert.ok(!isForbiddenKey(k), k);
  assert.deepEqual(sanitizeJson({ a: [{ secret: 1, b: '$2b$12$' + 'a'.repeat(53) }], c: 'ok' }), { a: [{ b: '[removed]' }], c: 'ok' });
  assert.equal(exportFilename(new Date('2026-01-05T23:59:00Z')), 'mindhaven-export-2026-01-05.json');
});

test('privacy logger passes export audit events and strips anything else', async () => {
  const { default: safeLog } = await import('../src/utils/logger.js');
  const lines = []; const old = console.log; console.log = l => lines.push(l);
  try { safeLog.info({ event: 'data export completed', route: '/api/me/export', requestId: '00000000-0000-4000-8000-000000000000', email: 'a@example.invalid', userId: A, bytes: 10 }); }
  finally { console.log = old; }
  assert.deepEqual(JSON.parse(lines[0]), { level: 'info', event: 'data export completed', route: '/api/me/export', requestId: '00000000-0000-4000-8000-000000000000' });
});

test('missing password verifier fails closed with 503 and no data', async () => {
  const { db } = fakeDb();
  const app = express(); app.use(express.json()); app.use((req, _r, n) => { req.userId = A; n(); });
  app.use('/x', createExportRouter({ db, passwords: {}, log: { info() {} } }));
  const r = await request(app).post('/x').send({ password: PASSWORD });
  assert.equal(r.status, 503); assert.ok(!r.text.includes('a@example.invalid'));
});

test('activity log, recommendations and sign-in history are included without secrets', async () => {
  const { db } = fakeDb(); const { app } = appFor(db);
  const r = await request(app).post('/api/me/export').send({ password: PASSWORD });
  assert.equal(r.status, 200);
  const doc = JSON.parse(r.text);
  for (const s of ['activityLog', 'recommendations', 'loginSessions']) assert.equal(typeof doc.readme.sections[s], 'string', s);
  assert.deepEqual(doc.activityLog.map(x => x.content), ['A activity']);
  assert.equal(doc.activityLog[0].chatSessionId, 's1');
  assert.deepEqual(doc.activityLog[0].emotionData, { emotion: 'joy' });
  assert.deepEqual(doc.recommendations.map(x => x.rulesVersion), ['rules-v1']);
  assert.equal(doc.recommendations[0].items[0].reasonCode, 'calm');
  // Two rotations of one family collapse to one sign-in; the revoked older family is inactive.
  assert.equal(doc.loginSessions.length, 2);
  const [old, current] = doc.loginSessions;
  assert.deepEqual(old, { deviceLabel: 'Old laptop', startedAt: '2026-10-01T00:00:00.000Z', lastUsedAt: null, expiresAt: '2026-10-31T00:00:00.000Z', revokedAt: '2026-10-02T00:00:00.000Z', active: false });
  assert.deepEqual(current, { deviceLabel: 'Synthetic phone', startedAt: '2026-11-20T00:00:00.000Z', lastUsedAt: '2026-11-25T00:00:00.000Z', expiresAt: '2026-12-20T00:00:00.000Z', revokedAt: null, active: true });
  for (const v of ['FAMILY-ID', 'TOKEN-HASH', 'REPLAY-VALUE', 'B-PRIVATE-ACTIVITY', 'B-PRIVATE-RULES', 'B-PRIVATE-DEVICE']) assert.ok(!r.text.includes(v), `leaked ${v}`);
});
