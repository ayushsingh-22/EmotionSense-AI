/**
 * In-memory stand-in for PostgreSQL used by the account-linking tests (no database, no network).
 *
 * Models exactly the guarantees the real SQL in src/identity/linkStore.js relies on:
 *  - a database clock (nowMs) used for created_at / expires_at / consumed_at and liveness;
 *  - CHECK auth_link_challenges_lifetime (<= 5 min) and _consumed_in_window, CHECK on link_method;
 *  - UNIQUE (provider, provider_project, provider_sub) on auth_identities and UNIQUE challenge_hash;
 *  - transactions that are serialised (like row locks on the same rows) and fully rolled back when fn throws;
 *  - the conditional consume (consumed_at IS NULL AND expires_at > now()) evaluated inside the transaction;
 *  - ON DELETE CASCADE from users to identities and challenges.
 * It also implements the small Prisma surface used by resolveFirebaseIdentity (the exchange), over the SAME state.
 * Fault hooks let tests force a failure after the identity insert (rollback) or after COMMIT (ambiguous outcome).
 */
import { randomUUID } from 'node:crypto';

const tick = () => new Promise((r) => setImmediate(r));
const uniqueError = () => Object.assign(
  new Error('Raw query failed. Code: `23505`. Message: `duplicate key value violates unique constraint "auth_identities_provider_project_sub_key"`'),
  { code: 'P2010' }
);

export class FakeLinkDb {
  constructor({ nowMs = Date.UTC(2026, 9, 18, 12, 0, 0) } = {}) {
    this.nowMs = nowMs;
    this.state = { users: [], identities: [], challenges: [] };
    this.faults = {};
    this.txCount = 0;
    this.chain = Promise.resolve();
  }

  now() { return new Date(this.nowMs); }
  advance(seconds) { this.nowMs += seconds * 1000; }

  addUser({ id = randomUUID(), email, passwordHash = null, fullName = null, avatarUrl = null, emailVerifiedAt = null }) {
    const u = { id, email, passwordHash, fullName, avatarUrl, emailVerifiedAt, createdAt: this.now(), updatedAt: this.now() };
    this.state.users.push(u);
    return u;
  }
  deleteUser(id) {
    this.state.users = this.state.users.filter((u) => u.id !== id);
    this.state.identities = this.state.identities.filter((i) => i.userId !== id);
    this.state.challenges = this.state.challenges.filter((c) => c.userId !== id);
  }
  addIdentity({ userId, project, sub, disabledAt = null, linkMethod = 'created' }) {
    this.#insertIdentity({ userId, provider: 'firebase', providerProject: project, providerSub: sub, signInMethod: 'google.com', emailAtLink: null, emailVerified: true, linkMethod, disabledAt });
  }
  snapshot() { return structuredClone(this.state); }

