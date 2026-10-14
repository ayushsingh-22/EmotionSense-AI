import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { validateNewPassword } from '@/lib/passwordPolicy';
import { authLimits, clientIp, consume, hashPart } from '@/lib/rateLimit';
import { emailInUse, isPlausibleEmail, normalizeEmail } from '@/lib/accountLookup';

const NO_STORE = { 'Cache-Control': 'no-store' };
const MAX_BODY_BYTES = 8 * 1024;
// New accounts use cost 12; existing cost-10 hashes keep verifying unchanged.
const BCRYPT_COST_NEW = 12;

/**
 * Deliberately neutral wording. Without an email-verification step (not built yet)
 * a registration for an already-registered address cannot be made indistinguishable
 * from success, so the defence here is: neutral message, identical response time
 * (the password is hashed before the existence check), and strict throttling of
 * both IP and target address (see lib/rateLimit.ts) — full removal of the
 * oracle needs email verification (Phase 2B).
 */
const UNABLE_TO_CREATE =
  "We couldn't create an account with those details. If you already have an account, please sign in or reset your password.";

const json = (body: unknown, status: number, extra: Record<string, string> = {}) =>
  NextResponse.json(body, { status, headers: { ...NO_STORE, ...extra } });

export async function POST(request: NextRequest) {
  const limits = authLimits();

  // 1. Throttle by IP before doing any work (including parsing / hashing).
  const ip = clientIp(request.headers);
  const ipRl = await consume(`reg:ip:${hashPart(ip)}`, limits.registerPerIp);
  if (!ipRl.allowed) {
    return json({ error: 'Too many sign-up attempts. Please try again later.' }, 429, { 'Retry-After': String(ipRl.retryAfterSec) });
  }

  try {
    // 2. Bounded, defensive body parsing.
    const declared = Number(request.headers.get('content-length') ?? 0);
    if (declared > MAX_BODY_BYTES) return json({ error: 'Request too large' }, 413);
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) return json({ error: 'Request too large' }, 413);
    let body: Record<string, unknown> = {};
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) body = parsed as Record<string, unknown>;
    } catch {
      return json({ error: 'Invalid request' }, 400);
    }

    // 3. Field validation (format problems are about the caller's own input, not about other accounts).
    const email = typeof body.email === 'string' ? normalizeEmail(body.email) : '';
    if (!email || !isPlausibleEmail(email)) return json({ error: 'Please enter a valid email address.' }, 400);

    let fullName: string | null = null;
    if (body.fullName !== undefined && body.fullName !== null) {
      if (typeof body.fullName !== 'string') return json({ error: 'Invalid name.' }, 400);
      // eslint-disable-next-line no-control-regex
      fullName = body.fullName.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 100) || null;
    }

    const policy = validateNewPassword(body.password, { email, fullName: fullName ?? undefined });
    if (!policy.ok) return json({ error: policy.reason }, 400);
    const password = body.password as string;

    // 4. Per-target throttle: stops a single address being probed or flooded.
    const emailRl = await consume(`reg:email:${hashPart(email)}`, limits.registerPerEmail);
    if (!emailRl.allowed) {
      return json({ error: 'Too many sign-up attempts. Please try again later.' }, 429, { 'Retry-After': String(emailRl.retryAfterSec) });
    }

    // 5. Always pay the hashing cost first so "exists" and "new" take comparable time.
    const passwordHash = await bcrypt.hash(password, BCRYPT_COST_NEW);

    if (await emailInUse(email)) return json({ error: UNABLE_TO_CREATE }, 409);

    let user;
    try {
      user = await prisma.user.create({ data: { email, passwordHash, fullName } });
    } catch (error) {
      // Lost a race with a concurrent registration of the same address.
      if ((error as { code?: string })?.code === 'P2002') return json({ error: UNABLE_TO_CREATE }, 409);
      throw error;
    }

    return json(
      { user: { id: user.id, email: user.email, fullName: user.fullName, avatarUrl: user.avatarUrl, createdAt: user.createdAt } },
      201
    );
  } catch (error) {
    // Internal detail goes to the server log only (Vercel logs), never to the client.
    console.error('Error registering user:', error instanceof Error ? error.message : 'unknown error');
    return json({ error: 'Failed to create account' }, 500);
  }
}
