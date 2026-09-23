import { SignJWT } from 'jose';

let secretKey: Uint8Array | null = null;

const getSecretKey = () => {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error('NEXTAUTH_SECRET is not configured on the frontend');
  }
  if (!secretKey) {
    secretKey = new TextEncoder().encode(secret);
  }
  return secretKey;
};

/**
 * Mints a short-lived HS256 JWT (signed with NEXTAUTH_SECRET, the same
 * secret the Express backend verifies with — see
 * backend/src/middleware/auth.js) for server-side code that needs to call
 * the backend as an authenticated user.
 *
 * This is deliberately NOT NextAuth's own session cookie/JWE.
 */
export async function getBackendToken(userId: string, email?: string | null): Promise<string> {
  return new SignJWT({ email: email ?? undefined })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(getSecretKey());
}

export default getBackendToken;
