import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Suspense } from "react";
import { ThemeProvider } from "@/components/theme-provider";
import { SessionProviderWrapper } from "@/components/providers/SessionProviderWrapper";
import { AuthProvider } from "@/contexts/AuthContext";
import { ChatProvider } from "@/contexts/ChatContext";
import { SidebarProvider } from "@/contexts/SidebarContext";
import { Sidebar } from "@/components/sidebar";
import { Toaster } from "@/components/ui/toaster";
import { MainContent } from "@/components/MainContent";
import { EmergencyContactChecker } from "@/components/EmergencyContactChecker";
import { ClientNavbar } from "@/components/ClientNavbar";
import { NavbarSkeleton } from "@/components/NavbarSkeleton";

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

        {/* Route prefetching for faster navigation */}
        <link rel="prefetch" href="/chat" />
        <link rel="prefetch" href="/profile" />
        {/* Color scheme meta tag */}
        <meta name="theme-color" content="#5a67d8" />
      </head>
      <body className={`${inter.className} antialiased bg-white dark:bg-gray-950`} suppressHydrationWarning>
        <ThemeProvider>
          <SessionProviderWrapper>
          <AuthProvider>
            <ChatProvider>
              <SidebarProvider>
                <div className="min-h-screen bg-white dark:bg-gray-950 transition-colors duration-300">
                  {/* Emergency Contact Checker Modal */}
                  <EmergencyContactChecker />
                  
                  {/* Navigation Bar */}
                  <Suspense fallback={<NavbarSkeleton />}>
                    <ClientNavbar />
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
          </SessionProviderWrapper>
        </ThemeProvider>
      </body>
    </html>
  );
}
