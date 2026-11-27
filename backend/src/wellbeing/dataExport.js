// Phase 2C-6: builds a JSON copy of one user's own data.
//
// Every query below is constrained to the requesting user's id and uses an
// explicit `select`; nothing is spread from a full row. Free-form JSON columns
// are passed through `sanitizeJson`, and the finished document is scanned once
// more (`findForbiddenKeys`) so a projection mistake fails closed instead of
// leaking credentials.

export const EXPORT_FORMAT = 'mindhaven-export';
export const EXPORT_FORMAT_VERSION = 1;
// Hard cap on the downloaded file (UTF-8 bytes of the final JSON text).
export const EXPORT_MAX_BYTES = 20 * 1024 * 1024;
const PAGE_SIZE = 500;

export class ExportTooLargeError extends Error {
  constructor() { super('Export exceeds size cap'); this.name = 'ExportTooLargeError'; }
}
export class ExportIntegrityError extends Error {
  constructor() { super('Export failed integrity scan'); this.name = 'ExportIntegrityError'; }
}

// Keys are compared after lower-casing and removing separators, so
// `password_hash`, `passwordHash` and `Password-Hash` are all caught.
const FORBIDDEN_FRAGMENTS = ['password', 'passwd', 'secret', 'token', 'apikey', 'authorization', 'cookie', 'credential', 'codehash', 'replaycipher'];
const FORBIDDEN_EXACT = new Set(['userid', 'sid', 'otp', 'hash', 'jwt', 'bearer', 'familyid', 'emergencycontactid', 'audiourl', 'replacedbyid']);
const normalizeKey = key => String(key).toLowerCase().replace(/[^a-z0-9]/g, '');
export const isForbiddenKey = key => {
  const k = normalizeKey(key);
  return FORBIDDEN_EXACT.has(k) || FORBIDDEN_FRAGMENTS.some(f => k.includes(f));
};
// Values shaped like a bcrypt hash or a JWT are never exported, whatever key holds them.
const SECRET_VALUE = /^\$2[aby]\$\d\d\$|^eyJ[\w-]+\.[\w-]+\.[\w-]+$/;
const REMOVED = '[removed]';

/** Recursively copy a JSON value, dropping credential-like keys and values. */
export function sanitizeJson(value, depth = 0) {
  if (value === null || value === undefined) return value ?? null;
  if (depth > 20) return REMOVED;
  if (typeof value === 'string') return SECRET_VALUE.test(value) ? REMOVED : value;
  if (typeof value !== 'object') return value;
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(v => sanitizeJson(v, depth + 1));
  const out = {};
  for (const [key, v] of Object.entries(value)) if (!isForbiddenKey(key)) out[key] = sanitizeJson(v, depth + 1);
  return out;
}

/** Return every forbidden key path in a document (empty array means clean). */
export function findForbiddenKeys(value, path = '$', found = []) {
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    for (const [key, v] of Object.entries(value)) {
      const p = Array.isArray(value) ? `${path}[${key}]` : `${path}.${key}`;
      if (!Array.isArray(value) && isForbiddenKey(key)) found.push(p);
      findForbiddenKeys(v, p, found);
    }
  } else if (typeof value === 'string' && SECRET_VALUE.test(value)) found.push(path);
  return found;
}

// Running byte budget so a huge account is rejected before it is fully loaded.
function createBudget(maxBytes) {
  let bytes = 0;
  return {
    add(value) { bytes += Buffer.byteLength(JSON.stringify(value) ?? '', 'utf8') + 1; if (bytes > maxBytes) throw new ExportTooLargeError(); return value; },
    get bytes() { return bytes; }
  };
}

