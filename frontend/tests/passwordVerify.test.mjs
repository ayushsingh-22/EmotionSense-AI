import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { verifyPassword, DUMMY_PASSWORD_HASH } from '../lib/passwordVerify.ts';

// Pure unit tests: no database, no network, no auth provider.
describe('verifyPassword with the nullable users.password_hash (Phase 2B.2)', () => {
  test('existing credentials accounts: legacy cost-10 and new cost-12 hashes still verify', async () => {
    const legacy = await bcrypt.hash('correct horse battery', 10);
    const current = await bcrypt.hash('correct horse battery', 12);
    assert.equal(await verifyPassword('correct horse battery', legacy), true);
    assert.equal(await verifyPassword('correct horse battery', current), true);
    assert.equal(await verifyPassword('wrong password!!', legacy), false);
  });

  test('legacy $2a$ and $2b$ prefixes verify unchanged', async () => {
    const h = await bcrypt.hash('purple-monkey-dishwasher', 4);
    for (const prefix of ['$2a$', '$2b$']) {
      assert.equal(await verifyPassword('purple-monkey-dishwasher', prefix + h.slice(4)), true, prefix);
    }
  });

  test('Firebase-only user (NULL hash) can NEVER authenticate with any password', async () => {
    for (const pw of ['', 'anything', 'null', 'undefined', '!', DUMMY_PASSWORD_HASH, '$2a$10$' + 'a'.repeat(53)]) {
      assert.equal(await verifyPassword(pw, null), false, `null hash must reject ${JSON.stringify(pw).slice(0, 20)}`);
      assert.equal(await verifyPassword(pw, undefined), false);
      assert.equal(await verifyPassword(pw, ''), false);
    }
  });

  test('unknown-user path (dummy hash comparison) still returns false', async () => {
    assert.equal(await verifyPassword('whatever-password', undefined), false);
    assert.equal(await verifyPassword('', null), false);
  });

  test('a non-bcrypt garbage hash fails closed', async () => {
    let result;
    try { result = await verifyPassword('x'.repeat(12), 'not-a-bcrypt-hash'); } catch { result = false; }
    assert.equal(result, false);
  });
});
