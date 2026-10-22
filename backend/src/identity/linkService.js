/**
 * Secure linking of a verified Firebase identity (MindHaven) to an EXISTING MantraAI web account. Phase 2B.5B.2.
 *
 * Proof model (both identities, never e-mail alone):
 *   1. Firebase: a fresh Firebase ID token verified by the Admin SDK (pinned project, revocation checked) whose
 *      e-mail is verified, whose sign-in method is supported, and whose auth_time is recent.
 *   2. Web account: the CURRENT web password, verified server-side against users.password_hash (bcrypt).
 *   The target account is derived by the server from the caller's verified Firebase e-mail; the client never names a
 *   user, a Firebase UID or a project. Explicit consent is required at both steps (enforced by the route).
 *
 * Two steps:
 *   start    -> proofs ok -> 32-byte random challenge; only its SHA-256 digest is stored, bound to
 *               (users.id, firebase, project, uid) plus a fingerprint of the password hash; lifetime <= 5 minutes.
 *   complete -> fresh Firebase proof for the SAME identity + the challenge -> ONE transaction (no network calls):
 *               consume challenge (single use, live, same identity) -> lock target user -> password unchanged and e-mail
 *               still the verified one -> identity not mapped -> insert mapping (link_method 'password_proof').
 *               Any refusal rolls the whole transaction back.
 *
 * Never: links by e-mail alone, reassigns an existing mapping, creates a user, modifies users rows, merges or moves data.
 */
import { randomBytes, createHash } from 'node:crypto';
import { ALLOWED_SIGN_IN_PROVIDERS } from './firebaseVerifier.js';
import { PROVIDER, normalizeEmail, isPlausibleEmail, isUniqueViolation } from './identityService.js';
import { verifyPasswordProof, credentialFingerprint, sameFingerprint } from './passwordProof.js';
import { LINK_PURPOSE, MAX_CHALLENGE_TTL_SECONDS } from './linkStore.js';

export const CHALLENGE_TTL_SECONDS = MAX_CHALLENGE_TTL_SECONDS;
export const DEFAULT_MAX_AUTH_AGE_SECONDS = 600;
export const CHALLENGE_RE = /^[A-Za-z0-9_-]{43}$/; // base64url of 32 random bytes
const CLOCK_SKEW_SECONDS = 60;

/** Only the exact string 'true' enables linking. */
export const isLinkingEnabled = (env = process.env) => env.ACCOUNT_LINKING_ENABLED === 'true';

export const newChallenge = () => randomBytes(32).toString('base64url');
export const digestChallenge = (raw) => createHash('sha256').update(String(raw), 'utf8').digest('hex');

/** A refusal raised inside the linking transaction: rolls everything back and maps to a client status. */
class LinkRefusal extends Error {
  constructor(status) { super(`link refused: ${status}`); this.name = 'LinkRefusal'; this.status = status; }
}

const publicUser = (u) => ({ id: u.id, email: u.email, fullName: u.fullName ?? null, avatarUrl: u.avatarUrl ?? null });
const keyOf = (claims) => ({ project: claims.projectId, sub: claims.uid });

/**
 * Claim-level eligibility of a VERIFIED Firebase token for linking (no database access).
 * @returns {{status:'ok', email:string} | {status:'unsupported_method'|'email_not_verified'|'reauth_required'}}
 */
export const checkLinkClaims = (claims, { nowMs = Date.now(), maxAuthAgeSeconds = DEFAULT_MAX_AUTH_AGE_SECONDS } = {}) => {
  if (!claims?.uid || !claims?.projectId) throw new Error('checkLinkClaims: verified claims required');
  if (!ALLOWED_SIGN_IN_PROVIDERS.has(claims.signInProvider)) return { status: 'unsupported_method' };
  const email = normalizeEmail(claims.email);
  if (claims.emailVerified !== true || !email || !isPlausibleEmail(email)) return { status: 'email_not_verified' };
  const nowSec = Math.floor(nowMs / 1000);
  if (!Number.isSafeInteger(claims.authTime)) return { status: 'reauth_required' };
  const age = nowSec - claims.authTime;
  if (age > maxAuthAgeSeconds || age < -CLOCK_SKEW_SECONDS) return { status: 'reauth_required' };
  return { status: 'ok', email };
};

