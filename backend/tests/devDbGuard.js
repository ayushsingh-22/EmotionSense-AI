/**
 * Shared safety net for tests that WRITE to a database.
 *
 * Writes are allowed ONLY on the Unified Neon V2 DEVELOPMENT branch. Before the first write the
 * database itself reports its branch / endpoint / project (neon.* settings); production, the old
 * recovery branch, the pre-2B.2 recovery branch and the production endpoint are refused, and the
 * reported ids must equal the development ids AND EXPECTED_NEON_BRANCH_ID. Nothing is written
 * (and nothing is deleted) anywhere the guard has not approved.
 */
export const DEV = { branch: 'br-weathered-hall-b3dn9bub', endpoint: 'ep-square-boat-b3zomdvt', project: 'plain-wave-56430909' };
export const FORBIDDEN_BRANCHES = [
  'br-flat-tree-b3brt6b9', // production
  'br-lively-boat-b3vxk8t3', // old recovery
  'br-still-fog-b36gqrgc' // pre-2B.2 recovery
];
export const FORBIDDEN_ENDPOINTS = ['ep-snowy-term-b39utxb2' /* production */];

export const assertSafeTestDatabase = async (prisma, env = process.env) => {
  if (env.NODE_ENV === 'production') throw new Error('Refusing to run DB tests with NODE_ENV=production');
  const expected = env.EXPECTED_NEON_BRANCH_ID;
  if (!expected) throw new Error('Refusing to run: EXPECTED_NEON_BRANCH_ID must be set');
  if (FORBIDDEN_BRANCHES.includes(expected)) throw new Error(`Refusing to run: EXPECTED_NEON_BRANCH_ID=${expected} is a production or recovery branch`);
  const host = (() => { try { return new URL(env.DATABASE_URL).hostname; } catch { return ''; } })();
  if (FORBIDDEN_ENDPOINTS.some((e) => host.includes(e))) throw new Error('Refusing to run: DATABASE_URL points at the production endpoint');

  const [id] = await prisma.$queryRawUnsafe(
    "select current_setting('neon.branch_id', true) as branch, current_setting('neon.endpoint_id', true) as endpoint, current_setting('neon.project_id', true) as project");
  if (FORBIDDEN_BRANCHES.includes(id.branch) || FORBIDDEN_ENDPOINTS.includes(id.endpoint)) {
    throw new Error(`Refusing to run: ${id.branch}/${id.endpoint} is a production or recovery target`);
  }
  if (id.branch !== DEV.branch || id.endpoint !== DEV.endpoint || id.project !== DEV.project) {
    throw new Error(`Refusing to run: database reports ${id.branch}/${id.endpoint}/${id.project}, expected the development branch`);
  }
  if (expected !== DEV.branch) throw new Error(`Refusing to run: EXPECTED_NEON_BRANCH_ID=${expected} is not the development branch`);
  return id;
};
