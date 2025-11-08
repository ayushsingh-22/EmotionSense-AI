'use client';

import { ReactNode, memo } from 'react';
import { useSidebar } from '@/contexts/SidebarContext';
import { cn } from '@/lib/utils';

interface MainContentProps {
  children: ReactNode;
}

/**
 * Memoized main content wrapper to prevent rerenders on route changes
 * Handles responsive layout, sidebar offset, and smooth transitions
 */
export const MainContent = memo(function MainContent({ children }: MainContentProps) {
  const { isCollapsed } = useSidebar();

  return (
    <main 
      className={cn(
        // Base layout
        "flex-1 transition-all duration-300",
        
        // Responsive top padding (accounting for fixed navbar)
        "pt-16 sm:pt-20",
        
        // Responsive horizontal padding
        "px-2 sm:px-4 md:px-6 lg:px-8",
        
        // Sidebar offset - smooth transition when collapsed/expanded
        isCollapsed ? "lg:pl-20" : "lg:pl-72",
        
        // Theme-aware background color with smooth transition
        "bg-background dark:bg-background",
        
        // Smooth color transitions for dark mode switching
        "transition-colors duration-300"
      )}
    >
      <div
        className={cn(
          // Container layout
          "w-full h-full",
          
          // Centering with max-width constraint
          "mx-auto",
          "max-w-7xl",
          
          // Responsive vertical padding
          "py-4 sm:py-6 lg:py-8",
          
          // Consistent spacing between content sections
          "space-y-4",
          
          // Improved rendering performance
          "will-change-auto"
        )}
      >
        {children}
      </div>
    </main>
  );
});