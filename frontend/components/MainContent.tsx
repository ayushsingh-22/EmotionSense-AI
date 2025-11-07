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
        "flex-1 transition-all duration-300",
        "pt-16 sm:pt-20", // Responsive top padding
        "px-2 sm:px-4 md:px-6 lg:px-8", // Responsive horizontal padding
        isCollapsed ? "lg:pl-20" : "lg:pl-72", // Sidebar offset
        "bg-background", // Theme-aware background
        "dark:bg-background" // Dark mode background
      )}
    >
      <div className={cn(
        "w-full h-full",
        "mx-auto",
        "max-w-7xl", // Maximum width constraint
        "py-4 sm:py-6 lg:py-8", // Responsive vertical padding
        "space-y-4" // Consistent spacing between children
      )}>
        {children}
      </div>
    </main>
  );
}