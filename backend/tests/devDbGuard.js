/** Destructive integration tests are restricted to the dedicated development branch. */
export const DEV = { branch: 'br-flat-scene-b3f7jcb4', endpoint: 'ep-shiny-fire-b3nfje3k', project: 'fancy-union-28873755' };
export const assertSafeTestDatabase = async (prisma, env = process.env) => {
  if (String(env.NODE_ENV || '').trim().toLowerCase() === 'production') throw new Error('Refusing to run DB tests with NODE_ENV=production');
  const expected = env.EXPECTED_NEON_BRANCH_ID;
  if (!expected) throw new Error('Refusing to run: EXPECTED_NEON_BRANCH_ID must be set');
  if (expected !== DEV.branch) throw new Error('Refusing to run: branch pin is not the development branch');
  const host = (() => { try { return new URL(env.DATABASE_URL).hostname; } catch { return ''; } })();
  const endpoint = host.split('.')[0].replace(/-pooler$/, '');
  if (endpoint !== DEV.endpoint || !host.endsWith('.aws.neon.tech')) throw new Error('Refusing to run: DATABASE_URL is not the approved endpoint');

  if (env.DIRECT_URL) {
    let direct; try { direct = new URL(env.DIRECT_URL); } catch { throw new Error('Refusing invalid direct database URL'); }
    const pooled = new URL(env.DATABASE_URL);
    if (direct.hostname !== pooled.hostname.replace('-pooler.', '.') || direct.hostname.includes('-pooler') || direct.pathname !== pooled.pathname) throw new Error('Refusing mismatched direct database target');
  }

  const [id] = await prisma.$queryRawUnsafe(
    "select current_setting('neon.branch_id', true) as branch, current_setting('neon.endpoint_id', true) as endpoint, current_setting('neon.project_id', true) as project");
  if (id.branch !== DEV.branch || id.endpoint !== DEV.endpoint || id.project !== DEV.project) {
    throw new Error(`Refusing to run: database reports ${id.branch}/${id.endpoint}/${id.project}, expected the development branch`);
  }
  if (expected !== DEV.branch) throw new Error(`Refusing to run: EXPECTED_NEON_BRANCH_ID=${expected} is not the development branch`);
  return id;
};
