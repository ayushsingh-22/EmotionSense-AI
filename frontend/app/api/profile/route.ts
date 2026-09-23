import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  return NextResponse.json({
    id: user.id,
    email: user.email,
    full_name: user.fullName,
    avatar_url: user.avatarUrl,
    created_at: user.createdAt,
    updated_at: user.updatedAt,
  });
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const data: { fullName?: string; avatarUrl?: string } = {};

    if (typeof body.full_name === 'string') data.fullName = body.full_name;
    if (typeof body.fullName === 'string') data.fullName = body.fullName;
    if (typeof body.avatar_url === 'string') data.avatarUrl = body.avatar_url;
    if (typeof body.avatarUrl === 'string') data.avatarUrl = body.avatarUrl;

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data,
    });

    return NextResponse.json({
      id: user.id,
      email: user.email,
      full_name: user.fullName,
      avatar_url: user.avatarUrl,
      created_at: user.createdAt,
      updated_at: user.updatedAt,
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
