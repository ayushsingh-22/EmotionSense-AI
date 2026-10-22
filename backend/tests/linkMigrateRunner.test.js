/**
 * Pure safety helpers of scripts/dev-link-challenges-migrate.mjs.
 * No database, network or Neon access.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

const { executionGateProblems } = await import('../scripts/dev-link-challenges-migrate.mjs');

const valid = () => ({
  execute: true,
  freshDevelopment: true,
  confirmFreshDevelopment: true,
  confirmEmptyDevelopmentNoBackup: true,
  confirmBranch: 'br-weathered-hall-b3dn9bub',
  confirmNotDefault: true,
  confirmChecksum: '475bce9c7ddea4a6'
});

describe('one-time empty-development migration safety', () => {
  test('accepts only the complete explicit execution gate', () => {
    assert.deepEqual(executionGateProblems(valid()), []);
  });

  for (const [field, value, expected] of [
    ['execute', false, 'actual execution'],
    ['freshDevelopment', false, 'fresh-Development'],
    ['confirmFreshDevelopment', false, 'confirm-fresh-development'],
    ['confirmEmptyDevelopmentNoBackup', false, 'confirm-empty-development-no-backup'],
    ['confirmBranch', 'br-flat-tree-b3brt6b9', 'confirm-branch'],
    ['confirmNotDefault', false, 'confirm-not-default'],
    ['confirmChecksum', 'wrong-checksum', 'checksum']
  ]) {
    test(`rejects ${field}`, () => {
      const options = valid();
      options[field] = value;
      assert.match(executionGateProblems(options).join('; '), new RegExp(expected, 'i'));
    });
  }

  test('the no-backup acknowledgment alone is never sufficient', () => {
    const options = valid();
    options.execute = false;
    options.freshDevelopment = false;
    options.confirmFreshDevelopment = false;
    assert.ok(executionGateProblems(options).length >= 3);
  });

  test('does not accept a production branch confirmation', () => {
    const options = valid();
    options.confirmBranch = 'br-flat-tree-b3brt6b9';
    assert.notDeepEqual(executionGateProblems(options), []);
  });
});
