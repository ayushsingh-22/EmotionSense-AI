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
import { getChatSessions, createChatSession, updateChatSessionTitle, deleteChatSession } from '@/lib/api';
import { ChatSession } from '@/lib/supabase';
import { cn } from '@/lib/utils';

interface ChatSidebarProps {
  currentSessionId?: string;
  onSessionSelect: (sessionId: string) => void;
  onNewSession: () => void;
  className?: string;
}

export function ChatSidebar({ 
  currentSessionId, 
  onSessionSelect, 
  onNewSession, 
  className 
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
  }, [user]);

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

  const handleNewSession = async () => {
    if (!user?.id) return;
    
    try {
      const newSession = await createChatSession(user.id, 'New Chat');
      setSessions(prev => [newSession, ...prev]);
      onNewSession();
    } catch (error) {
      console.error('Failed to create session:', error);
    }
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
    <div className={cn('h-full flex flex-col bg-background border-r', className)}>
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Chat History</h2>
          <Button
            onClick={handleNewSession}
            size="sm"
            className="gap-2"
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
            className="pl-9"
          />
        </div>
      </div>

      {/* Sessions List */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {loading ? (
            <div className="text-center text-muted-foreground py-8">
              Loading conversations...
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              {searchTerm ? 'No conversations found' : 'No conversations yet'}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredSessions.map((session) => (
                <Card
                  key={session.id}
                  className={cn(
                    'cursor-pointer transition-colors hover:bg-accent',
                    currentSessionId === session.id && 'bg-accent border-primary'
                  )}
                  onClick={() => !editingSessionId && onSessionSelect(session.id)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
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
                              className="h-7 text-sm"
                              autoFocus
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleSaveTitle(session.id)}
                              className="h-7 w-7 p-0"
                            >
                              <Check className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={handleCancelEdit}
                              className="h-7 w-7 p-0"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-2 mb-2">
                              <MessageCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              <h3 className="font-medium text-sm truncate">
                                {session.session_title}
                              </h3>
                            </div>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {formatDate(session.updated_at)}
                            </div>
                          </>
                        )}
                      </div>
                      
                      {!editingSessionId && (
                        <div className="flex items-center gap-1 ml-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditSession(session);
                            }}
                            className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
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
                            className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
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
      <div className="p-4 border-t">
        <div className="text-xs text-muted-foreground text-center">
          {sessions.length} conversation{sessions.length !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  );
}