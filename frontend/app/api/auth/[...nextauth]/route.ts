import NextAuth from 'next-auth';
import type { NextRequest } from 'next/server';
import { authOptions } from '@/lib/authOptions';

const handler = NextAuth(authOptions);

// Session reads must not race with the access-token route and overwrite a rotated cookie.
export async function GET(request: NextRequest, context: { params: Promise<{ nextauth: string[] }> }) {
  const response=await handler(request, context);
  if(request.nextUrl.pathname.endsWith('/session')) response.headers.delete('set-cookie');
  return response;
}
export async function POST(request: NextRequest, context: { params: Promise<{ nextauth: string[] }> }) {
  const response=await handler(request, context);
  if(request.nextUrl.pathname.endsWith('/session')) response.headers.delete('set-cookie');
  return response;
}
