'use client';

import {
  ReactNode,
  RefObject,
  UIEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { motion, AnimatePresence } from 'framer-motion';
import { PanelLeftOpen, PanelLeftClose } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface SidebarRenderOptions {
  isCollapsed: boolean;
  isMobile: boolean;
  closeMobile: () => void;
}

type SidebarRenderer =
  | ReactNode
  | ((options: SidebarRenderOptions) => ReactNode);

interface ChatLayoutProps {
  children: ReactNode;
  sidebar: SidebarRenderer;
  input: ReactNode;
  header?: ReactNode;
  className?: string;
  sidebarFooter?: ReactNode;
  defaultCollapsed?: boolean;
  onSidebarToggle?: (collapsed: boolean) => void;
  contentRef?: RefObject<HTMLDivElement>;
  onContentScroll?: (event: UIEvent<HTMLDivElement>) => void;
}

/**
 * ChatGPT-style layout with proper scrolling, smooth transitions,
 * and optimized re-rendering — all original functionality preserved.
 */
export function ChatLayout({
  children,
  sidebar,
  input,
  header,
  className,
  sidebarFooter,
  defaultCollapsed = false,
  onSidebarToggle,
  contentRef,
  onContentScroll,
}: ChatLayoutProps) {
  const internalContentRef = useRef<HTMLDivElement>(null);
  const scrollRef = contentRef ?? internalContentRef;

  const [isMobile, setIsMobile] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // ---------------------
  // DETECT MOBILE + LOAD SIDEBAR STATE
  // ---------------------
  useEffect(() => {
    const update = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);

      if (mobile) return setIsCollapsed(false);

      const stored = localStorage.getItem('chat-sidebar-collapsed');
      if (stored !== null) {
        setIsCollapsed(JSON.parse(stored));
      } else {
        setIsCollapsed(defaultCollapsed);
      }
    };

    update();
    window.addEventListener('resize', update);

    return () => window.removeEventListener('resize', update);
  }, [defaultCollapsed]);

  const effectiveCollapsed = !isMobile && isCollapsed;

  // ---------------------
  // SIDEBAR TOGGLE
  // ---------------------
  const toggleSidebar = useCallback(() => {
    if (isMobile) {
      setMobileSidebarOpen((prev) => !prev);
      return;
    }
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('chat-sidebar-collapsed', JSON.stringify(next));
      onSidebarToggle?.(next);
      return next;
    });
  }, [isMobile, onSidebarToggle]);

  const closeMobileSidebar = useCallback(() => {
    setMobileSidebarOpen(false);
  }, []);

  // ---------------------
  // SIDEBAR CONTENT MEMO
  // ---------------------
  const sidebarContent = useMemo(() => {
    const renderer =
      typeof sidebar === 'function'
        ? sidebar({
            isCollapsed: effectiveCollapsed,
            isMobile,
            closeMobile: closeMobileSidebar,
          })
        : sidebar;

    return renderer;
  }, [sidebar, effectiveCollapsed, isMobile, closeMobileSidebar]);

  // ---------------------
  // SIDEBAR WIDTH CALC
  // ---------------------
  const sidebarWidth = useMemo(() => {
    if (isMobile) {
      if (typeof window === 'undefined') return 0;
      return mobileSidebarOpen ? Math.min(window.innerWidth, 360) : 0;
    }
    return effectiveCollapsed ? 60 : 280;
  }, [isMobile, mobileSidebarOpen, effectiveCollapsed]);

  // ---------------------
  // AUTO-SCROLL TO BOTTOM (ChatGPT behavior)
  // ---------------------
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;

    // Smooth scroll like ChatGPT
    scroller.scrollTo({
      top: scroller.scrollHeight,
      behavior: 'smooth',
    });
  }, [children, scrollRef]);

  return (
    <div
      className={cn(
        'relative flex h-[calc(100vh-4rem)] w-full overflow-hidden bg-background transition-colors',
        className
      )}
    >
      {isMobile && mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm"
          onClick={closeMobileSidebar}
          aria-hidden
        />
      )}

      {/* -----------------------------
         SIDEBAR (ANIMATED)
      ------------------------------ */}
      <AnimatePresence initial={false}>
        {(mobileSidebarOpen || !isMobile) && (
          <motion.aside
            key="chat-sidebar"
            initial={{ width: 0, opacity: isMobile ? 0 : 1 }}
            animate={{ width: sidebarWidth, opacity: 1 }}
            exit={{ width: 0, opacity: isMobile ? 0 : 1 }}
            transition={{ type: 'spring', stiffness: 240, damping: 28 }}
            className={cn(
              'flex h-full flex-col border-r border-border/60 bg-muted/40 backdrop-blur-sm',
              isMobile
                ? 'fixed left-0 top-16 z-40 shadow-2xl'
                : 'relative'
            )}
            style={{ pointerEvents: sidebarWidth === 0 ? 'none' : 'auto' }}
          >
            <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
              <span
                className={cn(
                  'text-sm font-semibold text-muted-foreground transition-opacity',
                  effectiveCollapsed ? 'opacity-0' : 'opacity-100'
                )}
              >
                Conversations
              </span>

              <Button
                variant="ghost"
                size="icon"
                onClick={toggleSidebar}
                className="h-8 w-8 rounded-full hover:bg-accent"
                title={effectiveCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                {effectiveCollapsed ? (
                  <PanelLeftOpen className="h-4 w-4" />
                ) : (
                  <PanelLeftClose className="h-4 w-4" />
                )}
              </Button>
            </div>

            <div
              className={cn(
                'flex-1 overflow-y-auto px-3 py-4',
                effectiveCollapsed && 'hidden'
              )}
            >
              {sidebarContent}
            </div>

            {sidebarFooter && (
              <div className="border-t border-border/60 px-3 py-4">
                {sidebarFooter}
              </div>
            )}
          </motion.aside>
        )}
      </AnimatePresence>

      {/* -----------------------------
         MAIN CONTENT AREA
      ------------------------------ */}
      <div className="flex min-w-0 flex-1 flex-col">
        {header && (
          <div className="flex items-center justify-between border-b border-border/60 bg-background/95 px-4 py-3 backdrop-blur">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleSidebar}
                className="h-9 w-9 rounded-full hover:bg-accent"
                title={
                  mobileSidebarOpen || !effectiveCollapsed
                    ? 'Hide sidebar'
                    : 'Show sidebar'
                }
              >
                {mobileSidebarOpen || !effectiveCollapsed ? (
                  <PanelLeftClose className="h-4 w-4" />
                ) : (
                  <PanelLeftOpen className="h-4 w-4" />
                )}
              </Button>

              <div className="min-w-0 flex-1">{header}</div>
            </div>
          </div>
        )}

        <div className="flex flex-1 flex-col overflow-hidden">
          {/* -----------------------------
              SCROLLABLE CHAT CONTENT
              FIXED SCROLLING + min-h-0
          ------------------------------ */}
          <div
            ref={scrollRef}
            onScroll={onContentScroll}
            className="flex-1 min-h-0 overflow-y-auto px-2 py-4 sm:px-4 md:px-6"
          >
            <div className="mx-auto max-w-3xl flex flex-col space-y-4">
              {children}
            </div>
          </div>

          {/* -----------------------------
              INPUT BAR (STICKY)
          ------------------------------ */}
          <div className="border-t border-border/60 bg-background/95 px-3 py-4 backdrop-blur">
            <div className="mx-auto max-w-3xl">{input}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
