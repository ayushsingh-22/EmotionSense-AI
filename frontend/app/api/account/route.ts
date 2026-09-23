import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { prisma } from '@/lib/prisma';

/**
 * Deletes the authenticated user's account entirely. Every domain table
 * (ChatSession, Message, EmergencyContact, SafetyAlert, EmotionAnalysis,
 * etc.) has `onDelete: Cascade` on its relation to User, so a single delete
 * here cascades through all of the user's data — this replaces the old
 * Supabase flow of separately deleting chat_messages/chat_sessions/profiles.
 */
export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    await prisma.user.delete({ where: { id: session.user.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting account:', error);
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
  }
}
