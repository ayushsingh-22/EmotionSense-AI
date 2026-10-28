import type { AuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { backendUrl } from '@/lib/backendAuthClient';

if (!process.env.NEXTAUTH_URL) throw new Error('NEXTAUTH_URL must be explicitly configured');
const canonicalUrl = new URL(process.env.NEXTAUTH_URL);
if (!['http:', 'https:'].includes(canonicalUrl.protocol) || canonicalUrl.pathname !== '/' || canonicalUrl.search || canonicalUrl.hash || canonicalUrl.username || canonicalUrl.password) throw new Error('NEXTAUTH_URL must be the canonical origin');
if (canonicalUrl.protocol !== 'https:' && !['localhost','127.0.0.1'].includes(canonicalUrl.hostname)) throw new Error('NEXTAUTH_URL must use HTTPS outside local development');

export const authOptions: AuthOptions = {
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
  providers: [CredentialsProvider({
    name: 'Credentials',
    credentials: { email: { label: 'Email', type: 'email' }, password: { label: 'Password', type: 'password' } },
    async authorize(credentials) {
      const email=credentials?.email?.trim() || '', password=credentials?.password || '';
      if (!email || !password) return null;
      let response: Response;
      try { response=await fetch(`${backendUrl()}/api/auth/login`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password}),cache:'no-store',signal:AbortSignal.timeout(15000)}); }
      catch { throw new Error('ServiceUnavailable'); }
      if(response.status===401) return null;
      if(response.status===403) throw new Error('EmailNotVerified');
      if(response.status>=500) throw new Error('ServiceUnavailable');
      if(!response.ok) return null;
      const data=await response.json();
      if(!data?.user?.id || !data.accessToken || !data.refreshToken || !data.accessExpiresAt || !data.refreshExpiresAt) throw new Error('ServiceUnavailable');
      return { id:data.user.id, name:data.user.name ?? null, email, accessToken:data.accessToken,refreshToken:data.refreshToken,accessExpiresAt:data.accessExpiresAt,refreshExpiresAt:data.refreshExpiresAt };
    }
  })],
  callbacks: {
    async jwt({token,user}) {
      if(user) {token.sub=user.id;token.email=user.email;token.accessToken=user.accessToken;token.refreshToken=user.refreshToken;token.accessExpiresAt=user.accessExpiresAt;token.refreshExpiresAt=user.refreshExpiresAt;}
      return token;
    },
    async session({session,token}) {
      if(session.user) {session.user.id=token.sub as string;session.user.email=token.email as string | null;}
      return session;
    }
  },
  pages: { signIn: '/auth/login' },
  secret: process.env.NEXTAUTH_SECRET,
};
export default authOptions;
