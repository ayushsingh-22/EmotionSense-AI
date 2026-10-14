/**
 * Password policy for NEW registrations only.
 *
 * Existing accounts are never re-validated: login simply bcrypt-compares whatever
 * the user typed against the stored hash, so shorter legacy passwords keep working.
 *
 * Design follows NIST SP 800-63B: length over composition rules, a block-list of
 * well-known passwords, no truncation surprises, no silent trimming.
 * Pure functions (no imports) so the same file runs on the server and in the browser.
 */

export const PASSWORD_MIN_LENGTH = 10;
/** bcrypt only uses the first 72 BYTES; longer input would be silently truncated. */
export const PASSWORD_MAX_BYTES = 72;

// Small, high-value deny-list (the most common leaked passwords that also satisfy a 10+ length).
const COMMON = new Set([
  'password', 'password1', 'password12', 'password123', 'password1234', 'password12345', 'passw0rd123',
  '1234567890', '12345678910', '123456789012', '0123456789', '1111111111', '0000000000', '1q2w3e4r5t',
  'qwertyuiop', 'qwerty1234', 'qwerty12345', 'qwertyuiop123', 'asdfghjkl1', 'asdfghjklqwerty', 'zxcvbnm123',
  'iloveyou123', 'iloveyou12', 'letmein1234', 'letmein123', 'welcome123', 'welcome1234', 'admin12345', 'administrator',
  'changeme123', 'trustno1234', 'abc1234567', 'abcdefghij', 'abcd123456', 'monkey1234', 'dragon1234', 'football123',
  'baseball123', 'superman123', 'sunshine123', 'princess123', 'mantrai123', 'mantrai1234', 'emotionsense', 'emotionsense1'
]);

export type PasswordCheck = { ok: true } | { ok: false; reason: string };

const byteLength = (s: string) => {
  let bytes = 0;
  for (const ch of s) {
    const cp = ch.codePointAt(0) as number;
    bytes += cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
  }
  return bytes;
};

export function validateNewPassword(password: unknown, context: { email?: string; fullName?: string } = {}): PasswordCheck {
  if (typeof password !== 'string' || password.length === 0) {
    return { ok: false, reason: 'A password is required.' };
  }
  if ([...password].length < PASSWORD_MIN_LENGTH) {
    return { ok: false, reason: `Password must be at least ${PASSWORD_MIN_LENGTH} characters long.` };
  }
  if (byteLength(password) > PASSWORD_MAX_BYTES) {
    return { ok: false, reason: `Password is too long (maximum ${PASSWORD_MAX_BYTES} bytes, about ${PASSWORD_MAX_BYTES} basic characters).` };
  }
  const lowered = password.toLowerCase();
  const alnum = lowered.replace(/[^a-z0-9]/g, '');
  if (COMMON.has(lowered) || COMMON.has(alnum) || COMMON.has(alnum.replace(/\d+$/, ''))) {
    return { ok: false, reason: 'That password is too common. Please choose something less guessable.' };
  }
  if (/^(.)\1+$/.test(password) || new Set(password).size < 4) {
    return { ok: false, reason: 'Password is too repetitive. Please choose something less guessable.' };
  }
  const local = (context.email ?? '').split('@')[0].toLowerCase();
  if (local.length >= 4 && lowered.includes(local)) {
    return { ok: false, reason: 'Password must not contain your email name.' };
  }
  const name = (context.fullName ?? '').trim().toLowerCase();
  if (name.length >= 4 && alnum.includes(name.replace(/[^a-z0-9]/g, ''))) {
    return { ok: false, reason: 'Password must not contain your name.' };
  }
  return { ok: true };
}
