import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';

const digest = value => createHash('sha256').update(value).digest('hex');
const fresh = () => randomBytes(32).toString('base64url');

export function createSessionService({ prisma, tokens, replayKey, clock = () => new Date(), graceMs = 30000, familyMs = 30 * 86400000 }) {
  if (!prisma || !tokens || typeof replayKey !== 'string' || !/^[a-f0-9]{64}$/i.test(replayKey)) throw new Error('Invalid session service configuration');
  if (graceMs !== 30000 || familyMs <= 0 || familyMs > 30 * 86400000) throw new Error('Invalid session lifetime');
  const key = Buffer.from(replayKey, 'hex');
  const aad = (row, childId) => Buffer.from(JSON.stringify([row.userId, row.familyId, row.id, childId]));
  function seal(pair, row, childId) {
    const nonce = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', key, nonce);
    cipher.setAAD(aad(row, childId)); const data = Buffer.concat([cipher.update(JSON.stringify(pair), 'utf8'), cipher.final()]);
    return Buffer.concat([nonce, cipher.getAuthTag(), data]);
  }
  function unseal(buffer, row, childId) {
    const b = Buffer.from(buffer); if (b.length < 29) throw new Error('Invalid replay ciphertext');
    const decipher = createDecipheriv('aes-256-gcm', key, b.subarray(0, 12));
    decipher.setAAD(aad(row, childId)); decipher.setAuthTag(b.subarray(12, 28));
    return JSON.parse(Buffer.concat([decipher.update(b.subarray(28)), decipher.final()]).toString('utf8'));
  }
  // A family advisory lock serializes parent rotations, child use, and revocation.
  async function lockFamily(tx, familyId) {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${familyId}, 0))::text AS locked`;
  }
  async function lockUser(tx, userId) {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`auth-user:${userId}`}, 0))::text AS locked`;
  }
  async function lockRow(tx, id) {
    await tx.$queryRaw`SELECT id FROM auth_sessions WHERE id = ${id} FOR UPDATE`;
  }
  async function revokeFamily(tx, familyId, now) {
    await tx.authSession.updateMany({ where: { familyId }, data: { revokedAt: now, replayCiphertext: null, replayExpiresAt: null } });
  }
  async function issuePair(userId, id, refreshToken, expiry) {
    const access = await tokens.issue({ userId, sessionId: id });
    return { accessToken: access.token, accessExpiresAt: access.expiresAt.toISOString(), refreshToken, refreshExpiresAt: expiry.toISOString() };
  }
  return {
    async create({ userId, deviceLabel = null, expectedPasswordHash }) {
      if (typeof userId !== 'string' || !userId || (deviceLabel !== null && (typeof deviceLabel !== 'string' || deviceLabel.length > 100))) throw new Error('Invalid session input');
      const now = clock(), expiry = new Date(now.getTime() + familyMs), id = randomUUID(), familyId = randomUUID(), refreshToken = fresh();
      const pair = await issuePair(userId, id, refreshToken, expiry);
      const created = await prisma.$transaction(async tx => {
        await lockUser(tx, userId);
        if (expectedPasswordHash !== undefined) {
          const user = await tx.user.findUnique({ where: { id: userId }, select: { passwordHash: true, emailVerifiedAt: true } });
          if (!user?.emailVerifiedAt || user.passwordHash !== expectedPasswordHash) return false;
        }
        await tx.authSession.create({ data: { id, userId, familyId, tokenHash: digest(refreshToken), deviceLabel, createdAt: now, expiresAt: expiry } });
        return true;
      });
      return created ? pair : null;
    },
    async rotate(refreshToken) {
      if (typeof refreshToken !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(refreshToken)) return null;
      const hash = digest(refreshToken), hint = await prisma.authSession.findUnique({ where: { tokenHash: hash } });
      if (!hint) return null;
      const outcome = await prisma.$transaction(async tx => {
        await lockUser(tx, hint.userId); await lockFamily(tx, hint.familyId); await lockRow(tx, hint.id);
        const row = await tx.authSession.findUnique({ where: { tokenHash: hash } });
        const now = clock();
        if (!row || row.revokedAt || row.expiresAt <= now) return null;
        if (row.consumedAt) {
          if (row.replacedById) await lockRow(tx, row.replacedById);
          const child = row.replacedById ? await tx.authSession.findUnique({ where: { id: row.replacedById } }) : null;
          if (row.replayCiphertext && row.replayExpiresAt && now < row.replayExpiresAt && child &&
              !child.firstUsedAt && !child.consumedAt && !child.revokedAt && child.expiresAt > now) {
            try { return unseal(row.replayCiphertext, row, child.id); }
            catch { await revokeFamily(tx, row.familyId, now); return null; }
          }
          await revokeFamily(tx, row.familyId, now); return null;
        }
        await tx.authSession.updateMany({ where: { replacedById: row.id }, data: { replayCiphertext: null, replayExpiresAt: null } });
        const childId = randomUUID(), childToken = fresh();
        const pair = await issuePair(row.userId, childId, childToken, row.expiresAt);
        await tx.authSession.create({ data: { id: childId, userId: row.userId, familyId: row.familyId,
          tokenHash: digest(childToken), deviceLabel: row.deviceLabel, createdAt: now, expiresAt: row.expiresAt } });
        await tx.authSession.update({ where: { id: row.id }, data: { consumedAt: now, firstUsedAt: row.firstUsedAt ?? now, lastUsedAt: now,
          replacedById: childId, replayCiphertext: seal(pair, row, childId), replayExpiresAt: new Date(now.getTime() + graceMs) } });
        return pair;
      });
      return outcome;
    },
    async markUsed({ userId, sessionId }) {
      const hint = await prisma.authSession.findUnique({ where: { id: sessionId } });
      if (!hint || hint.userId !== userId) return false;
      return prisma.$transaction(async tx => {
        await lockUser(tx, hint.userId); await lockFamily(tx, hint.familyId); await lockRow(tx, sessionId); const row = await tx.authSession.findUnique({ where: { id: sessionId } }); const now = clock();
        if (!row || row.userId !== userId || row.revokedAt || row.consumedAt || row.expiresAt <= now) return false;
        await tx.authSession.update({ where: { id: sessionId }, data: { firstUsedAt: row.firstUsedAt ?? now, lastUsedAt: now } });
        await tx.authSession.updateMany({ where: { replacedById: sessionId }, data: { replayCiphertext: null, replayExpiresAt: null } });
        return true;
      });
    },
    async logout({ userId, sessionId }) {
      const hint = await prisma.authSession.findUnique({ where: { id: sessionId } });
      if (!hint || hint.userId !== userId) return false;
      return prisma.$transaction(async tx => {
        await lockUser(tx, hint.userId); await lockFamily(tx, hint.familyId); await lockRow(tx, sessionId);
        const row=await tx.authSession.findUnique({where:{id:sessionId}}), now=clock();
        if(!row || row.userId!==userId || row.revokedAt || row.expiresAt<=now) return false;
        // Accept a rotated generation solely to revoke its entire still-live family.
        await revokeFamily(tx, hint.familyId, now); return true;
      });
    },
    async logoutAll(userId) {
      return prisma.$transaction(async tx => { await lockUser(tx, userId); return tx.authSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: clock(), replayCiphertext: null, replayExpiresAt: null } }); });
    },
    async cleanup() {
      return prisma.authSession.updateMany({ where: { replayExpiresAt: { lte: clock() } }, data: { replayCiphertext: null, replayExpiresAt: null } });
    }
  };
}
