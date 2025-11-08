'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Moon, Sun, Activity, User, LogOut, Settings } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const navigation = [
  { name: 'Dashboard', href: '/', icon: Activity },
  { name: 'Chat', href: '/chat' },
  { name: 'History', href: '/history' },
  { name: 'Settings', href: '/settings' },
];

export function Navbar() {
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { user, profile, signOut, loading } = useAuth();

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <nav className="border-b bg-white/80 dark:bg-gray-950/80 backdrop-blur-md supports-[backdrop-filter]:bg-white/60 dark:supports-[backdrop-filter]:bg-gray-950/60 fixed top-0 w-full z-50 shadow-sm">
      <div className="container flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center space-x-3 group">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg blur opacity-30 group-hover:opacity-50 transition-opacity"></div>
            <Activity className="relative h-8 w-8 text-transparent bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text" />
          </div>
          <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            MantrAI
          </span>
        </Link>

        {/* Navigation Links - Only show when authenticated and mounted */}
        {mounted && user && (
          <div className="hidden md:flex items-center space-x-2">
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant={isActive ? 'default' : 'ghost'}
                    className={cn(
                      'transition-all duration-300 hover:scale-105',
                      isActive && 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg'
                    )}
                  >
                    {item.name}
                  </Button>
                </Link>
              );
            })}
          </div>
        )}

        {/* Right side controls */}
        <div className="flex items-center space-x-3">
          {/* Theme Toggle - only show when mounted */}
          {mounted && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="relative hover:bg-accent/50 transition-all duration-300 hover:scale-110"
            >
              <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span className="sr-only">Toggle theme</span>
            </Button>
          )}

          {/* User Menu - only show when mounted */}
          {mounted && user && !loading ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full hover:bg-accent/50 transition-all duration-300 hover:scale-110">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                    <User className="h-4 w-4 text-white" />
                  </div>
                  <span className="sr-only">User menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 p-2">
                <div className="px-3 py-3 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 rounded-lg mb-2">
                  <p className="text-sm font-medium">{profile?.full_name || 'User'}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild className="cursor-pointer">
                  <Link href="/profile" className="flex items-center">
                    <User className="mr-3 h-4 w-4" />
                    Profile Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="cursor-pointer">
                  <Link href="/settings" className="flex items-center">
                    <Settings className="mr-3 h-4 w-4" />
                    App Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut} className="cursor-pointer text-red-600 dark:text-red-400">
                  <LogOut className="mr-3 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : mounted && !loading ? (
            <div className="flex items-center space-x-2">
              <Link href="/auth/login">
                <Button variant="ghost">Sign In</Button>
              </Link>
              <Link href="/auth/signup">
                <Button>Sign Up</Button>
              </Link>
            </div>
          ) : (
            // Placeholder during SSR/mounting
            <div className="w-24 h-10" />
          )}
        </div>
      </div>
    </nav>
  );
}
