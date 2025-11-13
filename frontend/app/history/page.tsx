'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { getChatSessions, getChatMessages } from '@/lib/api';
import { ChatSession, ChatMessage } from '@/lib/supabase';
import { Search, MessageCircle, Calendar, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { ChatMessage as ChatMessageComponent } from '@/components/chat/ChatMessage';

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

  useEffect(() => {
    if (user?.id) {
      loadChatSessions();
    }
  }, [user?.id]);

  const loadChatSessions = async () => {
    if (!user?.id) return;
    
    try {
      setIsLoading(true);
      const data = await getChatSessions(user.id);
      
      const enhancedSessions = await Promise.all(
        data.sessions.map(async (session: ChatSession) => {
          try {
            const messagesData = await getChatMessages(session.id, user.id);
            const sessionMessages = messagesData.messages || [];
            
            return {
              ...session,
              lastMessage: sessionMessages[sessionMessages.length - 1]?.message || 'No messages',
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
      
      setSessions(enhancedSessions);
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
  };

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

  const formatMessageTime = (timestamp: string) => {
    return format(new Date(timestamp), 'HH:mm');
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
    <div className="space-y-8">
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-purple-600/5 rounded-2xl"></div>
        <div className="relative bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm rounded-2xl p-8 border border-white/20">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Chat History
              </h1>
              <p className="text-muted-foreground mt-3 text-lg">
                Review your past conversations with MantrAI and track your emotional journey
              </p>
            </div>
            <Link href="/chat">
              <Button className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105">
                <MessageCircle className="mr-2 h-4 w-4" />
                New Chat
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <Card className="border-0 shadow-2xl bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-3 text-xl">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-calendar-500 to-calendar-600 flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-white" />
                </div>
                Chat Sessions ({sessions.length})
              </CardTitle>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search conversations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-12 h-12 rounded-xl border-2 focus:border-blue-500 transition-all duration-300"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
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
                  <div className="space-y-3 p-6">
                    {filteredSessions.map((session) => (
                      <Card
                        key={session.id}
                        className={cn(
                          'cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-105 border-0',
                          selectedSession === session.id 
                            ? 'bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 shadow-lg scale-105' 
                            : 'bg-white/80 dark:bg-gray-800/80 hover:bg-white dark:hover:bg-gray-800'
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
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card className="h-[740px] border border-border/60 bg-background/90 backdrop-blur rounded-3xl shadow-lg">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-3 text-xl">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                  <MessageCircle className="h-5 w-5 text-white" />
                </div>
                {selectedSession ? 
                  sessions.find(s => s.id === selectedSession)?.session_title || 'Conversation' :
                  'Select a conversation'
                }
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {selectedSession ? (
                <ScrollArea className="h-[640px] p-6 bg-gradient-to-b from-gray-50/40 to-white dark:from-gray-900/40 dark:to-gray-900">
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
                          message={message.message}
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
                  <div className="text-center">
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-600/20 flex items-center justify-center mx-auto mb-6">
                      <MessageCircle className="h-12 w-12 opacity-50" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">Select a conversation</h3>
                    <p>Choose a conversation from the sidebar to view messages</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