// Keyset pagination by id; `select` must include `id`.
async function collect(model, { where, select, orderBy }, budget, map = r => r) {
  const out = [];
  let cursor;
  for (;;) {
    const rows = await model.findMany({ where, select, orderBy, take: PAGE_SIZE, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
    for (const row of rows) out.push(budget.add(map(row)));
    if (rows.length < PAGE_SIZE) return out;
    cursor = rows[rows.length - 1].id;
  }
}

const ALERT_OUTCOMES = new Set(['dispatching', 'accepted', 'withdrawn_or_disabled', 'failed']);
const alertOutcome = data => (data && typeof data === 'object' && ALERT_OUTCOMES.has(data.status)) ? data.status : null;

export const README = Object.freeze({
  about: 'This file is a copy of the personal data MindHaven stores for your account, created when you asked for it. All times are ISO-8601 in UTC. Empty lists mean nothing is stored for that section.',
  sections: {
    profile: 'Your name, email address and the date your account was created.',
    preferences: 'Your saved wellbeing preferences (language, timezone, activity types, support modes, accessibility). null means you never changed the defaults.',
    consentHistory: 'Every consent choice you recorded, oldest first: what it was for, whether you granted or withdrew it, which notice version you saw, and when.',
    moodCheckins: 'Your mood check-ins: mood, optional scores and note, and when you saved them.',
    journals: 'Journal entries you wrote yourself.',
    generatedJournals: 'Content MindHaven generated from your activity: daily summaries (including the automatic daily journal text), weekly summaries and daily emotion-flow segments.',
    chat: 'Your conversations: each chat session with its messages (yours and the assistant\'s), detected emotion and message metadata.',
    emotionAnalyses: 'Results of text and voice emotion analyses you ran, including the text or transcript that was analysed. Audio recordings are not stored and are not included.',
    activitySessions: 'Guided activities you started, their status and timing, which catalog item they were (id and title), and any feedback you gave afterwards.',
    emergencyContact: 'The emergency contact you entered and whether alerts to them are switched on (notifyEnabled). null means no contact is saved.',
    alerts: 'Records of emergency alerts: only when they happened and their outcome. Message excerpts and the contact\'s address are not repeated here.',
    activityLog: 'MindHaven\'s running log of your activity (chat messages, analyses and similar events) with the emotion data recorded for each, oldest first. It overlaps with the chat and emotion analysis sections.',
    recommendations: 'Activity recommendations MindHaven produced for you, with the catalog items suggested, their order and reason codes, and whether you picked one.',
    loginSessions: 'Your sign-in history: one entry per sign-in, with the device label (if any), when it started, was last used and expires, and whether it is still active or was signed out.'
  },
  notIncluded: 'For your security this file never contains your password or its stored hash, sign-in tokens or refresh tokens (only the sign-in history above), verification or reset codes, server keys, or any other person\'s account data. Copies that third-party AI, speech or email providers may have processed are held by those providers and are not part of this file.'
});

/**
 * Build the export for `userId`. Reads run inside one repeatable-read
 * transaction so the sections form a consistent snapshot.
 * Throws ExportTooLargeError when the result would exceed `maxBytes`.
 */
export async function buildUserExport(db, userId, { maxBytes = EXPORT_MAX_BYTES, now = new Date() } = {}) {
  if (typeof userId !== 'string' || !userId) throw new Error('userId required');
  const budget = createBudget(maxBytes);
  const own = { userId };
  const document = await db.$transaction(async tx => {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { fullName: true, email: true, createdAt: true } });
    if (!user) return null;
    const profile = budget.add({ name: user.fullName ?? null, email: user.email, createdAt: user.createdAt });

    const pref = await tx.userPreference.findUnique({ where: own, select: { preferredLanguage: true, timezone: true, preferredActivityTypes: true, preferredSupportModes: true, accessibilityPreferences: true, updatedAt: true } });
    const preferences = budget.add(pref ? {
      language: pref.preferredLanguage, timezone: pref.timezone,
      activityTypes: pref.preferredActivityTypes ?? [], supportModes: pref.preferredSupportModes ?? [],
      accessibility: sanitizeJson(pref.accessibilityPreferences ?? {}), updatedAt: pref.updatedAt
    } : null);

    const consentHistory = await collect(tx.userConsent, {
      where: own, select: { id: true, purpose: true, granted: true, noticeVersion: true, source: true, recordedAt: true },
      orderBy: [{ recordedAt: 'asc' }, { id: 'asc' }]
    }, budget, ({ id, ...r }) => r);

    const moodCheckins = await collect(tx.moodCheckin, {
      where: own, select: { id: true, moodLabel: true, moodScore: true, energyScore: true, note: true, createdAt: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }]
    }, budget);

    const journals = await collect(tx.journalEntry, {
      where: own, select: { id: true, title: true, body: true, origin: true, createdAt: true, updatedAt: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }]
    }, budget);

    const json = ['emotionDistribution', 'timeSegments', 'trendPoints', 'compassPoints', 'emotionFlow', 'segmentSummary', 'keyMoments'];
    const dailySummaries = await collect(tx.dailyEmotionSummary, {
      where: own,
      select: { id: true, date: true, dominantEmotion: true, moodScore: true, totalEntries: true, summaryText: true, eJournalEntry: true, createdAt: true, updatedAt: true, ...Object.fromEntries(json.map(k => [k, true])) },
      orderBy: [{ date: 'asc' }, { id: 'asc' }]
    }, budget, ({ eJournalEntry, ...r }) => {
      const out = { ...r, dailyJournal: eJournalEntry ?? null };
      for (const k of json) out[k] = sanitizeJson(r[k]);
      return out;
    });
    const weeklyJson = ['weeklyArc', 'keyHighlights', 'weeklyMomentFlow'];
    const weeklySummaries = await collect(tx.weeklyEmotionSummary, {
      where: own,
      select: { id: true, weekStart: true, weekEnd: true, dominantEmotion: true, averageMoodScore: true, weeklyReflection: true, weeklySummaryText: true, createdAt: true, updatedAt: true, ...Object.fromEntries(weeklyJson.map(k => [k, true])) },
      orderBy: [{ weekStart: 'asc' }, { id: 'asc' }]
    }, budget, r => { const out = { ...r }; for (const k of weeklyJson) out[k] = sanitizeJson(r[k]); return out; });
    const emotionFlowSegments = await collect(tx.emotionFlowSegment, {
      where: own, select: { id: true, date: true, segment: true, dominantEmotion: true, intensity: true, summary: true },
      orderBy: [{ date: 'asc' }, { id: 'asc' }]
    }, budget);

    const sessions = await collect(tx.chatSession, {
      where: own, select: { id: true, sessionTitle: true, createdAt: true, updatedAt: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }]
    }, budget, r => ({ id: r.id, title: r.sessionTitle, createdAt: r.createdAt, updatedAt: r.updatedAt, messages: [] }));
    const byId = new Map(sessions.map(s => [s.id, s]));
    // Both the message and its session must belong to the requester.
    await collect(tx.message, {
      where: { userId, session: { userId } },
      select: { id: true, sessionId: true, role: true, content: true, emotion: true, emotionConfidence: true, metadata: true, createdAt: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }]
    }, budget, ({ sessionId, metadata, ...r }) => {
      const m = { ...r, metadata: sanitizeJson(metadata) };
      byId.get(sessionId)?.messages.push(m);
      return m;
    });

    const emotionAnalyses = await collect(tx.emotionAnalysis, {
      where: own,
      select: { id: true, type: true, inputText: true, transcript: true, emotion: true, confidence: true, scores: true, audioFeatures: true, timestamp: true, createdAt: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }]
    }, budget, r => ({ ...r, scores: sanitizeJson(r.scores), audioFeatures: sanitizeJson(r.audioFeatures) }));

    const activitySessions = await collect(tx.activitySession, {
      where: own,
      select: { id: true, contentItemId: true, status: true, startedAt: true, completedAt: true,
        contentItem: { select: { title: true, contentType: true } },
        feedback: { select: { helpfulness: true, beforeMoodScore: true, afterMoodScore: true, submittedAt: true } } },
      orderBy: [{ startedAt: 'asc' }, { id: 'asc' }]
    }, budget, ({ contentItem, feedback, ...r }) => ({ ...r, contentTitle: contentItem?.title ?? null, contentType: contentItem?.contentType ?? null, feedback: feedback ?? null }));

    const contact = await tx.emergencyContact.findUnique({ where: own, select: { contactName: true, contactEmail: true, contactPhone: true, notifyEnabled: true, createdAt: true, updatedAt: true } });
    const emergencyContact = budget.add(contact ? { name: contact.contactName, email: contact.contactEmail, phone: contact.contactPhone ?? null, notifyEnabled: contact.notifyEnabled, createdAt: contact.createdAt, updatedAt: contact.updatedAt } : null);

    const alertLogs = await collect(tx.alertLog, {
      where: own, select: { id: true, alertType: true, additionalData: true, createdAt: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }]
    }, budget, r => ({ createdAt: r.createdAt, alertType: r.alertType, outcome: alertOutcome(r.additionalData), alertSent: typeof r.additionalData?.alertSent === 'boolean' ? r.additionalData.alertSent : null }));
    const safetyAlerts = await collect(tx.safetyAlert, {
      where: own, select: { id: true, alertSent: true, alertSentAt: true, createdAt: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }]
    }, budget, r => ({ createdAt: r.createdAt, alertSent: r.alertSent, alertSentAt: r.alertSentAt }));

    const activityLog = await collect(tx.masterUserActivity, {
      where: own,
      select: { id: true, sessionId: true, activityType: true, role: true, source: true, content: true, emotionData: true, metadata: true, localDate: true, createdAt: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }]
    }, budget, ({ sessionId, emotionData, metadata, ...r }) => ({ ...r, chatSessionId: sessionId ?? null, emotionData: sanitizeJson(emotionData), metadata: sanitizeJson(metadata) }));

    const recommendations = await collect(tx.recommendationRun, {
      where: own,
      select: { id: true, moodCheckinId: true, rulesVersion: true, contextCode: true, createdAt: true,
        items: { select: { contentItemId: true, position: true, score: true, reasonCode: true, selectedAt: true }, orderBy: { position: 'asc' } } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }]
    }, budget);

    // Sign-in history: one entry per login (refresh-token family). Only
    // non-secret metadata is read; token hashes and replay data never are.
    const families = new Map();
    await collect(tx.authSession, {
      where: own, select: { id: true, familyId: true, deviceLabel: true, createdAt: true, lastUsedAt: true, expiresAt: true, consumedAt: true, revokedAt: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }]
    }, { add: v => v }, row => {
      const f = families.get(row.familyId) ?? { deviceLabel: null, startedAt: row.createdAt, lastUsedAt: null, expiresAt: row.expiresAt, revokedAt: null, active: false };
      f.deviceLabel ??= row.deviceLabel ?? null;
      if (row.createdAt < f.startedAt) f.startedAt = row.createdAt;
      if (row.lastUsedAt && (!f.lastUsedAt || row.lastUsedAt > f.lastUsedAt)) f.lastUsedAt = row.lastUsedAt;
      if (row.expiresAt > f.expiresAt) f.expiresAt = row.expiresAt;
      if (row.revokedAt && (!f.revokedAt || row.revokedAt > f.revokedAt)) f.revokedAt = row.revokedAt;
      if (!row.revokedAt && !row.consumedAt && row.expiresAt > now) f.active = true;
      families.set(row.familyId, f);
      return null;
    });
    const loginSessions = [...families.values()].sort((x, y) => x.startedAt - y.startedAt).map(f => budget.add({ ...f, revokedAt: f.active ? null : f.revokedAt }));

    return {
      format: EXPORT_FORMAT, formatVersion: EXPORT_FORMAT_VERSION, generatedAt: now, readme: README,
      profile, preferences, consentHistory, moodCheckins, journals,
      generatedJournals: { dailySummaries, weeklySummaries, emotionFlowSegments },
      chat: { sessions }, emotionAnalyses, activitySessions, emergencyContact,
      alerts: { alertLogs, safetyAlerts }, activityLog, recommendations, loginSessions
    };
  }, { isolationLevel: 'RepeatableRead', maxWait: 10000, timeout: 60000 });

  if (!document) return null;
  if (findForbiddenKeys(document).length) throw new ExportIntegrityError();
  const text = JSON.stringify(document, null, 2);
  const bytes = Buffer.byteLength(text, 'utf8');
  if (bytes > maxBytes) throw new ExportTooLargeError();
  return { text, bytes, document };
}

export const exportFilename = (date = new Date()) => `mindhaven-export-${date.toISOString().slice(0, 10)}.json`;
