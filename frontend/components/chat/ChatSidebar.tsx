'use client';

import { useState, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Plus, 
  MessageCircle, 
  Edit2, 
  Trash2, 
  Check, 
  X,
  Clock,
  Search
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getChatSessions, updateChatSessionTitle, deleteChatSession } from '@/lib/api';
import { ChatSession } from '@/lib/supabase';
import { cn } from '@/lib/utils';

interface ChatSidebarProps {
  currentSessionId?: string;
  onSessionSelect: (sessionId: string) => void;
  onNewSession: () => void;
  className?: string;
  refreshTrigger?: number; // Add prop to trigger refresh when new session is created
}

export function ChatSidebar({ 
  currentSessionId, 
  onSessionSelect, 
  onNewSession, 
  className,
  refreshTrigger = 0
}: ChatSidebarProps) {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Load chat sessions
  useEffect(() => {
    loadSessions();
  }, [user, refreshTrigger]);

  const loadSessions = async () => {
    if (!user?.id) return;
    
    try {
      setLoading(true);
      const data = await getChatSessions(user.id);
      setSessions(data.sessions || []);
    } catch (error) {
      console.error('Failed to load chat sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNewSession = () => {
    // Don't create a session here - let the chat message handler create it
    // when the user sends their first message
    onNewSession();
  };

  const handleEditSession = (session: ChatSession) => {
    setEditingSessionId(session.id);
    setEditTitle(session.session_title);
  };

  const handleSaveTitle = async (sessionId: string) => {
    if (!user?.id || !editTitle.trim()) return;
    
    try {
      await updateChatSessionTitle(sessionId, user.id, editTitle.trim());
      setSessions(prev => 
        prev.map(s => 
          s.id === sessionId 
            ? { ...s, session_title: editTitle.trim() }
            : s
        )
      );
      setEditingSessionId(null);
      setEditTitle('');
    } catch (error) {
      console.error('Failed to update session title:', error);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!user?.id) return;
    
    if (!confirm('Are you sure you want to delete this chat session? This action cannot be undone.')) {
      return;
    }
    
    try {
      await deleteChatSession(sessionId, user.id);
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      
      // If we're deleting the current session, start a new one
      if (sessionId === currentSessionId) {
        onNewSession();
      }
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  };

  const handleCancelEdit = () => {
    setEditingSessionId(null);
    setEditTitle('');
  };

  const filteredSessions = sessions.filter(session =>
    session.session_title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
      return 'Today';
    } else if (diffDays === 2) {
      return 'Yesterday';
    } else if (diffDays <= 7) {
      return `${diffDays - 1} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  return (
    <div className={cn(
      "h-full flex flex-col bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 border-r border-gray-200 dark:border-gray-700",
      "w-80 min-w-[280px] max-w-[320px]", // Fixed width constraints
      className
    )}>
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-blue-500" />
            Chat History
          </h2>
          <Button
            onClick={handleNewSession}
            size="sm"
            className="gap-2 bg-blue-500 hover:bg-blue-600 text-white shadow-sm"
          >
            <Plus className="h-4 w-4" />
            New
          </Button>
        </div>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-white/80 dark:bg-gray-800/80 border-gray-200 dark:border-gray-600"
          />
        </div>
      </div>

      {/* Sessions List */}
      <ScrollArea className="flex-1 bg-white/30 dark:bg-gray-800/30">
        <div className="p-3">
          {loading ? (
            <div className="text-center text-muted-foreground py-8">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
              Loading conversations...
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">
                {searchTerm ? 'No conversations found' : 'No conversations yet'}
              </p>
              {!searchTerm && (
                <p className="text-xs mt-1 opacity-70">
                  Start a new chat to begin
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredSessions.map((session) => (
                <Card
                  key={session.id}
                  className={cn(
                    'cursor-pointer transition-all duration-200 hover:bg-accent hover:shadow-md group',
                    'border-gray-200 dark:border-gray-600 bg-white/60 dark:bg-gray-800/60',
                    currentSessionId === session.id && 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-500 shadow-sm'
                  )}
                  onClick={() => !editingSessionId && onSessionSelect(session.id)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0 pr-2">
                        {editingSessionId === session.id ? (
                          <div className="flex items-center gap-2">
                            <Input
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleSaveTitle(session.id);
                                } else if (e.key === 'Escape') {
                                  handleCancelEdit();
                                }
                              }}
                              className="h-7 text-sm bg-white dark:bg-gray-700"
                              autoFocus
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleSaveTitle(session.id)}
                              className="h-7 w-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                            >
                              <Check className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={handleCancelEdit}
                              className="h-7 w-7 p-0 text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-start gap-2 mb-2">
                              <MessageCircle className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                              <h3 className="font-medium text-sm text-gray-900 dark:text-gray-100 break-words leading-tight">
                                {session.session_title}
                              </h3>
                            </div>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground ml-6">
                              <Clock className="h-3 w-3 flex-shrink-0" />
                              <span className="truncate">
                                {formatDate(session.updated_at)}
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                      
                      {!editingSessionId && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditSession(session);
                            }}
                            className="h-7 w-7 p-0 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                          >
                            <Edit2 className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteSession(session.id);
                            }}
                            className="h-7 w-7 p-0 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
      
      {/* Footer */}
      <div className="flex-shrink-0 p-4 border-t border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50">
        <div className="text-xs text-center">
          <div className="text-muted-foreground mb-1">
            {sessions.length} conversation{sessions.length !== 1 ? 's' : ''}
          </div>
          <div className="text-xs text-blue-600 dark:text-blue-400 font-medium">
            MantrAI • Empathetic Support
          </div>
        </div>
      </div>
    </div>
  );
}