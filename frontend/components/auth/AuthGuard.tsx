'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LogIn, User } from 'lucide-react';
import Link from 'next/link';

interface AuthGuardProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  redirectTo?: string;
}

export function AuthGuard({ 
  children, 
  requireAuth = true, 
  redirectTo = '/auth/login' 
}: AuthGuardProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // List of public routes that don't require authentication
  const publicRoutes = [
    '/',
    '/auth/login',
    '/auth/signup',
    '/auth/forgot-password',
  ];

  const isPublicRoute = publicRoutes.includes(pathname);

  useEffect(() => {
    if (!loading && requireAuth && !user && !isPublicRoute) {
      // Store the intended destination
      sessionStorage.setItem('auth_redirect', pathname);
      router.push(redirectTo);
    }
  }, [user, loading, requireAuth, isPublicRoute, pathname, redirectTo, router]);

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // If authentication is required but user is not logged in
  if (requireAuth && !user && !isPublicRoute) {
    return (
      <div className="flex items-center justify-center min-h-[400px] p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mx-auto mb-4">
              <User className="h-8 w-8 text-white" />
            </div>
            <h3 className="text-lg font-semibold">Authentication Required</h3>
            <p className="text-muted-foreground">
              Please sign in to access this feature. Your emotional journey awaits!
            </p>
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Button asChild className="flex-1">
                <Link href="/auth/login">
                  <LogIn className="h-4 w-4 mr-2" />
                  Sign In
                </Link>
              </Button>
              <Button asChild variant="outline" className="flex-1">
                <Link href="/auth/signup">
                  Create Account
                </Link>
              </Button>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => router.back()}
              className="mt-2"
            >
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // If user is logged in but trying to access auth pages, redirect to dashboard
  if (user && isPublicRoute && pathname.startsWith('/auth/')) {
    router.push('/');
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return <>{children}</>;
}

// Hook to use with individual components
export function useAuthGuard(requireAuth = true) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isAuthenticated = !!user;
  const shouldRedirect = requireAuth && !loading && !isAuthenticated;

  useEffect(() => {
    if (shouldRedirect) {
      sessionStorage.setItem('auth_redirect', pathname);
      router.push('/auth/login');
    }
  }, [shouldRedirect, pathname, router]);

  return {
    user,
    loading,
    isAuthenticated,
    shouldRedirect,
  };
}