import { createHmac, randomInt, timingSafeEqual, randomUUID } from 'node:crypto';

export function createChallengeService({ prisma, secret, clock = () => new Date(), ttlMs = 600000, maxAttempts = 5, cooldownMs = 60000, hourlyLimit = 5, transactionOptions = { maxWait: 10000, timeout: 15000 } }) {
  if (!prisma || typeof secret !== 'string' || Buffer.byteLength(secret) < 32) throw new Error('Invalid challenge configuration');
  if (ttlMs <= 0 || ttlMs > 600000 || maxAttempts !== 5 || cooldownMs < 60000 || hourlyLimit > 5 || hourlyLimit < 1) throw new Error('Invalid challenge policy');
  const purposes = new Set(['verify_email', 'reset_password']);
  function hash(userId, purpose, id, code) { return createHmac('sha256', secret).update(JSON.stringify([userId, purpose, id, code])).digest('hex'); }
  async function lock(tx, userId) { await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`auth-challenge:${userId}`}, 0))::text AS locked`; }
  function check(userId, purpose) { if (typeof userId !== 'string' || !userId || !purposes.has(purpose)) throw new Error('Invalid challenge input'); }
  return {
    async issue({ userId, purpose }) {
      check(userId, purpose);
      return prisma.$transaction(async tx => {
        await lock(tx, userId); const now = clock();
        const recent = await tx.authChallenge.findMany({ where: { userId, purpose, createdAt: { gte: new Date(now.getTime() - 3600000) } }, orderBy: { createdAt: 'desc' } });
        if (recent.length >= hourlyLimit || (recent[0] && now.getTime() - recent[0].createdAt.getTime() < cooldownMs)) return null;
        await tx.authChallenge.updateMany({ where: { userId, purpose, consumedAt: null, invalidatedAt: null }, data: { invalidatedAt: now } });
        // randomInt uses unbiased cryptographic random sampling.
        const code = String(randomInt(0, 1000000)).padStart(6, '0'), id = randomUUID();
        const expiresAt = new Date(now.getTime() + ttlMs);
        await tx.authChallenge.create({ data: { id, userId, purpose, codeHash: hash(userId, purpose, id, code), createdAt: now, expiresAt, lastSentAt: now, maxAttempts } });
        return { code, expiresAt };
      }, transactionOptions);
    },
    async consume({ userId, purpose, code }, onValid = async () => {}) {
      check(userId, purpose);
      return prisma.$transaction(async tx => {
        await lock(tx, userId); const now = clock();
        const row = await tx.authChallenge.findFirst({ where: { userId, purpose, consumedAt: null, invalidatedAt: null } });
        if (!row || row.expiresAt <= now || row.attemptCount >= row.maxAttempts) return false;
        const actual = Buffer.from(hash(userId, purpose, row.id, typeof code === 'string' ? code : ''), 'hex');
        const expected = Buffer.from(row.codeHash, 'hex');
        const digestMatches = timingSafeEqual(actual, expected.length === actual.length ? expected : Buffer.alloc(actual.length));
        const valid = typeof code === 'string' && /^\d{6}$/.test(code) && expected.length === actual.length && digestMatches;
        await tx.authChallenge.update({ where: { id: row.id }, data: valid ? { consumedAt: now } : { attemptCount: { increment: 1 } } });
        if (valid) await onValid(tx, now);
        return valid;
      }, transactionOptions);
    }
  };
}
