/**
 * Database access for account linking (auth_link_challenges + auth_identities). Phase 2B.5B.2.
 *
 *  - Parameterised tagged-template SQL only ($queryRaw / $executeRaw); no string concatenation.
 *  - Every timestamp comes from the DATABASE clock (now()): created_at, expires_at, consumed_at and the liveness test
 *    are all evaluated by PostgreSQL, so application clock skew can never violate the table's CHECK constraints
 *    (lifetime <= 5 minutes, consumed inside its window) or extend a challenge.
 *  - Single use is enforced by ONE conditional UPDATE (consumed_at IS NULL AND expires_at > now()) with RETURNING. Under
 *    READ COMMITTED a concurrent second UPDATE of the same row blocks on the row lock, re-evaluates the WHERE clause after
 *    the first commits, and matches 0 rows: exactly one caller can ever consume a challenge.
 *  - The target user row is read FOR SHARE inside the linking transaction, which blocks a concurrent password or e-mail
 *    change until the link commits (and vice versa) without conflicting with foreign-key KEY SHARE locks.
 *  - Identity uniqueness (provider, provider_project, provider_sub) is enforced by the existing unique index; a lost race
 *    surfaces as a unique-violation error that the service maps, it is never resolved by reassigning a mapping.
 *  - Never selects or returns more than the service needs; never logs.
 */
import { PROVIDER } from './identityService.js';

export const LINK_PURPOSE = 'link_firebase';
export const LINK_METHOD = 'password_proof';
export const MAX_CHALLENGE_TTL_SECONDS = 300; // also enforced by CHECK auth_link_challenges_lifetime
const TX_OPTIONS = { maxWait: 5000, timeout: 10000 };

const findIdentity = async (conn, { project, sub }) => {
  const rows = await conn.$queryRaw`
    SELECT id, user_id AS "userId", disabled_at AS "disabledAt"
    FROM auth_identities
    WHERE provider = ${PROVIDER} AND provider_project = ${project} AND provider_sub = ${sub}`;
  return rows[0] ?? null;
};

const txApi = (tx) => ({
  /** Atomically marks a live, unconsumed challenge of THIS Firebase identity as consumed. null = nothing consumed. */
  async consumeChallenge({ challengeHash, project, sub }) {
    const rows = await tx.$queryRaw`
      UPDATE auth_link_challenges
      SET consumed_at = now()
      WHERE challenge_hash = ${challengeHash}
        AND provider = ${PROVIDER} AND provider_project = ${project} AND provider_sub = ${sub}
        AND purpose = ${LINK_PURPOSE}
        AND consumed_at IS NULL
        AND expires_at > now()
      RETURNING user_id AS "userId", credential_fingerprint AS "credentialFingerprint"`;
    return rows[0] ?? null;
  },
  async lockUser(userId) {
    const rows = await tx.$queryRaw`
      SELECT id, email, password_hash AS "passwordHash", full_name AS "fullName", avatar_url AS "avatarUrl"
      FROM users WHERE id = ${userId}
      FOR SHARE`;
    return rows[0] ?? null;
  },
  findIdentity: (key) => findIdentity(tx, key),
  async insertIdentity({ userId, project, sub, signInMethod, emailAtLink }) {
    await tx.$executeRaw`
      INSERT INTO auth_identities
        (user_id, provider, provider_project, provider_sub, sign_in_method, email_at_link, email_verified, link_method, last_login_at)
      VALUES
        (${userId}, ${PROVIDER}, ${project}, ${sub}, ${signInMethod}, ${emailAtLink}, true, ${LINK_METHOD}, now())`;
  }
});

export const createLinkStore = (db) => ({
  findIdentity: (key) => findIdentity(db, key),

  /** Exactly one user whose e-mail matches case-insensitively (users_email_lower_key makes more than one impossible). */
  async findUserByEmail(normalizedEmail) {
    const rows = await db.$queryRaw`
      SELECT id, email, password_hash AS "passwordHash"
      FROM users WHERE lower(email) = ${normalizedEmail}
      LIMIT 2`;
    return rows.length === 1 ? rows[0] : null;
  },

  async findUserById(userId) {
    const rows = await db.$queryRaw`
      SELECT id, email, full_name AS "fullName", avatar_url AS "avatarUrl" FROM users WHERE id = ${userId}`;
    return rows[0] ?? null;
  },

  /**
   * Replaces any OPEN challenge of this Firebase identity with a new one (one live challenge per identity) and returns
   * the database-computed expiry. Consumed rows are kept as an audit trail.
   */
  async createChallenge({ challengeHash, userId, project, sub, credentialFingerprint, ttlSeconds }) {
    const ttl = Math.trunc(ttlSeconds);
    if (!(ttl > 0 && ttl <= MAX_CHALLENGE_TTL_SECONDS)) throw new Error('createChallenge: invalid lifetime');
    return db.$transaction(async (tx) => {
      await tx.$executeRaw`
        DELETE FROM auth_link_challenges
        WHERE provider = ${PROVIDER} AND provider_project = ${project} AND provider_sub = ${sub}
          AND consumed_at IS NULL`;
      const rows = await tx.$queryRaw`
        INSERT INTO auth_link_challenges
          (challenge_hash, user_id, provider, provider_project, provider_sub, purpose, credential_fingerprint, created_at, expires_at)
        VALUES
          (${challengeHash}, ${userId}, ${PROVIDER}, ${project}, ${sub}, ${LINK_PURPOSE}, ${credentialFingerprint},
           now(), now() + (${ttl}::int * interval '1 second'))
        RETURNING expires_at AS "expiresAt"`;
      return { expiresAt: rows[0].expiresAt };
    }, TX_OPTIONS);
  },

  /** Read-only pre-check (no lock). The authoritative check is consumeChallenge inside the transaction. */
  async findChallenge(challengeHash) {
    const rows = await db.$queryRaw`
      SELECT user_id AS "userId", provider, provider_project AS "providerProject", provider_sub AS "providerSub", purpose,
             (consumed_at IS NOT NULL) AS consumed, (expires_at > now()) AS live
      FROM auth_link_challenges WHERE challenge_hash = ${challengeHash}`;
    return rows[0] ?? null;
  },

  /** Runs fn(txApi) in one interactive transaction. fn must not call Firebase or any other network provider. */
  transaction: (fn) => db.$transaction((tx) => fn(txApi(tx)), TX_OPTIONS)
});
