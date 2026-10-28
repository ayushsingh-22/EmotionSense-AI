import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  APPLICATION_TABLES,
  CLEANUP_ORDER,
  DEVELOPMENT,
  PENDING_TABLE,
  STATIC_TABLES,
  USER_DATA_TABLES,
  buildCleanupPlan,
  cleanupPlanIsSafe,
  validateDevelopmentIdentity,
  validateFreshInventory
} from '../scripts/freshDevelopmentGuard.mjs';

const counts = (overrides = {}) => Object.fromEntries(USER_DATA_TABLES.map((table) => [table, 0]).map(([table, count]) => [table, overrides[table] ?? count]));
const migrations = ['20260923032421_init', '20261012181122_add_wellbeing_v2', '20261014120000_add_auth_identities'];

describe('fresh development identity guard', () => {
  const base = {
    reported: { project: DEVELOPMENT.project, branch: DEVELOPMENT.branch, endpoint: DEVELOPMENT.endpoint },
    configuredEndpoint: DEVELOPMENT.endpoint,
    expectedBranch: DEVELOPMENT.branch
  };

  test('accepts only the server-reported Development identity', () => {
    assert.deepEqual(validateDevelopmentIdentity(base), []);
  });

  for (const [label, reported] of [
    ['unapproved branch', { project: DEVELOPMENT.project, branch: 'unapproved-branch-one', endpoint: DEVELOPMENT.endpoint }],
    ['unapproved endpoint', { project: DEVELOPMENT.project, branch: DEVELOPMENT.branch, endpoint: 'unapproved-endpoint-two' }],
    ['wrong project', { project: 'wrong-project', branch: DEVELOPMENT.branch, endpoint: DEVELOPMENT.endpoint }],
    ['wrong endpoint', { project: DEVELOPMENT.project, branch: DEVELOPMENT.branch, endpoint: 'ep-other' }]
  ]) {
    test(`rejects ${label}`, () => {
      assert.ok(validateDevelopmentIdentity({ ...base, reported }).length > 0);
    });
  }
});

describe('fresh development inventory guard', () => {
  const base = {
    tableNames: ['_prisma_migrations', ...APPLICATION_TABLES],
    counts: counts(),
    migrations,
    expectedMigrations: migrations,
    pendingTablePresent: false,
    writers: 0
  };

  test('accepts an empty user/application dataset and preserves static tables', () => {
    assert.deepEqual(validateFreshInventory(base), []);
  });

  for (const table of ['users', 'auth_identities', 'chat_sessions', 'messages']) {
    test(`rejects nonempty ${table}`, () => {
      assert.match(validateFreshInventory({ ...base, counts: counts({ [table]: 1 }) }).join('; '), new RegExp(table));
    });
  }

  test('rejects an unknown application table', () => {
    assert.match(validateFreshInventory({ ...base, tableNames: [...base.tableNames, 'unreviewed_table'] }).join('; '), /unknown public tables/);
  });

  test('rejects the pending table, wrong migration history, and active writers', () => {
    const problems = validateFreshInventory({ ...base, pendingTablePresent: true, migrations: migrations.slice(0, 2), writers: 1 });
    assert.equal(problems.length, 3);
    assert.match(problems.join('; '), new RegExp(PENDING_TABLE));
  });

  test('does not treat protected static tables as cleanup failures', () => {
    assert.deepEqual([...STATIC_TABLES].sort(), ['content_items', 'media_assets']);
  });
});

describe('cleanup plan', () => {
  test('uses reviewed child-first deletes and protects schema metadata/static tables', () => {
    const plan = buildCleanupPlan();
    assert.equal(cleanupPlanIsSafe(plan), true);
    assert.deepEqual(plan.map((entry) => entry.table), CLEANUP_ORDER);
    assert.ok(!plan.some((entry) => entry.statement.includes('_prisma_migrations')));
  });
});
