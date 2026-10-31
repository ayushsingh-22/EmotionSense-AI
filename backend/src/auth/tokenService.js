import { randomUUID } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';

export function createTokenService({ secret, issuer = 'mindhaven-auth', audience = 'mindhaven-api', ttlSeconds = 900, clock = () => Date.now() }) {
  if (typeof secret !== 'string' || Buffer.byteLength(secret) < 32) throw new Error('JWT secret must be at least 32 bytes');
  if (!Number.isInteger(ttlSeconds) || ttlSeconds <= 0 || ttlSeconds > 900) throw new Error('Invalid access token lifetime');
  const key = new TextEncoder().encode(secret);
  return {
    async issue({ userId, sessionId }) {
      if (!userId || !sessionId) throw new Error('Identity and session required');
      const issued = Math.floor(clock() / 1000);
      const token = await new SignJWT({ sid: sessionId }).setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
        .setIssuer(issuer).setAudience(audience).setSubject(userId).setJti(randomUUID())
        .setIssuedAt(issued).setExpirationTime(issued + ttlSeconds).sign(key);
      return { token, expiresAt: new Date((issued + ttlSeconds) * 1000) };
    },
    async verify(token) {
      const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'], issuer, audience,
        requiredClaims: ['sub', 'sid', 'iat', 'exp', 'jti'], currentDate: new Date(clock()), maxTokenAge: `${ttlSeconds}s` });
      if (typeof payload.sub !== 'string' || !payload.sub || typeof payload.sid !== 'string' || !payload.sid ||
          typeof payload.jti !== 'string' || !payload.jti || typeof payload.iat !== 'number' ||
          typeof payload.exp !== 'number' || payload.exp - payload.iat > ttlSeconds || payload.iat > Math.floor(clock() / 1000))
        throw new Error('Invalid token claims');
      return payload;
    }
  };
}
