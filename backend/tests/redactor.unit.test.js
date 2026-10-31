import { test } from 'node:test';
import assert from 'node:assert/strict';
import { redact } from '../src/utils/logRedaction.js';

test('redaction masks synthetic email, bearer and JWT values', () => {
  const address = ['example','example.invalid'].join('@');
  const bearer = ['Bearer','synthetic-secret-token-value'].join(' ');
  const jwt = ['eyJabcdefghijk','abcdefghijk','abcdefghijk'].join('.');
  const result = redact([address,bearer,jwt].join(' '));
  assert.ok(!result.includes(address)); assert.ok(!result.includes(bearer)); assert.ok(!result.includes(jwt));
});
