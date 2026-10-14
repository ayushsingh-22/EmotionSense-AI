import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { getBackendToken, BACKEND_TOKEN_TTL_SECONDS } from '@/lib/backendAuth';

export const dynamic = 'force-dynamic';

/**
 * Issues a short-lived bearer token for the Express API, for the currently
 * signed-in NextAuth user. The subject comes only from the server-side session,
 * never from the request. Same-origin only: NextAuth's session cookie is
 * SameSite=Lax and the response is not readable cross-origin.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }

  const token = await getBackendToken(session.user.id, session.user.email);
  return NextResponse.json(
    { token, expiresAt: Date.now() + BACKEND_TOKEN_TTL_SECONDS * 1000 },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
