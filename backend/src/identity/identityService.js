/**
 * Identity resolution: Firebase identity -> canonical Neon users.id.
 *
 * Rules (Phase 2B)
 *  - The mapping lives in auth_identities, unique on (provider, provider_project, provider_sub).
 *    The provider subject (Firebase UID) is never used as an application key.
 *  - An existing, enabled mapping returns its canonical users.id.
 *  - A NEW mapping requires a verified email. If no Neon user has that email (compared
 *    case-insensitively) a new users row (password_hash NULL, email_verified_at set) and the
 *    mapping are created in ONE transaction. If a user with that email already exists the
 *    result is `link_required`: NOTHING is linked, merged, moved or modified.
 *  - Concurrent first logins are serialised by the database: the loser of the race hits a
 *    unique violation, re-reads, and returns the winner's mapping (no duplicate users).
 *  - Historic web accounts (password hashes, email_verified_at) are never touched here.
 *  - The only link_method this service ever writes is 'created'.
 */
import { ALLOWED_SIGN_IN_PROVIDERS } from './firebaseVerifier.js';

export const PROVIDER = 'firebase';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const LAST_LOGIN_TOUCH_MS = 60 * 1000;
const MAX_ATTEMPTS = 3;

export const normalizeEmail = (raw) => (typeof raw === 'string' ? raw.trim().toLowerCase() : '');
export const isPlausibleEmail = (e) => e.length >= 3 && e.length <= 254 && EMAIL_RE.test(e);

// eslint-disable-next-line no-control-regex
const cleanName = (n) => (typeof n === 'string' ? n.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 100) || null : null);
const cleanPicture = (u) => {
  if (typeof u !== 'string' || u.length > 2048) return null;
  try { return new URL(u).protocol === 'https:' ? u : null; } catch { return null; }
};

export const isUniqueViolation = (error) =>
  error?.code === 'P2002' || /\b23505\b|duplicate key|unique constraint/i.test(String(error?.message || ''));

const USER_SELECT = { id: true, email: true, fullName: true, avatarUrl: true };
const publicUser = (u) => ({ id: u.id, email: u.email, fullName: u.fullName, avatarUrl: u.avatarUrl });

/**
 * @param prisma   PrismaClient (injected for tests)
 * @param claims   output of the Firebase verifier ({uid, projectId, email, emailVerified, signInProvider, name, picture})
 * @returns {Promise<{status: 'ok', user, provisioned: boolean} | {status: 'link_required'|'disabled'|'email_not_verified'|'unsupported_method'|'invalid_email'}>}
 */
export const resolveFirebaseIdentity = async (prisma, claims, { now = () => new Date() } = {}) => {
  if (!claims?.uid || !claims?.projectId) throw new Error('resolveFirebaseIdentity: verified claims required');
  if (!ALLOWED_SIGN_IN_PROVIDERS.has(claims.signInProvider)) return { status: 'unsupported_method' };

  const key = { provider_providerProject_providerSub: { provider: PROVIDER, providerProject: claims.projectId, providerSub: claims.uid } };

  const useExisting = async (identity) => {
    if (identity.disabledAt) return { status: 'disabled' };
    const t = now();
    if (!identity.lastLoginAt || t.getTime() - identity.lastLoginAt.getTime() > LAST_LOGIN_TOUCH_MS) {
      await prisma.authIdentity.update({ where: { id: identity.id }, data: { lastLoginAt: t } });
    }
    return { status: 'ok', user: publicUser(identity.user), provisioned: false };
  };
  const findIdentity = () => prisma.authIdentity.findUnique({
    where: key,
    select: { id: true, disabledAt: true, lastLoginAt: true, user: { select: USER_SELECT } }
  });

  const found = await findIdentity();
  if (found) return useExisting(found);

  // New mapping: email ownership must be proven by the provider.
  const email = normalizeEmail(claims.email);
  if (!claims.emailVerified || !email) return { status: 'email_not_verified' };
  if (!isPlausibleEmail(email)) return { status: 'invalid_email' };

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const clash = await tx.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } }, select: { id: true } });
        if (clash) return { status: 'link_required' }; // never auto-link
        const t = now();
        const user = await tx.user.create({
          data: { email, passwordHash: null, fullName: cleanName(claims.name), avatarUrl: cleanPicture(claims.picture), emailVerifiedAt: t },
          select: USER_SELECT
        });
        await tx.authIdentity.create({
          data: {
            userId: user.id, provider: PROVIDER, providerProject: claims.projectId, providerSub: claims.uid,
            signInMethod: claims.signInProvider, emailAtLink: email, emailVerified: true, linkMethod: 'created', lastLoginAt: t
          }
        });
        return { status: 'ok', user: publicUser(user), provisioned: true };
      }, { maxWait: 5000, timeout: 10000 });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      // Lost a race. If the same identity now exists, use it; otherwise loop and re-evaluate
      // (the e-mail clash check will now report link_required).
      const again = await findIdentity();
      if (again) return useExisting(again);
    }
  }
  throw new Error('identity resolution did not converge');
};

/** Safe profile for the authenticated user. Never selects or returns password hashes or provider subjects. */
export const getIdentityProfile = async (prisma, userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, email: true, fullName: true, avatarUrl: true, createdAt: true, emailVerifiedAt: true,
      authIdentities: {
        orderBy: { createdAt: 'asc' },
        select: { provider: true, signInMethod: true, emailVerified: true, linkMethod: true, createdAt: true, lastLoginAt: true, disabledAt: true }
      }
    }
  });
  if (!user) return null;
  // Existence of a password credential without reading the hash.
  const hasPassword = (await prisma.user.count({ where: { id: userId, passwordHash: { not: null } } })) > 0;
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
    emailVerified: user.emailVerifiedAt !== null,
    hasPassword,
    identities: user.authIdentities.map((i) => ({
      provider: i.provider,
      signInMethod: i.signInMethod,
      emailVerified: i.emailVerified,
      linkMethod: i.linkMethod,
      linkedAt: i.createdAt,
      lastLoginAt: i.lastLoginAt,
      disabled: i.disabledAt !== null
    }))
  };
};
