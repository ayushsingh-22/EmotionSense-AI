import { NextRequest, NextResponse } from 'next/server';
import { backendUrl } from '@/lib/backendAuthClient';
import { backendRegisterBody, isRegisterErrorCode } from '@/lib/registerContract';

export async function POST(req: NextRequest) {
  const headers = { 'Cache-Control': 'no-store' };
  try {
    if (Number(req.headers.get('content-length') || 0) > 8192) return NextResponse.json({ error: 'Invalid request' }, { status: 413, headers });
    const raw = await req.text();
    if (new TextEncoder().encode(raw).byteLength > 8192) return NextResponse.json({ error: 'Invalid request' }, { status: 413, headers });
    let body: Record<string, unknown>;
    try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400, headers }); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'Invalid request' }, { status: 400, headers });
    const result = await fetch(`${backendUrl()}/api/auth/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(backendRegisterBody(body)),
      cache: 'no-store', signal: AbortSignal.timeout(20000)
    });
    if (result.status === 202) return NextResponse.json({ message: 'If eligible, instructions will be sent.' }, { status: 202, headers });
    if (result.status >= 500) return NextResponse.json({ error: 'Service temporarily unavailable' }, { status: 503, headers });
    // Pass through only allowlisted validation codes; an older backend sends none and the
    // browser falls back to the generic message.
    let code: unknown;
    try { code = (await result.json())?.code; } catch { code = undefined; }
    return NextResponse.json({ error: 'Invalid request', ...(isRegisterErrorCode(code) ? { code } : {}) }, { status: result.status, headers });
  } catch { return NextResponse.json({ error: 'Service temporarily unavailable' }, { status: 503, headers }); }
}
