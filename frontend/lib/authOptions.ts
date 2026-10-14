import type { AuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { authLimits, clientIp, consume, hashPart, resetKey } from '@/lib/rateLimit';
import { findUserForLogin, normalizeEmail, verifyPassword } from '@/lib/accountLookup';

// NextAuth reads NEXTAUTH_URL from process.env internally. If it's not set
// explicitly (easy to forget on a first Vercel deploy), fall back to
// Vercel's own auto-provided VERCEL_URL so auth doesn't silently break.
// If you attach a custom domain, set NEXTAUTH_URL explicitly to that domain
// instead — VERCEL_URL points at the current deployment's own subdomain, not
// a custom domain.
if (!process.env.NEXTAUTH_URL && process.env.VERCEL_URL) {
  process.env.NEXTAUTH_URL = `https://${process.env.VERCEL_URL}`;
}

/**
 * Shared NextAuth (Auth.js v4) configuration.
 *
 * Exported separately from the route handler so server-side code (API
 * routes, server components) can call `getServerSession(authOptions)`
 * without importing the route file directly.
 */
export const authOptions: AuthOptions = {
  session: {
    // Required for the Credentials provider — there is no database session
    // strategy available for it.
    strategy: 'jwt',
  },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, req) {
        const email = typeof credentials?.email === 'string' ? credentials.email.trim() : '';
        const password = typeof credentials?.password === 'string' ? credentials.password : '';

        // Bounded input: bcrypt only uses 72 bytes, and unbounded input is a cheap DoS.
        if (!email || !password || email.length > 254 || password.length > 1024) {
          await verifyPassword(password.slice(0, 1024), null); // keep timing uniform
          return null;
        }

        // Throttle BEFORE touching the database. Keys are derived from what the caller
        // typed (not from whether the account exists), so throttling reveals nothing.
        const limits = authLimits();
        const ip = clientIp(req?.headers as Record<string, string | string[] | undefined> | undefined);
        const accountKey = `login:account:${hashPart(normalizeEmail(email))}`;
        const [ipRl, accountRl] = await Promise.all([
          consume(`login:ip:${hashPart(ip)}`, limits.loginPerIp),
          consume(accountKey, limits.loginPerAccount)
        ]);
        if (!ipRl.allowed || !accountRl.allowed) {
          throw new Error('TooManyAttempts');
        }

        const user = await findUserForLogin(email);

        // Same work whether or not the account exists (dummy hash) and identical
        // outcome (null) for "no such user" and "wrong password".
        const valid = await verifyPassword(password, user?.passwordHash);
        if (!user || !valid) {
          return null;
        }

        await resetKey(accountKey); // a successful login clears that account's failure counter

        return {
          id: user.id,
          email: user.email,
          name: user.fullName ?? undefined,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.email = user.email;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub as string;
        if (token.email) {
          session.user.email = token.email as string;
        }
      }
      return session;
    },
  },
  pages: {
    signIn: '/auth/login',
  },
  secret: process.env.NEXTAUTH_SECRET,
};

export default authOptions;
