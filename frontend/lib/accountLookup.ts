import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

/**
 * Account lookup helpers that work with the EXISTING schema only (users.email is
 * a case-sensitive unique column; no migration is involved).
 *
 * Historic accounts may have mixed-case emails (registration never normalised).
 * New accounts are stored lower-cased; lookups tolerate both.
 */

export const normalizeEmail = (raw: string) => raw.trim().toLowerCase();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const isPlausibleEmail = (email: string) => email.length <= 254 && EMAIL_RE.test(email);

/** bcrypt hash of a random value (cost 10 = existing hashes). Compared against when the user is unknown so response time does not reveal whether an account exists. */
export const DUMMY_PASSWORD_HASH = '$2a$10$YpGUZRwnfwcOcp9Tpq131OvYnrdz4dTvM9Ejb.rpUMaP8VJcEqqh.';

/**
 * Finds the account for a login attempt: exact match first (the common case and
 * the indexed lookup), then a case-insensitive match, accepted only if it is unambiguous.
 */
export async function findUserForLogin(typedEmail: string) {
  const trimmed = typedEmail.trim();
  const exact = await prisma.user.findUnique({ where: { email: trimmed } });
  if (exact) return exact;
  const matches = await prisma.user.findMany({
    where: { email: { equals: trimmed, mode: 'insensitive' } },
    take: 2
  });
  return matches.length === 1 ? matches[0] : null;
}

/** True if any account already uses this email, ignoring case. */
export async function emailInUse(email: string) {
  const hit = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { id: true }
  });
  return !!hit;
}

/** Verifies a password with constant work regardless of whether the user exists. */
export async function verifyPassword(plain: string, hash: string | undefined | null) {
  const ok = await bcrypt.compare(plain, hash || DUMMY_PASSWORD_HASH);
  return !!hash && ok;
}
