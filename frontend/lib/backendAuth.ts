import { SignJWT } from 'jose';

/**
 * Token contract shared with backend/src/middleware/auth.js — keep in sync:
 *   alg HS256 (pinned) · iss "mantra-web" · aud "mantra-api" · sub = users.id
 */
export const BACKEND_TOKEN_ISSUER = 'mantra-web';
export const BACKEND_TOKEN_AUDIENCE = 'mantra-api';
export const BACKEND_TOKEN_TTL_SECONDS = 5 * 60;

let secretSource: string | null = null;
let secretKey: Uint8Array | null = null;

const getSecretKey = () => {
  // Dedicated secret only — no NEXTAUTH_SECRET fallback. Must equal the Render
  // backend's API_JWT_SECRET and must differ from NEXTAUTH_SECRET.
  const secret = process.env.API_JWT_SECRET;
  if (!secret) {
    throw new Error('API_JWT_SECRET is not configured on the frontend');
  }
  if (secret.length < 32) {
    throw new Error('API_JWT_SECRET must be at least 32 characters');
  }
  if (process.env.NEXTAUTH_SECRET && secret === process.env.NEXTAUTH_SECRET) {
    throw new Error('API_JWT_SECRET must differ from NEXTAUTH_SECRET');
  }
  if (secretSource !== secret) {
    secretKey = new TextEncoder().encode(secret);
    secretSource = secret;
  }
  return secretKey as Uint8Array;
};

/**
 * Mints a short-lived HS256 JWT for calling the Express backend (Render) as the
 * already-authenticated NextAuth user. Server-side only — never import this
 * from client components. This is NOT NextAuth's own session cookie/JWE.
 */
export async function getBackendToken(userId: string, email?: string | null): Promise<string> {
  return new SignJWT({ email: email ?? undefined })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(userId)
    .setIssuer(BACKEND_TOKEN_ISSUER)
    .setAudience(BACKEND_TOKEN_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${BACKEND_TOKEN_TTL_SECONDS}s`)
    .sign(getSecretKey());
}

export default getBackendToken;
