// Integration suites may share the development DB with real manual test
// accounts, so they only ever count and delete THEIR OWN synthetic users:
// email = <suite prefix><anything>@example.invalid. Never assert global totals.
import assert from 'node:assert/strict';

export const SYNTHETIC_DOMAIN = '@example.invalid';
// Every prefix used by a suite or probe in tests/.
export const SYNTHETIC_PREFIXES = Object.freeze(['phase2a-test-', 'spike-test-', 'spike-cold-', 'wellbeing-test-', 'catalog-test-', 'export-test-']);

export const syntheticWhere = prefixes => {
  if (!prefixes.length || prefixes.some(p => typeof p !== 'string' || !/^[a-z0-9-]+-$/.test(p))) throw new Error('Invalid synthetic prefix');
  return { OR: prefixes.map(p => ({ email: { startsWith: p, endsWith: SYNTHETIC_DOMAIN } })) };
};

export async function syntheticCounts(prisma, prefixes) {
  const where = syntheticWhere(prefixes);
  const [users, sessions, challenges] = await Promise.all([
    prisma.user.count({ where }), prisma.authSession.count({ where: { user: where } }), prisma.authChallenge.count({ where: { user: where } })
  ]);
  return { users, sessions, challenges };
}

export const deleteSynthetic = (prisma, prefixes) => prisma.user.deleteMany({ where: syntheticWhere(prefixes) });

/** Delete this suite's synthetic users, print scoped counts, and require zero. */
export async function cleanAndAssertNoLeftovers(prisma, prefixes, label) {
  await deleteSynthetic(prisma, prefixes);
  const c = await syntheticCounts(prisma, prefixes);
  console.log(`# ${label}_FINAL_COUNTS synthetic_users=${c.users} synthetic_sessions=${c.sessions} synthetic_challenges=${c.challenges}`);
  assert.deepEqual(c, { users: 0, sessions: 0, challenges: 0 }, `${label} left synthetic rows behind`);
}
