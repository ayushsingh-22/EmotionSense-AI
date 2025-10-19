'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useStore } from '@/store/useStore';
import { SessionStats } from '@/components/emotions/SessionStats';
import { EmotionTimeline } from '@/components/emotions/EmotionTimeline';
import { ModelPerformance } from '@/components/emotions/ModelPerformance';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, Activity, Brain, MessageCircle, History, Settings } from 'lucide-react';
import Link from 'next/link';

function LandingPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-950 dark:via-blue-950 dark:to-purple-950">
      <div className="container mx-auto px-4 py-20">
        {/* Hero Section */}
        <div className="text-center mb-20">
          <div className="flex items-center justify-center mb-8">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full blur-lg opacity-30 animate-pulse"></div>
              <Activity className="relative h-16 w-16 text-transparent bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text mr-4" />
            </div>
            <h1 className="text-6xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              MantrAI
            </h1>
          </div>
          <p className="text-2xl text-muted-foreground mb-12 max-w-3xl mx-auto leading-relaxed">
            Your intelligent emotional companion. Experience 
            <span className="font-semibold text-primary"> empathetic AI conversations</span> that understand and respond to your feelings with care.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <Link href="/auth/signup">
              <Button size="lg" className="px-12 py-4 text-lg bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105">
                Get Started Free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/auth/login">
              <Button variant="outline" size="lg" className="px-12 py-4 text-lg border-2 hover:bg-accent/50 transition-all duration-300">
                Sign In
              </Button>
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
          <Card className="text-center group hover:shadow-2xl transition-all duration-500 border-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm hover:scale-105">
            <CardHeader className="pb-4">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center mx-auto mb-6 group-hover:rotate-6 transition-transform duration-300 shadow-lg">
                <MessageCircle className="h-10 w-10 text-white" />
              </div>
              <CardTitle className="text-2xl mb-2">Intelligent Chat</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-lg leading-relaxed">
                Chat with MantrAI, your empathetic AI companion that understands your emotions with precision
              </p>
            </CardContent>
          </Card>

          <Card className="text-center group hover:shadow-2xl transition-all duration-500 border-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm hover:scale-105">
            <CardHeader className="pb-4">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center mx-auto mb-6 group-hover:rotate-6 transition-transform duration-300 shadow-lg">
                <Brain className="h-10 w-10 text-white" />
              </div>
              <CardTitle className="text-2xl mb-2">Emotion Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-lg leading-relaxed">
                Advanced AI analyzes your emotions and provides thoughtful, personalized responses instantly
              </p>
            </CardContent>
          </Card>

          <Card className="text-center group hover:shadow-2xl transition-all duration-500 border-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm hover:scale-105">
            <CardHeader className="pb-4">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center mx-auto mb-6 group-hover:rotate-6 transition-transform duration-300 shadow-lg">
                <Activity className="h-10 w-10 text-white" />
              </div>
              <CardTitle className="text-2xl mb-2">Personal History</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-lg leading-relaxed">
                Track your emotional journey with secure, personalized conversation history and insights
              </p>
            </CardContent>
          </Card>
        </div>

        {/* How it works */}
        <div className="text-center mb-20">
          <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
            How It Works
          </h2>
          <p className="text-xl text-muted-foreground mb-12 max-w-2xl mx-auto">
            Experience emotional intelligence in four simple steps
          </p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="text-center group">
              <div className="relative mb-6">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white flex items-center justify-center mx-auto text-2xl font-bold shadow-lg group-hover:scale-110 transition-transform duration-300">
                  1
                </div>
                {/* Connecting line */}
                <div className="hidden md:block absolute top-8 left-full w-full h-0.5 bg-gradient-to-r from-blue-500 to-purple-600 opacity-30"></div>
              </div>
              <h3 className="font-semibold text-xl mb-3 text-primary">Express</h3>
              <p className="text-muted-foreground leading-relaxed">Share your emotions through text or voice with natural conversation</p>
            </div>
            <div className="text-center group">
              <div className="relative mb-6">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 text-white flex items-center justify-center mx-auto text-2xl font-bold shadow-lg group-hover:scale-110 transition-transform duration-300">
                  2
                </div>
                <div className="hidden md:block absolute top-8 left-full w-full h-0.5 bg-gradient-to-r from-green-500 to-emerald-600 opacity-30"></div>
              </div>
              <h3 className="font-semibold text-xl mb-3 text-primary">Analyze</h3>
              <p className="text-muted-foreground leading-relaxed">AI analyzes your emotional state with advanced machine learning precision</p>
            </div>
            <div className="text-center group">
              <div className="relative mb-6">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-500 to-red-600 text-white flex items-center justify-center mx-auto text-2xl font-bold shadow-lg group-hover:scale-110 transition-transform duration-300">
                  3
                </div>
                <div className="hidden md:block absolute top-8 left-full w-full h-0.5 bg-gradient-to-r from-orange-500 to-red-600 opacity-30"></div>
              </div>
              <h3 className="font-semibold text-xl mb-3 text-primary">Understand</h3>
              <p className="text-muted-foreground leading-relaxed">Get detailed insights and understanding about your emotional patterns</p>
            </div>
            <div className="text-center group">
              <div className="relative mb-6">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 text-white flex items-center justify-center mx-auto text-2xl font-bold shadow-lg group-hover:scale-110 transition-transform duration-300">
                  4
                </div>
              </div>
              <h3 className="font-semibold text-xl mb-3 text-primary">Connect</h3>
              <p className="text-muted-foreground leading-relaxed">Receive empathetic MantrAI responses and personalized emotional support</p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center relative">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-600/10 rounded-3xl blur-3xl"></div>
          <div className="relative bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm rounded-3xl p-12 border border-white/20">
            <h2 className="text-4xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Ready to start your emotional journey?
            </h2>
            <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
              Join thousands of users who are improving their emotional intelligence with AI-powered insights and personalized support
            </p>
            <Link href="/auth/signup">
              <Button size="lg" className="px-16 py-4 text-lg bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105">
                Get Started Now
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function DashboardPage() {
  const history = useStore((state) => state.history);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-purple-600/5 rounded-2xl"></div>
        <div className="relative bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm rounded-2xl p-8 border border-white/20">
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Welcome Back!
          </h1>
          <p className="text-muted-foreground mt-3 text-lg">
            Ready to continue your journey with MantrAI? Let&apos;s explore your emotional insights.
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Link href="/chat">
          <Card className="group p-6 hover:shadow-2xl transition-all duration-500 cursor-pointer border-0 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 hover:scale-105 hover:rotate-1">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-xl text-blue-700 dark:text-blue-300">Start Chatting</h3>
                <p className="text-sm text-blue-600/70 dark:text-blue-400/70 mt-2">
                  Talk with MantrAI now
                </p>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center group-hover:rotate-12 transition-transform duration-300 shadow-lg">
                <MessageCircle className="h-7 w-7 text-white" />
              </div>
            </div>
            <div className="mt-6 flex items-center text-sm text-blue-600 dark:text-blue-400 font-medium">
              Chat now <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </Card>
        </Link>

        <Link href="/history">
          <Card className="group p-6 hover:shadow-2xl transition-all duration-500 cursor-pointer border-0 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 hover:scale-105 hover:rotate-1">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-xl text-purple-700 dark:text-purple-300">View History</h3>
                <p className="text-sm text-purple-600/70 dark:text-purple-400/70 mt-2">
                  Review past conversations
                </p>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center group-hover:rotate-12 transition-transform duration-300 shadow-lg">
                <History className="h-7 w-7 text-white" />
              </div>
            </div>
            <div className="mt-6 flex items-center text-sm text-purple-600 dark:text-purple-400 font-medium">
              View history <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </Card>
        </Link>

        <Link href="/settings">
          <Card className="group p-6 hover:shadow-2xl transition-all duration-500 cursor-pointer border-0 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 hover:scale-105 hover:rotate-1">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-xl text-green-700 dark:text-green-300">Settings</h3>
                <p className="text-sm text-green-600/70 dark:text-green-400/70 mt-2">
                  Customize your experience
                </p>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center group-hover:rotate-12 transition-transform duration-300 shadow-lg">
                <Settings className="h-7 w-7 text-white" />
              </div>
            </div>
            <div className="mt-6 flex items-center text-sm text-green-600 dark:text-green-400 font-medium">
              Customize <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </Card>
        </Link>

        <Link href="/multimodal">
          <Card className="group p-6 hover:shadow-2xl transition-all duration-500 cursor-pointer border-0 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 hover:scale-105 hover:rotate-1">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-xl text-orange-700 dark:text-orange-300">Multi-Modal</h3>
                <p className="text-sm text-orange-600/70 dark:text-orange-400/70 mt-2">
                  Voice & text analysis
                </p>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center group-hover:rotate-12 transition-transform duration-300 shadow-lg">
                <Activity className="h-7 w-7 text-white" />
              </div>
            </div>
            <div className="mt-6 flex items-center text-sm text-orange-600 dark:text-orange-400 font-medium">
              Explore <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </Card>
        </Link>
      </div>

      {/* Dashboard Content */}
      {history.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Recent Activity */}
          <Card className="p-8 border-0 bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800 shadow-xl">
            <h3 className="text-2xl font-semibold mb-6 flex items-center">
              <Activity className="h-6 w-6 mr-3 text-blue-500" />
              Recent Activity
            </h3>
            <EmotionTimeline history={history} />
          </Card>

          {/* Statistics */}
          <Card className="p-8 border-0 bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800 shadow-xl">
            <h3 className="text-2xl font-semibold mb-6 flex items-center">
              <Brain className="h-6 w-6 mr-3 text-purple-500" />
              Session Statistics
            </h3>
            <SessionStats history={history} />
          </Card>

          {/* Model Performance */}
          <Card className="p-8 lg:col-span-2 border-0 bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800 shadow-xl">
            <h3 className="text-2xl font-semibold mb-6 flex items-center">
              <Activity className="h-6 w-6 mr-3 text-green-500" />
              Model Performance
            </h3>
            <ModelPerformance history={history} />
          </Card>
        </div>
      ) : (
        <Card className="p-16 text-center border-0 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 shadow-xl">
          <div className="max-w-lg mx-auto">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mx-auto mb-8 shadow-lg">
              <Activity className="h-12 w-12 text-white" />
            </div>
            <h3 className="text-2xl font-semibold mb-4 text-primary">No analysis yet</h3>
            <p className="text-muted-foreground mb-8 text-lg leading-relaxed">
              Start by having a conversation with MantrAI, your intelligent emotional companion and begin your journey.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/text">
                <Button className="w-full sm:w-auto bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-lg">
                  Analyze Text
                </Button>
              </Link>
              <Link href="/voice">
                <Button variant="outline" className="w-full sm:w-auto border-2 hover:bg-accent/50">
                  Record Voice
                </Button>
              </Link>
              <Link href="/chat">
                <Button variant="outline" className="w-full sm:w-auto border-2 hover:bg-accent/50">
                  Start Chat
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

export default function Home() {
  const { user, loading } = useAuth();

  // Show loading while authentication is being checked
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Activity className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Show landing page for unauthenticated users
  if (!user) {
    return <LandingPage />;
  }

  // Show dashboard for authenticated users
  return <DashboardPage />;
}