  #insertIdentity(row) {
    if (!['created', 'password_proof', 'email_link', 'admin'].includes(row.linkMethod)) throw new Error('check violation: link_method');
    if (!this.state.users.some((u) => u.id === row.userId)) throw new Error('foreign key violation');
    if (this.state.identities.some((i) => i.provider === row.provider && i.providerProject === row.providerProject && i.providerSub === row.providerSub)) throw uniqueError();
    const t = this.now();
    const identity = { id: randomUUID(), createdAt: t, updatedAt: t, lastLoginAt: null, disabledAt: null, ...row };
    this.state.identities.push(identity);
    return identity;
  }
  #identity(project, sub) {
    return this.state.identities.find((i) => i.provider === 'firebase' && i.providerProject === project && i.providerSub === sub) ?? null;
  }

  /** Serialised, all-or-nothing transaction. */
  #transaction(fn) {
    const run = async () => {
      this.txCount += 1;
      const before = structuredClone(this.state);
      try {
        const result = await fn();
        if (this.faults.afterCommit) { const e = this.faults.afterCommit; this.faults.afterCommit = null; throw Object.assign(e, { committed: true }); }
        return result;
      } catch (error) {
        if (!error.committed) this.state = before; // rollback
        throw error;
      }
    };
    const p = this.chain.then(run, run);
    this.chain = p.catch(() => {});
    return p;
  }

  /* ----------------------------- link store API ----------------------------- */
  store() {
    const db = this;
    const findIdentity = async ({ project, sub }) => {
      await tick();
      const i = db.#identity(project, sub);
      return i ? { id: i.id, userId: i.userId, disabledAt: i.disabledAt } : null;
    };
    const txApi = {
      async consumeChallenge({ challengeHash, project, sub }) {
        await tick();
        const c = db.state.challenges.find((x) => x.challengeHash === challengeHash && x.provider === 'firebase'
          && x.providerProject === project && x.providerSub === sub && x.purpose === 'link_firebase'
          && x.consumedAt === null && x.expiresAt.getTime() > db.nowMs);
        if (!c) return null;
        c.consumedAt = db.now();
        if (c.consumedAt < c.createdAt || c.consumedAt > c.expiresAt) throw new Error('check violation: consumed_in_window');
        return { userId: c.userId, credentialFingerprint: c.credentialFingerprint };
      },
      async lockUser(userId) {
        await tick();
        const u = db.state.users.find((x) => x.id === userId);
        return u ? { id: u.id, email: u.email, passwordHash: u.passwordHash, fullName: u.fullName, avatarUrl: u.avatarUrl } : null;
      },
      findIdentity,
      async insertIdentity({ userId, project, sub, signInMethod, emailAtLink }) {
        await tick();
        if (db.faults.beforeInsertIdentity) { const f = db.faults.beforeInsertIdentity; db.faults.beforeInsertIdentity = null; f(); }
        const i = db.#insertIdentity({ userId, provider: 'firebase', providerProject: project, providerSub: sub, signInMethod, emailAtLink, emailVerified: true, linkMethod: 'password_proof' });
        i.lastLoginAt = db.now();
        if (db.faults.afterInsertIdentity) { const e = db.faults.afterInsertIdentity; db.faults.afterInsertIdentity = null; throw e; }
      }
    };
    return {
      findIdentity,
      async findUserByEmail(email) {
        await tick();
        const hits = db.state.users.filter((u) => u.email.toLowerCase() === email);
        return hits.length === 1 ? { id: hits[0].id, email: hits[0].email, passwordHash: hits[0].passwordHash } : null;
      },
      async findUserById(id) {
        await tick();
        const u = db.state.users.find((x) => x.id === id);
        return u ? { id: u.id, email: u.email, fullName: u.fullName, avatarUrl: u.avatarUrl } : null;
      },
      createChallenge({ challengeHash, userId, project, sub, credentialFingerprint, ttlSeconds }) {
        return db.#transaction(async () => {
          await tick();
          if (!(ttlSeconds > 0 && ttlSeconds <= 300)) throw new Error('check violation: lifetime');
          if (!/^[0-9a-f]{64}$/.test(challengeHash) || !/^[0-9a-f]{64}$/.test(credentialFingerprint)) throw new Error('check violation: digest format');
          if (!db.state.users.some((u) => u.id === userId)) throw new Error('foreign key violation');
          db.state.challenges = db.state.challenges.filter((c) => !(c.providerProject === project && c.providerSub === sub && c.consumedAt === null));
          if (db.state.challenges.some((c) => c.challengeHash === challengeHash)) throw new Error('duplicate challenge_hash');
          const t = db.now();
          const expiresAt = new Date(db.nowMs + ttlSeconds * 1000);
          db.state.challenges.push({ id: randomUUID(), challengeHash, userId, provider: 'firebase', providerProject: project, providerSub: sub, purpose: 'link_firebase', credentialFingerprint, createdAt: t, expiresAt, consumedAt: null });
          return { expiresAt };
        });
      },
      async findChallenge(challengeHash) {
        await tick();
        const c = db.state.challenges.find((x) => x.challengeHash === challengeHash);
        return c ? { userId: c.userId, provider: c.provider, providerProject: c.providerProject, providerSub: c.providerSub, purpose: c.purpose, consumed: c.consumedAt !== null, live: c.expiresAt.getTime() > db.nowMs } : null;
      },
      transaction: (fn) => db.#transaction(() => fn(txApi))
    };
  }

  /* -------------- Prisma surface used by resolveFirebaseIdentity (exchange) -------------- */
  prisma() {
    const db = this;
    const pick = (u) => ({ id: u.id, email: u.email, fullName: u.fullName, avatarUrl: u.avatarUrl });
    const tx = {
      user: {
        findFirst: async ({ where }) => db.state.users.find((u) => u.email.toLowerCase() === where.email.equals.toLowerCase()) ?? null,
        create: async ({ data }) => {
          if (db.state.users.some((u) => u.email.toLowerCase() === data.email.toLowerCase())) throw Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
          return pick(db.addUser(data));
        }
      },
      authIdentity: {
        create: async ({ data }) => { try { db.#insertIdentity({ disabledAt: null, ...data }); } catch (e) { if (/duplicate/.test(e.message)) throw Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }); throw e; } }
      }
    };
    return {
      authIdentity: {
        findUnique: async ({ where }) => {
          const k = where.provider_providerProject_providerSub;
          const i = db.state.identities.find((x) => x.provider === k.provider && x.providerProject === k.providerProject && x.providerSub === k.providerSub);
          if (!i) return null;
          const u = db.state.users.find((x) => x.id === i.userId);
          return { id: i.id, disabledAt: i.disabledAt, lastLoginAt: i.lastLoginAt, user: pick(u) };
        },
        update: async ({ where, data }) => { const i = db.state.identities.find((x) => x.id === where.id); Object.assign(i, data); }
      },
      $transaction: (fn) => db.#transaction(() => fn(tx))
    };
  }
}
