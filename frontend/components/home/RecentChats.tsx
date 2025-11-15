'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { EMOTION_CONFIG, type EmotionType } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { MessageCircle, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

interface ChatSession {
  id: string;
  session_title: string;
  created_at: string;
  updated_at: string;
  dominant_emotion: string;
  message_count: number;
  preview: string;
}

interface RecentChatsProps {
  userId: string;
}

export function RecentChats({ userId }: RecentChatsProps) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchRecentSessions = async () => {
      if (!userId) return;

      try {
        setIsLoading(true);

        // Fetch last 3 chat sessions
        const { data: sessionsData, error: sessionsError } = await supabase
          .from('chat_sessions')
          .select('*')
          .eq('user_id', userId)
          .order('updated_at', { ascending: false })
          .limit(3);

        if (sessionsError) {
          console.error('Error fetching sessions:', sessionsError);
          return;
        }

        if (!sessionsData || sessionsData.length === 0) {
          setSessions([]);
          return;
        }

        // For each session, get messages to calculate dominant emotion and preview
        const sessionsWithDetails = await Promise.all(
          sessionsData.map(async (session) => {
            const { data: messages, error: messagesError } = await supabase
              .from('chat_messages')
              .select('*')
              .eq('session_id', session.id)
              .order('created_at', { ascending: false })
              .limit(10);

            if (messagesError || !messages || messages.length === 0) {
              return {
                id: session.id,
                session_title: session.session_title || 'Untitled Chat',
                created_at: session.created_at,
                updated_at: session.updated_at,
                dominant_emotion: 'neutral',
                message_count: 0,
                preview: 'No messages yet',
              };
            }

            // Calculate dominant emotion from user messages
            const emotionCounts: Record<string, number> = {};
            messages.forEach((msg) => {
              if (msg.role === 'user' && msg.emotion) {
                const emotion = msg.emotion;
                emotionCounts[emotion] = (emotionCounts[emotion] || 0) + 1;
              }
            });

            const dominantEmotion =
              Object.entries(emotionCounts).sort(([, a], [, b]) => b - a)[0]?.[0] || 'neutral';

            // Get preview from the first user message
            const firstUserMessage = messages.find((msg) => msg.role === 'user');
            const preview = firstUserMessage
              ? (firstUserMessage.content || firstUserMessage.message || '').slice(0, 80) + ((firstUserMessage.content || firstUserMessage.message || '').length > 80 ? '...' : '')
              : 'No messages yet';

            return {
              id: session.id,
              session_title: session.session_title || 'Untitled Chat',
              created_at: session.created_at,
              updated_at: session.updated_at,
              dominant_emotion: dominantEmotion,
              message_count: messages.length,
              preview,
            };
          })
        );

        setSessions(sessionsWithDetails);
      } catch (error) {
        console.error('Error fetching recent sessions:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecentSessions();
  }, [userId]);

  const getEmotionConfig = (emotion: string) => {
    return EMOTION_CONFIG[emotion as EmotionType] || { color: '#6B7280', emoji: '❓', bgColor: 'bg-gray-400' };
  };

  const handleSessionClick = (sessionId: string) => {
    router.push(`/history?session=${sessionId}`);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-4 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse">
            <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
            <div className="h-3 bg-gray-300 dark:bg-gray-700 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 mb-4">
          <MessageCircle className="h-8 w-8 text-gray-400" />
        </div>
        <p className="text-muted-foreground">No chat sessions yet</p>
        <p className="text-sm text-muted-foreground mt-1">Start a conversation to see your recent chats</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sessions.map((session, index) => {
        const config = getEmotionConfig(session.dominant_emotion);
        const timestamp = new Date(session.updated_at);

        return (
          <motion.div
            key={session.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
            whileHover={{ scale: 1.02, y: -2 }}
            onClick={() => handleSessionClick(session.id)}
            className="p-4 rounded-xl bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 border-2 border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 cursor-pointer transition-all duration-200 shadow-sm hover:shadow-lg group"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white flex-shrink-0"
                  style={{ backgroundColor: config.color }}
                >
                  <MessageCircle className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100 line-clamp-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {session.session_title}
                  </h4>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(timestamp, { addSuffix: true })}
                    </span>
                    <span className="text-xs text-muted-foreground">•</span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{session.message_count} messages</span>
                  </div>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:translate-x-1 transition-all flex-shrink-0 ml-3" />
            </div>

            <div className="flex items-start gap-3 mt-3">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: config.color + '20' }}>
                <span className="text-lg leading-none">{config.emoji}</span>
                <span className="text-xs font-medium capitalize whitespace-nowrap" style={{ color: config.color }}>
                  {session.dominant_emotion}
                </span>
              </div>
            </div>

            <p className="text-sm text-muted-foreground mt-3 line-clamp-2 leading-relaxed break-words">{session.preview}</p>
          </motion.div>
        );
      })}
    </div>
  );
}
