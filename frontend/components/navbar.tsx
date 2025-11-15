'use client';

import { useState, useEffect, memo } from 'react';
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
  { name: 'Insights', href: '/insights' },
  { name: 'History', href: '/history' },
  { name: 'Settings', href: '/settings' },
];

// Memoized navigation link to prevent rerenders
const NavLink = memo(function NavLink({ 
  name, 
  href, 
  isActive 
}: { 
  name: string; 
  href: string; 
  isActive: boolean 
}) {
  return (
    <Link href={href} prefetch={true}>
      <Button
        variant={isActive ? 'default' : 'ghost'}
        className={cn(
          'transition-all duration-300 hover:scale-105',
          isActive && 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg'
        )}
      >
        {name}
      </Button>
    </Link>
  );
});

// Memoized Navbar component to prevent unnecessary rerenders on route changes
export const Navbar = memo(function Navbar() {
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { user, profile, signOut, loading } = useAuth();

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <nav className="border-b bg-white/80 dark:bg-gray-950/80 backdrop-blur-md supports-[backdrop-filter]:bg-white/60 dark:supports-[backdrop-filter]:bg-gray-950/60 fixed top-0 w-full z-50 shadow-sm transition-colors duration-300">
      <div className="container flex h-16 items-center justify-between px-4">
        {/* Logo - with prefetch to improve navigation speed */}
        <Link href="/" prefetch={true} className="flex items-center space-x-3 group">
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
                <NavLink 
                  key={item.href}
                  name={item.name}
                  href={item.href}
                  isActive={isActive}
                />
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
              className="transition-all duration-300 hover:scale-110"
              title="Toggle theme"
            >
              {theme === 'dark' ? (
                <Sun className="h-5 w-5 text-yellow-500 transition-transform duration-300" />
              ) : (
                <Moon className="h-5 w-5 text-blue-500 transition-transform duration-300" />
              )}
            </Button>
          )}

          {/* User Profile Dropdown - only show when mounted and authenticated */}
          {mounted && user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="transition-all duration-300 hover:scale-110"
                  title="User menu"
                >
                  <User className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-white dark:bg-gray-900">
                <div className="flex items-center space-x-2 px-2 py-1.5">
                  <div>
                    <p className="text-sm font-medium text-foreground">{profile?.full_name || 'User'}</p>
                    <p className="text-xs text-muted-foreground">{user?.email}</p>
                  </div>
                </div>
                <DropdownMenuSeparator />
                {/* Prefetch profile link */}
                <Link href="/profile" prefetch={true}>
                  <DropdownMenuItem className="cursor-pointer transition-colors duration-200">
                    <User className="mr-2 h-4 w-4" />
                    <span>Profile</span>
                  </DropdownMenuItem>
                </Link>
                {/* Prefetch settings link */}
                <Link href="/settings" prefetch={true}>
                  <DropdownMenuItem className="cursor-pointer transition-colors duration-200">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </DropdownMenuItem>
                </Link>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={signOut}
                  className="cursor-pointer text-red-600 dark:text-red-400 transition-colors duration-200 focus:bg-red-50 dark:focus:bg-red-950"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign Out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Login/Signup links when not authenticated */}
          {mounted && !user && !loading && (
            <>
              <Link href="/auth/login" prefetch={true}>
                <Button variant="ghost" size="sm" className="transition-all duration-300">
                  Sign In
                </Button>
              </Link>
              <Link href="/auth/signup" prefetch={true}>
                <Button 
                  size="sm" 
                  className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white transition-all duration-300"
                >
                  Sign Up
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
});
