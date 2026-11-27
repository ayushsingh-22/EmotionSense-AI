// Phase 2C-6 data export against the DEVELOPMENT Neon branch only (guarded).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import express from 'express';
import request from 'supertest';
import prisma from '../src/lib/prisma.js';
import { assertSafeTestDatabase } from './devDbGuard.js';
import { createAuthServices } from '../src/auth/index.js';
import { createFakeEmail } from '../src/auth/emailService.js';
import { createBackendAuthRouter } from '../src/routes/backendAuthRoutes.js';
import { createExportRouter } from '../src/routes/exportRoutes.js';
import { findForbiddenKeys } from '../src/wellbeing/dataExport.js';
import { cleanAndAssertNoLeftovers } from './syntheticCleanup.js';

const prefix = 'export-test-', suffix = '@example.invalid';
const PASSWORD = 'synthetic-export-password-a', PASSWORD_B = 'synthetic-export-password-b';
let ready = false, a, b, empty, tokenA, tokenB, tokenEmpty, contentId;
const services = createAuthServices({ prisma }); services.email = createFakeEmail();
const auth = createBackendAuthRouter({ prisma, services });
const appWith = opts => {
  const app = express(); app.use(express.json());
  app.use('/api/me/export', auth.auth, createExportRouter({ db: prisma, passwords: services.passwords, log: { info() {} }, ...opts }));
  return app;
};
const exportAs = (app, token, body) => request(app).post('/api/me/export').set('Authorization', `Bearer ${token}`).send(body);
const keysOf = (v, out = []) => { if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { if (!Array.isArray(v)) out.push(k.toLowerCase().replace(/[^a-z0-9]/g, '')); keysOf(x, out); } return out; };

async function seed(user, tag) {
  await prisma.userPreference.create({ data: { userId: user.id, timezone: tag === 'A' ? 'UTC' : 'Asia/Kolkata' } });
  await prisma.userConsent.create({ data: { userId: user.id, purpose: 'voice_processing', noticeVersion: 'voice-processing-v1', granted: true } });
  await prisma.moodCheckin.create({ data: { userId: user.id, moodLabel: 'calm', note: `${tag}-MOOD-NOTE` } });
  await prisma.journalEntry.create({ data: { userId: user.id, body: `${tag}-JOURNAL-BODY` } });
  await prisma.dailyEmotionSummary.create({ data: { userId: user.id, date: '2026-11-01', eJournalEntry: `${tag}-GENERATED-JOURNAL`, keyMoments: [{ text: `${tag}-moment`, token: 'MUST-NOT-EXPORT' }] } });
  await prisma.weeklyEmotionSummary.create({ data: { userId: user.id, weekStart: '2026-10-26', weekEnd: '2026-11-01', weeklySummaryText: `${tag}-WEEKLY` } });
  const session = await prisma.chatSession.create({ data: { userId: user.id, sessionTitle: `${tag}-CHAT` } });
  await prisma.message.create({ data: { userId: user.id, sessionId: session.id, role: 'user', content: `${tag}-MESSAGE`, metadata: { model: 'fixture', apiKey: 'MUST-NOT-EXPORT' }, audioUrl: '/audio/MUST-NOT-EXPORT.mp3' } });
  await prisma.emotionAnalysis.create({ data: { userId: user.id, type: 'text', inputText: `${tag}-ANALYSIS`, emotion: 'joy' } });
  // Both timestamps from ONE clock: started_at's DB default vs a JS completedAt can violate activity_sessions_completed_after_started under skew.
  const finished = new Date();
  const activity = await prisma.activitySession.create({ data: { userId: user.id, contentItemId: contentId, status: 'completed', startedAt: new Date(finished.getTime() - 60000), completedAt: finished } });
  await prisma.activityFeedback.create({ data: { activitySessionId: activity.id, helpfulness: 'better' } });
  await prisma.emergencyContact.create({ data: { userId: user.id, contactName: `${tag}-CONTACT`, contactEmail: `${tag.toLowerCase()}-contact${suffix}`, notifyEnabled: true } });
  await prisma.alertLog.create({ data: { userId: user.id, alertType: 'emergency_dispatch', contactEmail: `${tag.toLowerCase()}-contact${suffix}`, messageExcerpt: `${tag}-EXCERPT`, additionalData: { status: 'accepted', alertSent: true } } });
  await prisma.safetyAlert.create({ data: { userId: user.id, messageText: `${tag}-SAFETY-TEXT`, alertSent: false } });
  await prisma.masterUserActivity.create({ data: { userId: user.id, sessionId: session.id, activityType: 'chat_message', role: 'user', source: 'test', content: `${tag}-ACTIVITY-LOG`, emotionData: { emotion: 'joy', token: 'MUST-NOT-EXPORT' }, localDate: '2026-11-01' } });
  await prisma.recommendationRun.create({ data: { userId: user.id, rulesVersion: `${tag}-RULES`, items: { create: [{ contentItemId: contentId, position: 1, reasonCode: 'fixture' }] } } });
  return session;
}

