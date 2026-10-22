/**
 * Server-side proof of a MantraAI web password, used ONLY by account linking.
 *
 * Mirrors frontend/lib/passwordVerify.ts (the NextAuth Credentials verifier): bcrypt compare with constant work
 * whether or not the account exists. A missing hash (unknown user, or a Firebase-only account whose
 * users.password_hash is NULL) never verifies: the dummy hash is compared for timing and the result is forced to false.
 * Nothing here ever logs or returns the password or the hash.
 */
import bcrypt from 'bcryptjs';
import { createHash, timingSafeEqual } from 'node:crypto';

/** bcrypt (cost 10, same as existing hashes) of a random value. Same constant as frontend/lib/passwordVerify.ts. */
export const DUMMY_PASSWORD_HASH = '$2a$10$YpGUZRwnfwcOcp9Tpq131OvYnrdz4dTvM9Ejb.rpUMaP8VJcEqqh.';
export const MAX_PASSWORD_LENGTH = 1024;

export const verifyPasswordProof = async (plain, hash) => {
  const candidate = typeof plain === 'string' ? plain.slice(0, MAX_PASSWORD_LENGTH) : '';
  const real = typeof hash === 'string' && hash.length > 0 ? hash : null;
  let ok = false;
  try {
    ok = await bcrypt.compare(candidate, real || DUMMY_PASSWORD_HASH);
  } catch {
    ok = false; // malformed stored hash: never a match
  }
  return real !== null && ok === true;
};

/**
 * Hex SHA-256 of the stored password hash at proof time (auth_link_challenges.credential_fingerprint).
 * Lets the completion step detect a password change between start and complete without storing the hash.
 */
export const credentialFingerprint = (hash) => createHash('sha256').update(String(hash), 'utf8').digest('hex');

export const sameFingerprint = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== 64 || b.length !== 64) return false;
  return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
};
