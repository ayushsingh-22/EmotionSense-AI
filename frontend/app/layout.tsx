import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import dynamic from "next/dynamic";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/contexts/AuthContext";
import { ChatProvider } from "@/contexts/ChatContext";
import { SidebarProvider } from "@/contexts/SidebarContext";
import { Sidebar } from "@/components/sidebar";
import { Toaster } from "@/components/ui/toaster";
import { MainContent } from "@/components/MainContent";

// Dynamically import Navbar with SSR disabled to prevent hydration errors
const Navbar = dynamic(() => import("@/components/navbar").then(mod => ({ default: mod.Navbar })), { 
  ssr: false,
  loading: () => <div className="h-16 bg-background border-b" /> // Placeholder during load
});

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MantrAI - Your Intelligent Emotional Companion",
  description: "Advanced emotion detection using text and voice analysis with AI-powered insights",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <ChatProvider>
              <SidebarProvider>
                <div className="min-h-screen bg-background">
                  <Navbar />
                  <div className="flex">
                    <Sidebar />
                    <MainContent>
                      {children}
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
