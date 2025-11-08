import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import dynamic from "next/dynamic";
import { Suspense } from "react";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/contexts/AuthContext";
import { ChatProvider } from "@/contexts/ChatContext";
import { SidebarProvider } from "@/contexts/SidebarContext";
import { Sidebar } from "@/components/sidebar";
import { Toaster } from "@/components/ui/toaster";
import { MainContent } from "@/components/MainContent";

// Preload critical component to prevent hydration errors and improve performance
const Navbar = dynamic(() => import("@/components/navbar").then(mod => ({ default: mod.Navbar })), { 
  ssr: false,
  loading: () => <NavbarSkeleton /> // Show skeleton while navbar loads
});

// Skeleton component for navbar loading state
function NavbarSkeleton() {
  return (
    <div className="h-16 bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-700 fixed top-0 w-full z-50 animate-pulse">
      <div className="container flex h-16 items-center justify-between px-4">
        <div className="w-40 h-8 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="flex gap-2">
          <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    </div>
  );
}

const inter = Inter({ subsets: ["latin"], display: 'swap' });

export const metadata: Metadata = {
  title: "MantrAI - Your Intelligent Emotional Companion",
  description: "Advanced emotion detection using text and voice analysis with AI-powered insights",
  // Preload critical resources
  other: {
    'preload-as': 'style',
    'preload-href': '/globals.css',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Preload critical fonts and resources for faster loading */}
        <link rel="preload" as="font" href="/fonts/inter-var.woff2" type="font/woff2" crossOrigin="anonymous" />
        {/* Prefetch common routes to enable faster navigation */}
        <link rel="prefetch" href="/chat" />
        <link rel="prefetch" href="/profile" />
        <link rel="prefetch" href="/history" />
      </head>
      <body className={inter.className} suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange={false} // Enable transitions for smoother dark mode switch
        >
          <AuthProvider>
            <ChatProvider>
              <SidebarProvider>
                <div className="min-h-screen bg-background transition-colors duration-300">
                  {/* Navbar with error boundary - uses Suspense for graceful loading */}
                  <Suspense fallback={<NavbarSkeleton />}>
                    <Navbar />
                  </Suspense>
                  
                  <div className="flex">
                    {/* Sidebar - memoized to prevent unnecessary rerenders */}
                    <Sidebar />
                    
                    {/* Main content with lazy-loaded pages */}
                    <MainContent>
                      <Suspense fallback={<PageLoadingSkeleton />}>
                        {children}
                      </Suspense>
                    </MainContent>
                  </div>
                </div>
                <Toaster />
              </SidebarProvider>
            </ChatProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

// Generic page loading skeleton for consistent UX during navigation
function PageLoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded-lg w-1/3" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="h-40 bg-gray-200 dark:bg-gray-700 rounded-lg" />
        <div className="h-40 bg-gray-200 dark:bg-gray-700 rounded-lg" />
      </div>
      <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-lg" />
    </div>
  );
}
