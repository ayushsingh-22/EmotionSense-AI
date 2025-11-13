'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import {
  getChatSessions,
  updateChatSessionTitle,
  deleteChatSession,
} from '@/lib/api';
import { ChatSession } from '@/lib/supabase';
import { ThemeToggle } from '@/components/theme-toggle';

import {
  Plus,
  Trash2,
  Check,
  X,
  Search,
  History,
  UserCircle2,
  Settings,
  Star,
  StarOff,
  Pencil,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

/**
 * Advanced Chat Sidebar
 * - Favorites section with collapse/expand
 * - Automatic recency grouping (Today, Yesterday, This Week, Older)
 * - Favorites (persisted in localStorage)
 * - Hover preview
 *
 * Props mirror your prior component to be a drop-in replacement.
 */

interface Props {
  currentSessionId?: string;
  onSessionSelect: (sessionId: string) => void;
  onNewSession: () => void;
  className?: string;
  refreshTrigger?: number;
  isCollapsed?: boolean;
  closeMobile?: () => void;
}

const LS_KEYS = {
  FAVORITES: 'chat-sidebar-favs-v1',
  FAVORITES_COLLAPSED: 'chat-sidebar-fav-collapsed-v1',
};

function isToday(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}
function isYesterday(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  return (
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate()
  );
}
function isThisWeek(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay()); // sunday start
  return d >= startOfWeek;
}

