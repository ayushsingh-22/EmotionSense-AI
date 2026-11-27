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

// These limits MUST equal the backend's (AUTH_PASSWORD_MIN_LENGTH default, 72-byte bcrypt
// limit, 100-character name). contracts/auth-register.json pins all three and is checked
// by both the frontend and backend test suites.
export const PASSWORD_MIN_LENGTH = 12;
/** bcrypt only uses the first 72 BYTES; longer input would be silently truncated. */
export const PASSWORD_MAX_BYTES = 72;
/** Longer names are rejected by the backend, never silently truncated. */
export const NAME_MAX_LENGTH = 100;

// Small, high-value deny-list of very common leaked passwords (checked after normalising).
const COMMON = new Set([
  'password', 'password1', 'password12', 'password123', 'password1234', 'password12345', 'passw0rd123',
  '1234567890', '12345678910', '123456789012', '0123456789', '1111111111', '0000000000', '1q2w3e4r5t',
  'qwertyuiop', 'qwerty1234', 'qwerty12345', 'qwertyuiop123', 'asdfghjkl1', 'asdfghjklqwerty', 'zxcvbnm123',
  'iloveyou123', 'iloveyou12', 'letmein1234', 'letmein123', 'welcome123', 'welcome1234', 'admin12345', 'administrator',
  'changeme123', 'trustno1234', 'abc1234567', 'abcdefghij', 'abcd123456', 'monkey1234', 'dragon1234', 'football123',
  'baseball123', 'superman123', 'sunshine123', 'princess123', 'mantrai123', 'mantrai1234', 'emotionsense', 'emotionsense1',
  'passwordpassword', 'qwertyuiopasdf', '123456789abc', '1234567890ab', 'abcdefghijkl', 'iloveyou1234', 'welcome12345'
]);

export type PasswordCheck = { ok: true } | { ok: false; reason: string };
type Context = { email?: string; fullName?: string };

const byteLength = (s: string) => {
  let bytes = 0;
  for (const ch of s) {
    const cp = ch.codePointAt(0) as number;
    bytes += cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
  }
  return bytes;
};

// One definition per rule, used by both validateNewPassword and passwordChecklist.
type Rule = { id: 'length' | 'maxBytes' | 'common' | 'repetitive' | 'email' | 'name'; label: string; reason: string; ok: (p: string, c: Context) => boolean };
const RULES: Rule[] = [
  { id: 'length', label: `At least ${PASSWORD_MIN_LENGTH} characters`, reason: `Password must be at least ${PASSWORD_MIN_LENGTH} characters long.`,
    ok: p => [...p].length >= PASSWORD_MIN_LENGTH },
  { id: 'maxBytes', label: `No more than ${PASSWORD_MAX_BYTES} bytes (about ${PASSWORD_MAX_BYTES} basic characters)`, reason: `Password is too long (maximum ${PASSWORD_MAX_BYTES} bytes, about ${PASSWORD_MAX_BYTES} basic characters).`,
    ok: p => byteLength(p) <= PASSWORD_MAX_BYTES },
  { id: 'common', label: 'Not a commonly used password', reason: 'That password is too common. Please choose something less guessable.',
    ok: p => { const lowered = p.toLowerCase(), alnum = lowered.replace(/[^a-z0-9]/g, ''); return !(COMMON.has(lowered) || COMMON.has(alnum) || COMMON.has(alnum.replace(/\d+$/, ''))); } },
  { id: 'repetitive', label: 'Not repetitive (at least 4 different characters)', reason: 'Password is too repetitive. Please choose something less guessable.',
    ok: p => !/^(.)\1+$/.test(p) && new Set(p).size >= 4 },
  { id: 'email', label: 'Does not contain your email name', reason: 'Password must not contain your email name.',
    ok: (p, c) => { const local = (c.email ?? '').split('@')[0].toLowerCase(); return !(local.length >= 4 && p.toLowerCase().includes(local)); } },
  { id: 'name', label: 'Does not contain your name', reason: 'Password must not contain your name.',
    ok: (p, c) => { const name = (c.fullName ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, ''); return !(name.length >= 4 && p.toLowerCase().replace(/[^a-z0-9]/g, '').includes(name)); } }
];

export function validateNewPassword(password: unknown, context: Context = {}): PasswordCheck {
  if (typeof password !== 'string' || password.length === 0) return { ok: false, reason: 'A password is required.' };
  const failed = RULES.find(rule => !rule.ok(password, context));
  return failed ? { ok: false, reason: failed.reason } : { ok: true };
}

export type ChecklistItem = { id: Rule['id']; label: string; ok: boolean };

/** Live checklist for the signup form: every rule above, each with its pass/fail state. */
export function passwordChecklist(password: string, context: Context = {}): ChecklistItem[] {
  const p = typeof password === 'string' ? password : '';
  return RULES.map(rule => ({ id: rule.id, label: rule.label, ok: p.length > 0 && rule.ok(p, context) }));
}