before(async () => {
  await assertSafeTestDatabase(prisma); ready = true;
  await prisma.user.deleteMany({ where: { email: { startsWith: prefix, endsWith: suffix } } });
  a = await prisma.user.create({ data: { email: prefix + randomUUID() + suffix, fullName: 'Synthetic A', passwordHash: await services.passwords.hash(PASSWORD) } });
  b = await prisma.user.create({ data: { email: prefix + randomUUID() + suffix, fullName: 'Synthetic B', passwordHash: await services.passwords.hash(PASSWORD_B) } });
  empty = await prisma.user.create({ data: { email: prefix + randomUUID() + suffix, passwordHash: await services.passwords.hash(PASSWORD) } });
  contentId = randomUUID();
  await prisma.contentItem.create({ data: { id: contentId, title: 'Export fixture', contentType: 'breathing', language: 'en', status: 'published' } });
  await seed(a, 'A'); await seed(b, 'B');
  tokenA = (await services.sessions.create({ userId: a.id, deviceLabel: 'A-DEVICE' })).accessToken;
  tokenB = (await services.sessions.create({ userId: b.id, deviceLabel: 'B-DEVICE' })).accessToken;
  tokenEmpty = (await services.sessions.create({ userId: empty.id })).accessToken;
});

// Cleanup runs even if seeding failed halfway (node:test runs after() when before() throws).
// Users go first: their activity sessions and recommendation items Restrict-reference the content fixture.
after(async () => {
  try {
    if (ready) {
      const errors = [];
      for (const step of [
        () => cleanAndAssertNoLeftovers(prisma, [prefix], 'EXPORT'),
        () => contentId && prisma.recommendationItem.deleteMany({ where: { contentItemId: contentId } }),
        () => contentId && prisma.activitySession.deleteMany({ where: { contentItemId: contentId } }),
        () => contentId && prisma.contentItem.deleteMany({ where: { id: contentId } })
      ]) { try { await step(); } catch (e) { errors.push(e); } }
      const fixture = contentId ? await prisma.contentItem.count({ where: { id: contentId } }) : 0;
      console.log(`# EXPORT_FIXTURE_LEFTOVERS content=${fixture}`);
      assert.equal(fixture, 0);
      if (errors.length) throw errors[0];
    }
  } finally { await prisma.$disconnect(); }
});

test('export contains all of A\'s sections and nothing of B\'s', async () => {
  const r = await exportAs(appWith(), tokenA, { password: PASSWORD });
  assert.equal(r.status, 200);
  assert.equal(r.headers['cache-control'], 'no-store');
  assert.match(r.headers['content-disposition'], /^attachment; filename="mindhaven-export-\d{4}-\d{2}-\d{2}\.json"$/);
  const doc = JSON.parse(r.text);
  for (const marker of ['A-MOOD-NOTE', 'A-JOURNAL-BODY', 'A-GENERATED-JOURNAL', 'A-WEEKLY', 'A-CHAT', 'A-MESSAGE', 'A-ANALYSIS', 'A-CONTACT']) assert.ok(r.text.includes(marker), `missing ${marker}`);
  for (const leak of ['B-', b.id, b.email, 'Synthetic B', 'Asia/Kolkata', a.id]) assert.ok(!r.text.includes(leak), 'export contains another user\'s data or an internal user id');
  assert.equal(doc.profile.email, a.email);
  assert.equal(doc.consentHistory.length, 1);
  assert.equal(doc.chat.sessions.length, 1); assert.equal(doc.chat.sessions[0].messages.length, 1);
  assert.equal(doc.activitySessions[0].contentTitle, 'Export fixture');
  assert.equal(doc.activitySessions[0].feedback.helpfulness, 'better');
  assert.equal(doc.emergencyContact.notifyEnabled, true);
  assert.equal(doc.alerts.alertLogs[0].outcome, 'accepted');
  assert.equal(doc.alerts.safetyAlerts.length, 1);
  assert.deepEqual(doc.activityLog.map(x => x.content), ['A-ACTIVITY-LOG']);
  assert.deepEqual(doc.recommendations.map(x => x.rulesVersion), ['A-RULES']);
  assert.equal(doc.recommendations[0].items[0].contentItemId, contentId);
  assert.ok(doc.loginSessions.length >= 1 && doc.loginSessions.every(x => x.deviceLabel === 'A-DEVICE'));
  assert.ok(doc.loginSessions.some(x => x.active));
});

