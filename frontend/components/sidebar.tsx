'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  History,
  Settings,
  MessageCircle,
  User,
  LogIn,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSidebar } from '@/contexts/SidebarContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const sidebarLinks = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Chat', href: '/chat', icon: MessageCircle },
  { name: 'History', href: '/history', icon: History },
  { name: 'Settings', href: '/settings', icon: Settings },
];

const authLinks = [
  { name: 'Profile', href: '/profile', icon: User },
];

const unauthenticatedLinks = [
  { name: 'Sign In', href: '/auth/login', icon: LogIn },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const { isCollapsed, toggleSidebar } = useSidebar();

  // Don't render sidebar during authentication loading
  if (loading) {
    return null;
  }

  const linksToShow = user ? [...sidebarLinks, ...authLinks] : unauthenticatedLinks;

  return (
    <aside 
      className={cn(
        "hidden lg:flex flex-col border-r bg-white/80 dark:bg-gray-950/80 backdrop-blur-md supports-[backdrop-filter]:bg-white/60 dark:supports-[backdrop-filter]:bg-gray-950/60 fixed h-[calc(100vh-4rem)] top-16 transition-all duration-300 shadow-lg",
        isCollapsed ? "w-16" : "w-64"
      )}
    >
      {/* Toggle Button */}
      <div className="flex justify-end p-3 border-b border-gray-200/50 dark:border-gray-700/50">
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleSidebar}
          className="h-8 w-8 p-0 hover:bg-accent/50 transition-all duration-300 hover:scale-110"
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto py-6 px-3">
        <nav className="space-y-2">
          {linksToShow.map((link) => {
            const isActive = pathname === link.href;
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-300 group hover:scale-105',
                  isActive
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg'
                    : 'text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground',
                  isCollapsed && 'justify-center px-2'
                )}
                title={isCollapsed ? link.name : undefined}
              >
                <Icon className={cn(
                  "h-5 w-5 transition-transform duration-300", 
                  !isCollapsed && "mr-3",
                  isActive && "scale-110"
                )} />
                {!isCollapsed && (
                  <span className="transition-all duration-300">{link.name}</span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Status Card - Hide when collapsed */}
        {!isCollapsed && (
          <div className="mt-8 p-4 rounded-xl border border-gray-200/50 dark:border-gray-700/50 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 shadow-sm">
            <div className="flex items-center space-x-3 mb-3">
              <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse shadow-lg"></div>
              <span className="text-sm font-semibold text-green-700 dark:text-green-300">System Status</span>
            </div>
            <p className="text-xs text-green-600/80 dark:text-green-400/80 leading-relaxed">
              All services operational and ready
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