/**
 * Step 1. `email` is the normalised, verified Firebase e-mail returned by checkLinkClaims.
 * @returns {{status:'ok', challenge:string, expiresAt:Date} | {status:'disabled'|'already_linked'|'proof_failed'}}
 */
export const startLink = async (store, claims, email, password) => {
  const key = keyOf(claims);
  const existing = await store.findIdentity(key);
  // The caller owns this Firebase identity, so saying it is already mapped reveals nothing about anyone else.
  if (existing) return { status: existing.disabledAt ? 'disabled' : 'already_linked' };

  // Same bcrypt work and the same answer for: no such account, account without a password, wrong password.
  const user = await store.findUserByEmail(email);
  const ok = await verifyPasswordProof(password, user?.passwordHash);
  if (!user || !ok) return { status: 'proof_failed' };

  const challenge = newChallenge();
  const { expiresAt } = await store.createChallenge({
    challengeHash: digestChallenge(challenge),
    userId: user.id,
    ...key,
    credentialFingerprint: credentialFingerprint(user.passwordHash),
    ttlSeconds: CHALLENGE_TTL_SECONDS
  });
  return { status: 'ok', challenge, expiresAt };
};

/**
 * Step 2. Must be called with claims from a token verified AFTER the challenge was issued.
 * @returns {{status:'ok', user, reconciled?:true} | {status:'invalid_challenge'|'disabled'|'already_linked'}}
 */
export const completeLink = async (store, claims, email, rawChallenge) => {
  if (typeof rawChallenge !== 'string' || !CHALLENGE_RE.test(rawChallenge)) return { status: 'invalid_challenge' };
  const key = keyOf(claims);
  const challengeHash = digestChallenge(rawChallenge);

  // Cheap read-only pre-check. Unknown, tampered, expired, consumed and other-identity challenges all look the same.
  const pre = await store.findChallenge(challengeHash);
  if (!pre || pre.consumed || !pre.live || pre.purpose !== LINK_PURPOSE || pre.provider !== PROVIDER
      || pre.providerProject !== key.project || pre.providerSub !== key.sub) {
    return { status: 'invalid_challenge' };
  }

  try {
    const user = await store.transaction(async (tx) => {
      const row = await tx.consumeChallenge({ challengeHash, ...key });
      if (!row) throw new LinkRefusal('invalid_challenge'); // lost a race, expired meanwhile, or replay

      const target = await tx.lockUser(row.userId);
      // Password changed (or removed) since the proof, or the account's e-mail no longer matches the verified one.
      if (!target || !target.passwordHash
          || !sameFingerprint(credentialFingerprint(target.passwordHash), row.credentialFingerprint)
          || normalizeEmail(target.email) !== email) {
        throw new LinkRefusal('invalid_challenge');
      }

      const mapped = await tx.findIdentity(key);
      if (mapped) throw new LinkRefusal(mapped.disabledAt ? 'disabled' : 'already_linked');

      await tx.insertIdentity({ userId: target.id, ...key, signInMethod: claims.signInProvider, emailAtLink: email });
      return target;
    });
    return { status: 'ok', user: publicUser(user) };
  } catch (error) {
    if (error instanceof LinkRefusal) return { status: error.status };

    // Unique violation (a concurrent link of the same identity won) or an ambiguous outcome (e.g. the connection dropped
    // around COMMIT). Never retry blindly: reconcile with a read-only lookup of the identity mapping.
    let mapped;
    try { mapped = await store.findIdentity(key); } catch { throw error; }
    if (isUniqueViolation(error)) return { status: mapped?.disabledAt ? 'disabled' : 'already_linked' };
    if (mapped && !mapped.disabledAt && mapped.userId === pre.userId) {
      const u = await store.findUserById(pre.userId);
      if (u) return { status: 'ok', user: publicUser(u), reconciled: true };
    }
    throw error;
  }
};
