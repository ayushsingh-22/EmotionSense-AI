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
import { EmergencyContactChecker } from "@/components/EmergencyContactChecker";

// Preload improved navbar for better performance
const ImprovedNavbar = dynamic(() => import("@/components/navbar").then(mod => ({ default: mod.Navbar })), { 
  ssr: false,
  loading: () => <NavbarSkeleton /> 
});

// Lightweight navbar skeleton for faster perceived load time
function NavbarSkeleton() {
  return (
    <div className="h-16 bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 fixed top-0 w-full z-40">
      <div className="container flex h-16 items-center justify-between px-4" style={{ maxWidth: '100%' }}>
        <div className="flex items-center gap-2">
          <div className="w-32 h-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </div>
        <div className="flex gap-2">
          <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
          <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
        </div>
      </div>
    </div>
  );
}

// Page loading skeleton
function PageLoadingSkeleton() {
  return (
    <div className="space-y-4 p-6">
      <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
      <div className="space-y-3">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-3/4" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-1/2" />
      </div>
    </div>
  );
}

const inter = Inter({ 
  subsets: ["latin"], 
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: "MantrAI - Your Emotional Companion",
  description: "Advanced emotion detection and AI-powered emotional support",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Font preloading with proper crossorigin */}
        <link rel="preload" href="/_next/static/css/app/layout.css" as="style" />
        <link rel="preload" as="font" type="font/woff2" href="https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2" crossOrigin="anonymous" />
        {/* Route prefetching for faster navigation */}
        <link rel="prefetch" href="/chat" />
        <link rel="prefetch" href="/profile" />
        {/* Color scheme meta tag */}
        <meta name="theme-color" content="#5a67d8" />
      </head>
      <body className={`${inter.className} antialiased bg-white dark:bg-gray-950`} suppressHydrationWarning>
        <ThemeProvider>
          <AuthProvider>
            <ChatProvider>
              <SidebarProvider>
                <div className="min-h-screen bg-white dark:bg-gray-950 transition-colors duration-300">
                  {/* Emergency Contact Checker Modal */}
                  <EmergencyContactChecker />
                  
                  {/* Navigation Bar */}
                  <Suspense fallback={<NavbarSkeleton />}>
                    <ImprovedNavbar />
                  </Suspense>
                  
                  {/* Main Layout */}
                  <div className="flex pt-16">
                    {/* Sidebar Navigation */}
                    <Sidebar />
                    
                    {/* Main Content */}
                    <MainContent>
                      <Suspense fallback={<PageLoadingSkeleton />}>
                        {children}
                      </Suspense>
                    </MainContent>
                  </div>
                </div>
                
                {/* Toast Notifications */}
                <Toaster />
              </SidebarProvider>
            </ChatProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
