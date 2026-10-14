import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { validateNewPassword, PASSWORD_MIN_LENGTH, PASSWORD_MAX_BYTES } from '../lib/passwordPolicy.ts';

const ok = (p, ctx) => assert.deepEqual(validateNewPassword(p, ctx), { ok: true }, `expected acceptable: ${p}`);
const bad = (p, ctx, re) => {
  const r = validateNewPassword(p, ctx);
  assert.equal(r.ok, false, `expected rejection: ${String(p).slice(0, 20)}`);
  if (re) assert.match(r.reason, re);
};

describe('new-password policy', () => {
  test('requires a string of at least the minimum length', () => {
    assert.equal(PASSWORD_MIN_LENGTH, 10);
    bad(undefined); bad(null); bad(12345678901234); bad('');
    bad('Abc12345', {}, /at least 10/); // 8 chars: the old policy allowed 6
    bad('abcde', {}, /at least 10/);
    ok('correct horse battery');
  });
  test('no composition rules: a long all-lowercase passphrase is fine', () => {
    ok('purple-monkey-dishwasher');
    ok('thisisalongpassphrase');
  });
  test('rejects well-known passwords, including trivial variants', () => {
    for (const p of ['password123', 'Password123', 'PASSWORD1234', 'qwertyuiop', 'iloveyou123', '1234567890', 'letmein1234', 'Welcome123!']) bad(p, {}, /too common/);
  });
  test('rejects repetitive input', () => {
    bad('aaaaaaaaaaaa', {}, /repetitive|common/);
    bad('abababababab', {}, /repetitive/);
  });
  test('rejects passwords containing the email name or full name', () => {
    bad('jonathan-is-great-1', { email: 'jonathan@example.com' }, /email name/);
    bad('my-name-is-priya-sharma', { fullName: 'Priya Sharma' }, /your name/);
    ok('jon-is-great-forever', { email: 'jon@example.com' }); // local part < 4 chars is not checked
  });
  test('enforces the bcrypt 72-BYTE ceiling (no silent truncation), counting multi-byte characters', () => {
    assert.equal(PASSWORD_MAX_BYTES, 72);
    ok('x7Kp'.repeat(18)); // 72 bytes
    bad('x7Kp'.repeat(18) + 'q', {}, /too long/); // 73 bytes
    bad('é'.repeat(37) + 'abcd', {}, /too long/); // 37*2 + 4 = 78 bytes though only 41 characters
    ok('é7aB'.repeat(9)); // 45 bytes, 36 characters
  });
  test('does not trim or normalise: leading/trailing spaces are part of the password', () => {
    ok('  spaces are allowed  ');
  });
});
