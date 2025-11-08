'use client';

import { ReactNode, useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sidebar as SidebarIcon, X } from 'lucide-react';

interface ChatLayoutProps {
  children: ReactNode;
  sidebar: ReactNode;
  input: ReactNode;
  header?: ReactNode;
  className?: string;
}

export function ChatLayout({ 
  children, 
  sidebar, 
  input, 
  header,
  className 
}: ChatLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      // Auto-collapse sidebar on mobile
      if (window.innerWidth < 768) {
        setSidebarOpen(false);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Load sidebar state from localStorage on mount
  useEffect(() => {
    const savedState = localStorage.getItem('chat-sidebar-open');
    if (savedState !== null && !isMobile) {
      setSidebarOpen(JSON.parse(savedState));
    }
  }, [isMobile]);

  // Save sidebar state to localStorage
  const toggleSidebar = useCallback(() => {
    const newState = !sidebarOpen;
    setSidebarOpen(newState);
    if (!isMobile) {
      localStorage.setItem('chat-sidebar-open', JSON.stringify(newState));
    }
  }, [sidebarOpen, isMobile]);

  // Close sidebar when clicking overlay on mobile
  const closeSidebar = useCallback(() => {
    if (isMobile) {
      setSidebarOpen(false);
    }
  }, [isMobile]);

  return (
    <div className={cn(
      "h-[calc(100vh-4rem)] flex overflow-hidden bg-gradient-to-br from-gray-50/50 to-white dark:from-gray-900/50 dark:to-gray-900",
      className
    )}>
      {/* Mobile Overlay */}
      {isMobile && sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden" 
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <div className={cn(
        "relative z-50 transition-all duration-300 ease-in-out flex-shrink-0",
        "border-r border-gray-200/80 dark:border-gray-700/80 backdrop-blur-sm",
        isMobile ? (
          sidebarOpen 
            ? "fixed left-0 top-16 bottom-0 w-80 md:relative md:top-0" 
            : "fixed -left-80 top-16 bottom-0 w-80 md:relative md:top-0 md:left-0"
        ) : (
          sidebarOpen ? "w-80" : "w-0 overflow-hidden"
        )
      )}>
        <div className="h-full w-80 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm">
          {/* Mobile Close Button */}
          {isMobile && sidebarOpen && (
            <div className="flex justify-end p-4 border-b border-gray-200 dark:border-gray-700">
              <Button
                variant="ghost"
                size="sm"
                onClick={closeSidebar}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
          {sidebar}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        {header && (
          <div className="flex-shrink-0 flex items-center justify-between p-4 lg:p-6 border-b border-gray-200/80 dark:border-gray-700/80 bg-gradient-to-r from-white/90 to-gray-50/90 dark:from-gray-900/90 dark:to-gray-800/90 backdrop-blur-sm">
            <div className="flex items-center gap-4 min-w-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleSidebar}
                className="hover:bg-white/50 dark:hover:bg-gray-800/50 flex-shrink-0 transition-colors duration-200"
              >
                <SidebarIcon className="h-4 w-4" />
              </Button>
              {header}
            </div>
          </div>
        )}

        {/* Chat Messages Area */}
        <div className="flex-1 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-white/50 via-white/30 to-white/50 dark:from-gray-900/50 dark:via-gray-900/30 dark:to-gray-900/50">
            {children}
          </div>
        </div>

        {/* Input Area */}
        <div className="flex-shrink-0 border-t border-gray-200/80 dark:border-gray-700/80 bg-gradient-to-r from-white/90 to-gray-50/90 dark:from-gray-900/90 dark:to-gray-800/90 backdrop-blur-sm">
          {input}
        </div>
      </div>
    </div>
  );
}