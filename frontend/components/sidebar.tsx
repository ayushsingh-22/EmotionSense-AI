'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  FileText,
  Mic,
  Layers,
  History,
  Settings,
  Activity,
  MessageCircle,
  User,
  LogIn,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

const sidebarLinks = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Text', href: '/text', icon: FileText },
  { name: 'Voice', href: '/voice', icon: Mic },
  { name: 'Multi-Modal', href: '/multimodal', icon: Layers },
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

  // Don't render sidebar during authentication loading
  if (loading) {
    return null;
  }

  const linksToShow = user ? [...sidebarLinks, ...authLinks] : unauthenticatedLinks;

  return (
    <aside className="hidden lg:flex flex-col w-64 border-r bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 fixed h-[calc(100vh-4rem)] top-16">
      <div className="flex-1 overflow-y-auto py-6 px-3">
        <nav className="space-y-1">
          {linksToShow.map((link) => {
            const isActive = pathname === link.href;
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
              >
                <Icon className="mr-3 h-5 w-5" />
                {link.name}
              </Link>
            );
          })}
        </nav>

        {/* Status Card */}
        <div className="mt-6 p-4 rounded-lg border bg-card">
          <div className="flex items-center space-x-2 mb-2">
            <Activity className="h-4 w-4 text-green-500" />
            <span className="text-sm font-medium">System Status</span>
          </div>
          <p className="text-xs text-muted-foreground">All services operational</p>
        </div>
      </div>
    </aside>
  );
}
