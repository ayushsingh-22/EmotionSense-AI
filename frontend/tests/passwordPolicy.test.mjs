import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { validateNewPassword, passwordChecklist, PASSWORD_MIN_LENGTH, PASSWORD_MAX_BYTES, NAME_MAX_LENGTH } from '../lib/passwordPolicy.ts';

const ok = (p, ctx) => assert.deepEqual(validateNewPassword(p, ctx), { ok: true }, `expected acceptable: ${p}`);
const bad = (p, ctx, re) => {
  const r = validateNewPassword(p, ctx);
  assert.equal(r.ok, false, `expected rejection: ${String(p).slice(0, 20)}`);
  if (re) assert.match(r.reason, re);
};

describe('new-password policy', () => {
  test('requires a string of at least the minimum length', () => {
    assert.equal(PASSWORD_MIN_LENGTH, 12);
    assert.equal(NAME_MAX_LENGTH, 100);
    bad(undefined); bad(null); bad(12345678901234); bad('');
    bad('Abc12345', {}, /at least 12/);
    bad('abcde', {}, /at least 12/);
    // Production bug 2026-11: 10-11 characters passed the form but the backend requires 12.
    bad('Tr0ub4dor&3', {}, /at least 12/); bad('Tr0ub4dor&X', {}, /at least 12/); bad('Tr0ub4dor&', {}, /at least 12/);
    ok('Tr0ub4dor&3x');
    ok('correct horse battery');
  });
  test('no composition rules: a long all-lowercase passphrase is fine', () => {
    ok('purple-monkey-dishwasher');
    ok('thisisalongpassphrase');
  });
  test('rejects well-known passwords, including trivial variants', () => {
    for (const p of ['password1234', 'Password12345', 'PASSWORD1234', 'passwordpassword', 'iloveyou1234', '123456789012', 'abcdefghijkl', 'Welcome12345!']) bad(p, {}, /too common/);
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
  test('live checklist lists every rule and agrees with the validator', () => {
    const empty = passwordChecklist('');
    assert.deepEqual(empty.map(x => x.id), ['length', 'maxBytes', 'common', 'repetitive', 'email', 'name']);
    assert.ok(empty.every(x => !x.ok), 'nothing is ticked before typing');
    assert.match(empty[0].label, /At least 12 characters/);
    const ctx = { email: 'jonathan@example.com', fullName: 'Priya Sharma' };
    for (const p of ['short', 'Tr0ub4dor&3', 'Tr0ub4dor&3x', 'password1234', 'abababababab', 'jonathan-is-great-1', 'my-name-is-priya-sharma', 'x7Kp'.repeat(18) + 'q', 'correct horse battery']) {
      const list = passwordChecklist(p, ctx);
      assert.equal(list.every(x => x.ok), validateNewPassword(p, ctx).ok, p);
    }
    assert.deepEqual(passwordChecklist('Tr0ub4dor&3', ctx).filter(x => !x.ok).map(x => x.id), ['length']);
  });
});