export function AdvancedChatSidebar({
  currentSessionId,
  onSessionSelect,
  onNewSession,
  className,
  refreshTrigger = 0,
  isCollapsed = false,
  closeMobile,
}: Props) {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);

  // UI state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [query, setQuery] = useState('');

  // favorites persisted in localStorage
  const [favorites, setFavorites] = useState<Record<string, boolean>>(
    () => JSON.parse(localStorage.getItem(LS_KEYS.FAVORITES) || '{}') || {}
  );
  const [favoritesCollapsed, setFavoritesCollapsed] = useState<boolean>(
    () => JSON.parse(localStorage.getItem(LS_KEYS.FAVORITES_COLLAPSED) || 'false')
  );

  // load sessions
  const loadSessions = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const data = await getChatSessions(user.id);
      const items: ChatSession[] = data.sessions || [];
      setSessions(items);
    } catch (err) {
      console.error('loadSessions error', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions, refreshTrigger]);

  // persist favorites
  useEffect(() => {
    localStorage.setItem(LS_KEYS.FAVORITES, JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    localStorage.setItem(LS_KEYS.FAVORITES_COLLAPSED, JSON.stringify(favoritesCollapsed));
  }, [favoritesCollapsed]);

  // handlers
  const handleNew = useCallback(() => {
    onNewSession();
    closeMobile?.();
  }, [onNewSession, closeMobile]);

  const startEdit = useCallback((s: ChatSession) => {
    setEditingId(s.id);
    setEditText(s.session_title);
  }, []);

  const saveEdit = useCallback(async (sessionId: string) => {
    if (!user?.id || !editText.trim()) return;
    try {
      await updateChatSessionTitle(sessionId, user.id, editText.trim());
      setSessions((prev) => prev.map((p) => (p.id === sessionId ? { ...p, session_title: editText.trim() } : p)));
      setEditingId(null);
      setEditText('');
    } catch (err) {
      console.error('saveEdit error', err);
    }
  }, [user, editText]);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditText('');
  }, []);

  const removeSession = useCallback(async (sessionId: string) => {
    if (!user?.id) return;
    if (!confirm('Delete this chat session? This action cannot be undone.')) return;
    try {
      await deleteChatSession(sessionId, user.id);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (sessionId === currentSessionId) onNewSession();
      closeMobile?.();
    } catch (err) {
      console.error('removeSession error', err);
    }
  }, [user, currentSessionId, onNewSession, closeMobile]);

  const toggleFav = useCallback((id: string) => {
    setFavorites((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      return next;
    });
  }, []);
  const filteredSessions = useMemo(() => {
    const qLower = query.trim().toLowerCase();
    const sortedByUpdate = [...sessions].sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
    if (!qLower) return sortedByUpdate;
    return sortedByUpdate.filter((s) => s.session_title.toLowerCase().includes(qLower));
  }, [sessions, query]);

  const favoriteSessions = useMemo(
    () => filteredSessions.filter((session) => favorites[session.id]),
    [filteredSessions, favorites]
  );

  const regularSessions = useMemo(
    () => filteredSessions.filter((session) => !favorites[session.id]),
    [filteredSessions, favorites]
  );

  const categorized = useMemo(() => {
    const groups: Record<string, ChatSession[]> = {
      Today: [],
      Yesterday: [],
      'This Week': [],
      Older: [],
    };

    regularSessions.forEach((session) => {
      if (isToday(session.updated_at)) groups.Today.push(session);
      else if (isYesterday(session.updated_at)) groups.Yesterday.push(session);
      else if (isThisWeek(session.updated_at)) groups['This Week'].push(session);
      else groups.Older.push(session);
    });

    return groups;
  }, [regularSessions]);

  const toggleFavoritesSection = useCallback(() => {
    setFavoritesCollapsed((prev) => !prev);
  }, []);

  // hover preview content (simulate: we'll show first 2 lines from session.preview or session.last_message if available)
  const renderPreview = useCallback((session: ChatSession) => {
    const extended = session as ChatSession & { preview?: string; last_message?: string };
    const text = extended.preview || extended.last_message || session.session_title || '';
    const lines = text.split('\n').slice(0, 2).join(' ');
    return lines;
  }, []);

  // small helpers
  const formatDateShort = useCallback((d: string) => {
    const dt = new Date(d);
    return dt.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }, []);

  const renderSessionCard = useCallback((session: ChatSession) => {
    const active = session.id === currentSessionId;
    const isEditing = editingId === session.id;
    const isFavorite = Boolean(favorites[session.id]);

    const handleSelect = () => {
      if (isEditing) return;
      onSessionSelect(session.id);
      closeMobile?.();
    };

    return (
      <div
        key={session.id}
        onClick={handleSelect}
        className={cn(
          'group rounded-lg border border-border/60 bg-background/70 px-3 py-3 transition hover:border-primary/50 hover:bg-primary/5 dark:bg-gray-900/40',
          active && 'border-primary/60 bg-primary/10 dark:border-primary/40'
        )}
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex-none">
            <div className={cn(
              'flex h-8 w-8 items-center justify-center rounded-md text-xs font-semibold uppercase',
              active ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
            )}>
              {session.session_title.slice(0, 2)}
            </div>
          </div>

          <div className="min-w-0 flex-1 space-y-2">
            {isEditing ? (
              <div className="flex items-center gap-2">
                <Input
                  value={editText}
                  onChange={(event) => setEditText(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') saveEdit(session.id);
                    if (event.key === 'Escape') cancelEdit();
                  }}
                  autoFocus
                  className="h-8 text-sm"
                />
                <Button size="icon" variant="ghost" onClick={() => saveEdit(session.id)} className="h-7 w-7">
                  <Check className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" onClick={cancelEdit} className="h-7 w-7">
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <>
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground leading-5 break-words whitespace-normal">
                      {session.session_title}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground/90 leading-4 break-words whitespace-normal">
                      {renderPreview(session)}
                    </p>
                  </div>
                  <div className="flex-none text-xs text-muted-foreground">
                    {formatDateShort(session.updated_at)}
                  </div>
                </div>
                <div className="flex items-center gap-2 opacity-0 transition group-hover:opacity-100">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={(event) => {
                      event.stopPropagation();
                      startEdit(session);
                    }}
                    className="h-7 w-7"
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleFav(session.id);
                    }}
                    className="h-7 w-7"
                  >
                    {isFavorite ? <Star className="h-3.5 w-3.5 text-yellow-500" /> : <StarOff className="h-3.5 w-3.5" />}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={(event) => {
                      event.stopPropagation();
                      removeSession(session.id);
                    }}
                    className="h-7 w-7"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }, [cancelEdit, closeMobile, currentSessionId, editText, editingId, favorites, formatDateShort, onSessionSelect, removeSession, renderPreview, saveEdit, setEditText, startEdit, toggleFav]);

  // quick links
  const quickLinks = useMemo(() => [
    { href: '/history', icon: History, label: 'History' },
    { href: '/profile', icon: UserCircle2, label: 'Profile' },
    { href: '/settings', icon: Settings, label: 'Settings' },
  ], []);

  // collapsed UI (icons only)
  if (isCollapsed) {
    return (
      <div className={cn('flex h-full w-full flex-col items-center gap-4 py-4 bg-gradient-to-b from-muted/40 to-background', className)}>
        <Button onClick={handleNew} size="icon" className="h-10 w-10 rounded-xl bg-primary text-primary-foreground shadow-md" title="New chat">
          <Plus className="h-4 w-4" />
        </Button>

        <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl text-muted-foreground hover:text-destructive"
          onClick={() => currentSessionId && removeSession(currentSessionId)} disabled={!currentSessionId} title="Clear conversation">
          <Trash2 className="h-4 w-4" />
        </Button>

        <ScrollArea className="flex-1 w-full px-1">
          <div className="flex flex-col items-center gap-3 p-2">
            {filteredSessions.map((s) => {
              const active = s.id === currentSessionId;
              return (
                <button
                  key={s.id}
                  onClick={() => { onSessionSelect(s.id); closeMobile?.(); }}
                  title={s.session_title}
                  className={cn('h-10 w-10 flex items-center justify-center rounded-xl text-xs font-semibold uppercase transition', active ? 'bg-indigo-500/20 text-indigo-600' : 'text-muted-foreground')}
                >
                  {s.session_title.slice(0, 2)}
                </button>
              );
            })}
          </div>
        </ScrollArea>

        <ThemeToggle />
      </div>
    );
  }

  // Render full advanced sidebar
  return (
    <div className={cn('h-full flex flex-col bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-950 border-r border-gray-200 dark:border-gray-800', className)}>
      {/* HEADER */}
      <div className="p-4 space-y-3 flex-shrink-0">
        <div className="flex gap-2">
          <Button onClick={handleNew} size="sm" className="flex-1 rounded-lg bg-primary text-primary-foreground shadow hover:shadow-md">
            <Plus className="h-4 w-4" />
            New Chat
          </Button>
          <Button size="sm" variant="outline" onClick={() => currentSessionId && removeSession(currentSessionId)} disabled={!currentSessionId} className="w-12">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Input
            placeholder="Search chats"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 h-10 bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
        </div>
      </div>

      {/* CONTENT */}
      <ScrollArea className="flex-1">
        <div className="px-3 pb-2 space-y-3">
          {loading ? (
            <div className="py-8 text-center text-muted-foreground">Loading...</div>
          ) : filteredSessions.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">No chats yet</div>
          ) : (
            <div className="space-y-4">
              {favoriteSessions.length > 0 && (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={toggleFavoritesSection}
                    className="flex w-full items-center justify-between rounded-md bg-amber-500/10 px-3 py-2 text-sm font-semibold text-amber-600 hover:bg-amber-500/20 dark:text-amber-400"
                  >
                    <span className="flex items-center gap-2">
                      <Star className="h-4 w-4" />
                      Favorites
                      <span className="text-xs font-normal text-muted-foreground">{favoriteSessions.length}</span>
                    </span>
                    {favoritesCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                  {!favoritesCollapsed && (
                    <div className="space-y-2">
                      {favoriteSessions.map((session) => renderSessionCard(session))}
                    </div>
                  )}
                </div>
              )}

              {Object.entries(categorized).map(([category, items]) => (
                items.length > 0 && (
                  <div key={category} className="space-y-2">
                    <div className="px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
                      {category}
                    </div>
                    <div className="space-y-2">
                      {items.map((session) => renderSessionCard(session))}
                    </div>
                  </div>
                )
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* FOOTER */}
      <div className="border-t border-gray-200/60 dark:border-gray-800/60 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {quickLinks.map(({ href, icon: Icon, label }) => (
            <Link key={href} href={href} onClick={closeMobile} title={label}>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg text-muted-foreground hover:text-primary">
                <Icon className="h-4 w-4" />
              </Button>
            </Link>
          ))}
        </div>

        <ThemeToggle />
      </div>
    </div>
  );
}

export const ChatSidebar = AdvancedChatSidebar;
