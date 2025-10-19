'use client';

import { ReactNode } from 'react';
import { useSidebar } from '@/contexts/SidebarContext';
import { cn } from '@/lib/utils';

interface MainContentProps {
  children: ReactNode;
}

export function MainContent({ children }: MainContentProps) {
  const { isCollapsed } = useSidebar();

  return (
    <main 
      className={cn(
        "flex-1 pt-16 transition-all duration-300",
        isCollapsed ? "lg:pl-16" : "lg:pl-64"
      )}
    >
      <div className="container mx-auto px-4 py-6">
        {children}
      </div>
    </main>
  );
}