import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { prisma } from '@/lib/prisma';

/**
 * Returns the authenticated user's own emotion-tagged messages, scoped by
 * an optional date range and/or emotion filter. Replaces direct
 * `supabase.from('messages').select(...)` reads previously done client-side
 * from components/emotions/SessionStats.tsx and
 * components/profile/EmotionAnalytics.tsx.
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const range = searchParams.get('range'); // '7days' | '30days' | 'lifetime' | null
  const emotion = searchParams.get('emotion'); // specific emotion or null/'all'

  const where: Record<string, unknown> = {
    userId: session.user.id,
    role: 'user',
    emotion: { not: null },
  };

  if (range === '7days' || range === '30days') {
    const days = range === '7days' ? 7 : 30;
    const since = new Date();
    since.setDate(since.getDate() - days);
    where.createdAt = { gte: since };
  }

  if (emotion && emotion !== 'all') {
    where.emotion = emotion;
  }

  try {
    const messages = await prisma.message.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        emotion: true,
        emotionConfidence: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      messages: messages.map((m) => ({
        id: m.id,
        emotion: m.emotion,
        emotion_confidence: m.emotionConfidence,
        created_at: m.createdAt,
      })),
    });
  } catch (error) {
    console.error('Error fetching emotion history:', error);
    return NextResponse.json({ error: 'Failed to fetch emotion history' }, { status: 500 });
  }
}
