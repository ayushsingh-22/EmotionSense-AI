import { SignJWT } from 'jose';

export const TEST_SECRET = 'test-secret-test-secret-test-secret-0123456789';
export const OTHER_SECRET = 'another-secret-another-secret-0123456789abc';

export const setTestEnv = (extra = {}) => {
  process.env.NODE_ENV = 'test';
  process.env.API_JWT_SECRET = TEST_SECRET;
  process.env.CRON_SECRET = 'cron-secret-for-tests-only';
  process.env.CORS_ORIGIN = 'https://app.example.test,https://mantra-*-team.vercel.app';
  Object.assign(process.env, extra);
};

/** Mint a backend access token for unit tests. */
export const mintToken = async (userId, opts = {}) => {
  const {
    secret = TEST_SECRET, alg = 'HS256', iss = 'mindhaven-auth', aud = 'mindhaven-api',
    expiresIn = '5m', iat
  } = opts;
  let jwt = new SignJWT({ sid: 'unit-session' }).setProtectedHeader({ alg }).setIssuedAt(iat).setJti('unit-jti');
  if (userId !== null) jwt = jwt.setSubject(userId);
  if (iss) jwt = jwt.setIssuer(iss);
  if (aud) jwt = jwt.setAudience(aud);
  jwt = jwt.setExpirationTime(expiresIn);
  return jwt.sign(new TextEncoder().encode(secret));
};

export const bearer = (t) => ({ Authorization: `Bearer ${t}` });
