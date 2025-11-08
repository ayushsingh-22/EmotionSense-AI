'use client';

import { memo } from 'react';

/**
 * Generic page loading skeleton - used during route transitions
 * Prevents layout shift by maintaining consistent height/spacing
 */
export const PageLoadingSkeleton = memo(function PageLoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse" role="status" aria-label="Loading content">
      {/* Header skeleton */}
      <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded-lg w-1/3" />
      
      {/* Content grid skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="h-40 bg-gray-200 dark:bg-gray-700 rounded-lg" />
        <div className="h-40 bg-gray-200 dark:bg-gray-700 rounded-lg" />
      </div>
      
      {/* Large content block skeleton */}
      <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-lg" />
      
      <span className="sr-only">Loading...</span>
    </div>
  );
});

/**
 * Chat message skeleton - optimized for quick rendering
 * Used when waiting for message responses
 */
export const MessageSkeleton = memo(function MessageSkeleton() {
  return (
    <div className="flex gap-4 px-4 py-6 animate-pulse" role="status" aria-label="Loading message">
      <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20" />
        <div className="space-y-2">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
        </div>
      </div>
      <span className="sr-only">Loading message...</span>
    </div>
  );
});

/**
 * Sidebar skeleton - matches sidebar layout
 * Prevents layout shift while sidebar is loading
 */
export const SidebarSkeleton = memo(function SidebarSkeleton() {
  return (
    <div className="w-80 h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 p-4">
      <div className="space-y-4 animate-pulse" role="status" aria-label="Loading sidebar">
        {/* Header button */}
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded" />
        
        {/* Navigation items */}
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 bg-gray-200 dark:bg-gray-700 rounded" />
        ))}
      </div>
      <span className="sr-only">Loading sidebar...</span>
    </div>
  );
});

/**
 * Card skeleton - reusable for any card content
 */
export const CardSkeleton = memo(function CardSkeleton() {
  return (
    <div className="animate-pulse" role="status" aria-label="Loading card">
      <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4" />
      <div className="space-y-3">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-4/6" />
      </div>
      <span className="sr-only">Loading card...</span>
    </div>
  );
});

/**
 * Minimal navbar skeleton - quick load placeholder
 */
export const NavbarSkeleton = memo(function NavbarSkeleton() {
  return (
    <div className="h-16 bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-700 fixed top-0 w-full z-50 animate-pulse" role="status" aria-label="Loading navigation">
      <div className="container flex h-16 items-center justify-between px-4">
        <div className="w-40 h-8 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="flex gap-2">
          <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
      <span className="sr-only">Loading navigation...</span>
    </div>
  );
});
