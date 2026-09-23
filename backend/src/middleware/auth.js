/**
 * Verifies the app-level API token the Next.js frontend signs (with
 * NEXTAUTH_SECRET, HS256) after establishing a NextAuth session, and attaches
 * the authenticated user id to the request as `req.userId`.
 *
 * This is deliberately NOT NextAuth's own session cookie/JWE — that format is
 * internal to next-auth and awkward to decode outside a Next.js request. The
 * frontend mints this short-lived bearer token server-side (see
 * frontend/lib/backendAuth.ts) once it already knows who the user is.
 */
import { jwtVerify } from 'jose';
import config from '../config/index.js';

let secretKey = null;

const getSecretKey = () => {
  if (!config.auth.nextAuthSecret) {
    throw new Error('NEXTAUTH_SECRET is not configured on the backend');
  }
  if (!secretKey) {
    secretKey = new TextEncoder().encode(config.auth.nextAuthSecret);
  }
  return secretKey;
};

export const requireAuth = async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ error: 'Missing Authorization bearer token' });
    }

    const { payload } = await jwtVerify(token, getSecretKey());

    if (!payload.sub) {
      return res.status(401).json({ error: 'Invalid token: missing subject' });
    }

    req.userId = payload.sub;
    req.userEmail = payload.email || null;
    next();
  } catch (error) {
    console.error('❌ Auth verification failed:', error.message);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

export default requireAuth;