test('crafted cross-user requests never return another user\'s rows', async () => {
  // Plant a message that claims A as owner but sits in B's session: it must not be exported to either.
  const bSession = await prisma.chatSession.findFirst({ where: { userId: b.id } });
  const planted = await prisma.message.create({ data: { userId: a.id, sessionId: bSession.id, role: 'user', content: 'PLANTED-CROSS-SESSION' } });
  try {
    const app = appWith();
    for (const body of [{ password: PASSWORD, userId: b.id }, { password: PASSWORD_B }]) {
      const r = await exportAs(app, tokenA, body);
      assert.ok([400, 401].includes(r.status)); assert.ok(!r.text.includes('B-'));
    }
    const q = await request(app).post('/api/me/export').query({ userId: b.id }).set('Authorization', `Bearer ${tokenA}`).send({ password: PASSWORD });
    assert.equal(q.status, 400);
    const r = await exportAs(app, tokenA, { password: PASSWORD });
    assert.equal(r.status, 200); assert.ok(!r.text.includes('PLANTED-CROSS-SESSION')); assert.ok(!r.text.includes('B-'));
    const rb = await exportAs(app, tokenB, { password: PASSWORD_B });
    assert.equal(rb.status, 200); assert.ok(!rb.text.includes('PLANTED-CROSS-SESSION')); assert.ok(!rb.text.includes('A-'));
  } finally { await prisma.message.delete({ where: { id: planted.id } }); }
});

test('excluded fields never appear (key and value search)', async () => {
  const r = await exportAs(appWith(), tokenA, { password: PASSWORD });
  const doc = JSON.parse(r.text); const keys = keysOf(doc);
  for (const banned of ['passwordhash', 'password', 'tokenhash', 'token', 'refreshtoken', 'codehash', 'replayciphertext', 'familyid', 'userid', 'apikey', 'audiourl', 'emergencycontactid', 'messageexcerpt', 'messagetext'])
    assert.ok(!keys.includes(banned), `key ${banned} present`);
  assert.deepEqual(findForbiddenKeys(doc), []);
  const user = await prisma.user.findUnique({ where: { id: a.id }, select: { passwordHash: true } });
  const sessions = await prisma.authSession.findMany({ where: { userId: a.id }, select: { tokenHash: true, familyId: true } });
  for (const v of [user.passwordHash, tokenA, ...sessions.flatMap(s => [s.tokenHash, s.familyId]), 'MUST-NOT-EXPORT', 'A-EXCERPT', 'A-SAFETY-TEXT'])
    assert.ok(!r.text.includes(v), 'excluded value present');
});

test('wrong password returns the generic change-password error', async () => {
  const r = await exportAs(appWith(), tokenA, { password: 'definitely-wrong-password' });
  assert.equal(r.status, 401);
  assert.deepEqual(r.body, { success: false, error: 'Invalid credentials or session', code: 'UNAUTHENTICATED' });
  const unauth = await request(appWith()).post('/api/me/export').send({ password: PASSWORD });
  assert.equal(unauth.status, 401);
});

test('rate limit: fourth export in a day is refused', async () => {
  const app = appWith();
  for (let i = 0; i < 3; i++) assert.equal((await exportAs(app, tokenB, { password: PASSWORD_B })).status, 200);
  const r = await exportAs(app, tokenB, { password: PASSWORD_B });
  assert.equal(r.status, 429); assert.equal(r.body.error.code, 'RATE_LIMITED'); assert.ok(Number(r.headers['retry-after']) > 0);
});

test('size cap: data above the cap is refused with a clear error', async () => {
  const r = await exportAs(appWith({ maxBytes: 4096 }), tokenA, { password: PASSWORD });
  assert.equal(r.status, 413); assert.equal(r.body.error.code, 'EXPORT_TOO_LARGE'); assert.equal(r.headers['content-disposition'], undefined);
});

test('account with no data exports a valid, empty file', async () => {
  const r = await exportAs(appWith(), tokenEmpty, { password: PASSWORD });
  assert.equal(r.status, 200);
  const doc = JSON.parse(r.text);
  assert.equal(doc.preferences, null); assert.equal(doc.emergencyContact, null);
  for (const list of [doc.consentHistory, doc.moodCheckins, doc.journals, doc.chat.sessions, doc.emotionAnalyses, doc.activitySessions, doc.alerts.alertLogs, doc.alerts.safetyAlerts, doc.generatedJournals.dailySummaries, doc.generatedJournals.weeklySummaries]) assert.deepEqual(list, []);
});
