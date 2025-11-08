'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { memo } from 'react';
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

// Memoized sidebar link to prevent rerenders
const SidebarLink = memo(function SidebarLink({
  href,
  name,
  icon: Icon,
  isActive,
  isCollapsed,
}: {
  href: string;
  name: string;
  icon: typeof Home;
  isActive: boolean;
  isCollapsed: boolean;
}) {
  return (
    <Link
      href={href}
      prefetch={true}
      className={cn(
        'flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-300 group hover:scale-105',
        isActive
          ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg'
          : 'text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground dark:hover:bg-gray-800',
        isCollapsed && 'justify-center px-2'
      )}
      title={isCollapsed ? name : undefined}
    >
      <Icon className={cn(
        "h-5 w-5 transition-transform duration-300",
        !isCollapsed && "mr-3",
        isActive && "scale-110"
      )} />
      {!isCollapsed && (
        <span className="transition-all duration-300">{name}</span>
      )}
    </Link>
  );
});

// Memoized Sidebar to prevent rerenders on navigation
export const Sidebar = memo(function Sidebar() {
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
          className="h-8 w-8 p-0 hover:bg-accent/50 dark:hover:bg-gray-800 transition-all duration-300 hover:scale-110"
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
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
              <SidebarLink
                key={link.href}
                href={link.href}
                name={link.name}
                icon={Icon}
                isActive={isActive}
                isCollapsed={isCollapsed}
              />
            );
          })}
        </nav>
      </div>
    </aside>
  );
});
