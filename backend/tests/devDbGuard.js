/**
 * Shared safety net for tests that WRITE to a database.
 *
 * Before launch, the user explicitly designated one new production-named branch as the test target.
 * The database must report the exact allowed branch, endpoint and project and match the pin.
 * Old production and recovery targets remain forbidden. No write occurs before these checks.
 */
// The explicitly approved pre-launch test target is also currently named production.
export const DEV = { branch: 'br-ancient-snow-b3si0kwz', endpoint: 'ep-cold-hill-b3lffx1r', project: 'fancy-union-28873755' };
export const assertSafeTestDatabase = async (prisma, env = process.env) => {
  if (String(env.NODE_ENV || '').trim().toLowerCase() === 'production') throw new Error('Refusing to run DB tests with NODE_ENV=production');
  const expected = env.EXPECTED_NEON_BRANCH_ID;
  if (!expected) throw new Error('Refusing to run: EXPECTED_NEON_BRANCH_ID must be set');
  const host = (() => { try { return new URL(env.DATABASE_URL).hostname; } catch { return ''; } })();
  const endpoint = host.split('.')[0].replace(/-pooler$/, '');
  if (endpoint !== DEV.endpoint || !host.endsWith('.aws.neon.tech')) throw new Error('Refusing to run: DATABASE_URL is not the approved endpoint');

  const [id] = await prisma.$queryRawUnsafe(
    "select current_setting('neon.branch_id', true) as branch, current_setting('neon.endpoint_id', true) as endpoint, current_setting('neon.project_id', true) as project");
  if (id.branch !== DEV.branch || id.endpoint !== DEV.endpoint || id.project !== DEV.project) {
    throw new Error(`Refusing to run: database reports ${id.branch}/${id.endpoint}/${id.project}, expected the development branch`);
  }
  if (expected !== DEV.branch) throw new Error(`Refusing to run: EXPECTED_NEON_BRANCH_ID=${expected} is not the development branch`);
  return id;
};
