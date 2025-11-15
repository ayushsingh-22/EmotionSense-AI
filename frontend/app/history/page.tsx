'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { getChatSessions, getChatMessages } from '@/lib/api';
import { ChatSession, ChatMessage } from '@/lib/supabase';
import { Search, MessageCircle, Calendar, ChevronRight, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { ChatMessage as ChatMessageComponent } from '@/components/chat/ChatMessage';
import { motion } from 'framer-motion';
import { GradientHeader } from '@/components/ui/GradientHeader';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { AnimatedIcon } from '@/components/ui/AnimatedIcon';

interface ExtendedChatSession extends ChatSession {
  lastMessage?: string;
  messageCount?: number;
}

export default function HistoryPage() {
  const [sessions, setSessions] = useState<ExtendedChatSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  
  const { user } = useAuth();

  const loadChatSessions = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      setIsLoading(true);
      const data = await getChatSessions(user.id);
      
      const enhancedSessions = await Promise.all(
        data.sessions.map(async (session: ChatSession) => {
          try {
            const messagesData = await getChatMessages(session.id, user.id);
            const sessionMessages = messagesData.messages || [];
            const lastEntry = sessionMessages[sessionMessages.length - 1];

            return {
              ...session,
              lastMessage: lastEntry?.message || lastEntry?.content || 'No messages',
              messageCount: sessionMessages.length
            };
          } catch (error) {
            console.error('Failed to load messages for session:', session.id, error);
            return {
              ...session,
              lastMessage: 'Failed to load',
              messageCount: 0
            };
          }
        })
      );
      
      // Filter out sessions with no messages (orphaned sessions)
      const sessionsWithMessages = enhancedSessions.filter(session => session.messageCount > 0);
      
      setSessions(sessionsWithMessages);
    } catch (error) {
      console.error('Failed to load chat sessions:', error);
      toast({
        title: "Error",
        description: "Failed to load chat history.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) {
      loadChatSessions();
    }
  }, [user?.id, loadChatSessions]);

  const loadSessionMessages = async (sessionId: string) => {
    if (!user?.id) return;
    
    try {
      const data = await getChatMessages(sessionId, user.id);
      setMessages(data.messages || []);
      setSelectedSession(sessionId);
    } catch (error) {
      console.error('Failed to load session messages:', error);
      toast({
        title: "Error",
        description: "Failed to load chat messages.",
        variant: "destructive"
      });
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return format(new Date(timestamp), 'MMM dd, yyyy HH:mm');
  };

  const filteredSessions = sessions.filter(session =>
    session.session_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    session.lastMessage?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="max-w-md border-0 shadow-2xl bg-white/80 dark:bg-gray-900/80 backdrop-blur-md">
          <CardContent className="pt-8 pb-8 text-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mx-auto mb-4">
              <MessageCircle className="h-8 w-8 text-white" />
            </div>
            <p className="text-muted-foreground text-lg">
              Please sign in to view your chat history.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6">
      <div className="flex items-center justify-between">
        <GradientHeader 
          title="Chat History"
          subtitle="Review your past conversations with MantrAI and track your emotional journey"
          icon={<Sparkles className="h-10 w-10 text-primary" />}
        />
        <Link href="/chat">
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 shadow-2xl hover:shadow-purple-500/50 transition-all duration-300 rounded-2xl">
              <MessageCircle className="mr-2 h-5 w-5" />
              New Chat
            </Button>
          </motion.div>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <GlassPanel gradient="from-purple-500/10" delay={0.2}>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <AnimatedIcon 
                  icon={<Calendar className="h-6 w-6" />}
                  gradient="from-purple-500 to-pink-600"
                  glowColor="rgba(168, 85, 247, 0.3)"
                />
                <h3 className="text-xl font-semibold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  Chat Sessions ({sessions.length})
                </h3>
              </div>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  placeholder="Search conversations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-12 h-12 rounded-2xl border-2 focus:border-primary/60 focus:ring-4 focus:ring-primary/20 transition-all duration-300 bg-background/80 backdrop-blur-sm"
                />
              </div>
              <ScrollArea className="h-[600px]">
                {isLoading ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    Loading chat history...
                  </div>
                ) : filteredSessions.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium mb-2">
                      {searchQuery ? 'No conversations found' : 'No chat history yet'}
                    </p>
                    <p className="text-sm">
                      {searchQuery ? 'Try a different search term' : 'Start a conversation to see it here'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredSessions.map((session, index) => (
                      <motion.div
                        key={session.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        whileHover={{ scale: 1.02, x: 4 }}
                      >
                        <Card
                          className={cn(
                            'cursor-pointer transition-all duration-300 border-2 rounded-2xl shadow-lg',
                            selectedSession === session.id 
                              ? 'bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-pink-500/10 border-primary/40 shadow-2xl shadow-primary/20' 
                              : 'bg-background/80 border-border/40 hover:border-primary/30 hover:shadow-xl backdrop-blur-sm'
                          )}
                          onClick={() => loadSessionMessages(session.id)}
                        >
                        <CardContent className="p-4">
                          <div className="space-y-3">
                            <div className="flex items-start justify-between">
                              <h3 className="font-semibold text-sm line-clamp-1">
                                {session.session_title}
                              </h3>
                              <ChevronRight className={cn(
                                "h-4 w-4 flex-shrink-0 transition-transform duration-300",
                                selectedSession === session.id ? "text-blue-500 rotate-90" : "text-muted-foreground"
                              )} />
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                              {session.lastMessage}
                            </p>
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">{formatTimestamp(session.created_at)}</span>
                              <span
                                className={cn(
                                  'rounded-full px-2 py-0.5 font-medium',
                                  selectedSession === session.id
                                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200'
                                    : 'bg-muted text-muted-foreground'
                                )}
                              >
                                {session.messageCount} msgs
                              </span>
                            </div>
                          </div>
                        </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </GlassPanel>
        </div>

        <div className="lg:col-span-2">
          <GlassPanel 
            gradient="from-blue-500/10"
            delay={0.3}
            className="h-[740px]"
          >
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <AnimatedIcon 
                  icon={<MessageCircle className="h-6 w-6" />}
                  gradient="from-blue-500 to-cyan-600"
                  glowColor="rgba(59, 130, 246, 0.3)"
                  delay={0.5}
                />
                <h3 className="text-xl font-semibold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                  {selectedSession ? 
                    sessions.find(s => s.id === selectedSession)?.session_title || 'Conversation' :
                    'Select a conversation'
                  }
                </h3>
              </div>
              {selectedSession ? (
                <ScrollArea className="h-[640px] p-6 bg-gradient-to-b from-primary/5 to-background rounded-2xl border border-border/30">
                  {messages.length === 0 ? (
                    <div className="text-center text-muted-foreground py-16">
                      <MessageCircle className="h-16 w-16 mx-auto mb-4 opacity-50" />
                      <p className="text-lg font-medium">No messages in this conversation</p>
                    </div>
                  ) : (
                    <div className="flex flex-col space-y-4">
                      {messages.map((message) => (
                        <ChatMessageComponent
                          key={message.id}
                          id={message.id}
                          message={(message.content || message.message) ?? ''}
                          role={message.role as 'user' | 'assistant'}
                          timestamp={message.created_at}
                          editable={false}
                        />
                      ))}
                    </div>
                  )}
                </ScrollArea>
              ) : (
                <div className="flex items-center justify-center h-[640px] text-muted-foreground">
                  <motion.div 
                    className="text-center"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                  >
                    <AnimatedIcon 
                      icon={<MessageCircle className="h-12 w-12" />}
                      gradient="from-blue-500 to-purple-600"
                      glowColor="rgba(59, 130, 246, 0.3)"
                      size="lg"
                      className="mx-auto mb-6"
                    />
                    <h3 className="text-2xl font-semibold mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Select a conversation</h3>
                    <p className="text-muted-foreground">Choose a conversation from the sidebar to view messages</p>
                  </motion.div>
                </div>
              )}
            </div>
          </GlassPanel>
        </div>
      </div>
    </div>
  );
}
