import bcrypt from 'bcryptjs';

/** bcrypt hash of a random value (cost 10 = existing hashes). Compared against when the user is unknown so response time does not reveal whether an account exists. */
export const DUMMY_PASSWORD_HASH = '$2a$10$YpGUZRwnfwcOcp9Tpq131OvYnrdz4dTvM9Ejb.rpUMaP8VJcEqqh.';

/**
 * Verifies a password with constant work regardless of whether the user exists.
 * A missing hash (unknown user, or an account with no password credential such as a
 * Firebase-only user whose users.password_hash is NULL) never verifies: the dummy hash
 * is compared for timing and the result is forced to false.
 */
export async function verifyPassword(plain: string, hash: string | undefined | null) {
  const ok = await bcrypt.compare(plain, hash || DUMMY_PASSWORD_HASH);
  return !!hash && ok;
}
