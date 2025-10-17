'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useStore } from '@/store/useStore';
import { SessionStats } from '@/components/emotions/SessionStats';
import { EmotionTimeline } from '@/components/emotions/EmotionTimeline';
import { ModelPerformance } from '@/components/emotions/ModelPerformance';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Mic, Layers, ArrowRight, Activity, Brain, MessageCircle } from 'lucide-react';
import Link from 'next/link';

function LandingPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-950 dark:to-gray-900">
      <div className="container mx-auto px-4 py-16">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <div className="flex items-center justify-center mb-6">
            <Activity className="h-12 w-12 text-primary mr-4" />
            <h1 className="text-5xl font-bold">Emotion AI</h1>
          </div>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Advanced multi-modal emotion detection platform powered by AI. 
            Analyze emotions through text, voice, and get empathetic responses.
          </p>
          <div className="flex items-center justify-center space-x-4">
            <Link href="/auth/signup">
              <Button size="lg" className="px-8">
                Get Started Free
              </Button>
            </Link>
            <Link href="/auth/login">
              <Button variant="outline" size="lg" className="px-8">
                Sign In
              </Button>
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          <Card className="text-center">
            <CardHeader>
              <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto mb-4">
                <FileText className="h-8 w-8 text-blue-500" />
              </div>
              <CardTitle>Text Emotion Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Advanced BiLSTM and transformer models analyze emotions from text with high accuracy
              </p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                <Mic className="h-8 w-8 text-green-500" />
              </div>
              <CardTitle>Voice Emotion Detection</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Analyze emotional patterns from speech using custom ONNX models and speech-to-text
              </p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <div className="w-16 h-16 rounded-full bg-purple-500/10 flex items-center justify-center mx-auto mb-4">
                <Brain className="h-8 w-8 text-purple-500" />
              </div>
              <CardTitle>AI Companion</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Get empathetic responses and engage in emotional conversations with AI
              </p>
            </CardContent>
          </Card>
        </div>

        {/* How it works */}
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold mb-8">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-4 text-lg font-bold">
                1
              </div>
              <h3 className="font-semibold mb-2">Express</h3>
              <p className="text-sm text-muted-foreground">Share your emotions through text or voice</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-4 text-lg font-bold">
                2
              </div>
              <h3 className="font-semibold mb-2">Analyze</h3>
              <p className="text-sm text-muted-foreground">AI analyzes your emotional state with precision</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-4 text-lg font-bold">
                3
              </div>
              <h3 className="font-semibold mb-2">Understand</h3>
              <p className="text-sm text-muted-foreground">Get detailed insights about your emotions</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-4 text-lg font-bold">
                4
              </div>
              <h3 className="font-semibold mb-2">Connect</h3>
              <p className="text-sm text-muted-foreground">Receive empathetic AI responses and support</p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to start your emotional journey?</h2>
          <p className="text-lg text-muted-foreground mb-8">
            Join thousands of users who are improving their emotional intelligence with AI
          </p>
          <Link href="/auth/signup">
            <Button size="lg" className="px-12">
              Get Started Now
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

function DashboardPage() {
  const history = useStore((state) => state.history);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Welcome back to your emotional intelligence journey
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Link href="/text">
          <Card className="p-6 hover:shadow-lg transition-all cursor-pointer border-2 hover:border-primary">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-lg">Text Analysis</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Analyze text emotions
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                <FileText className="h-6 w-6 text-blue-500" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm text-primary">
              Get started <ArrowRight className="ml-2 h-4 w-4" />
            </div>
          </Card>
        </Link>

        <Link href="/voice">
          <Card className="p-6 hover:shadow-lg transition-all cursor-pointer border-2 hover:border-primary">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-lg">Voice Analysis</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Record and analyze voice
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center">
                <Mic className="h-6 w-6 text-purple-500" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm text-primary">
              Get started <ArrowRight className="ml-2 h-4 w-4" />
            </div>
          </Card>
        </Link>

        <Link href="/multimodal">
          <Card className="p-6 hover:shadow-lg transition-all cursor-pointer border-2 hover:border-primary">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-lg">Multi-Modal</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Combine text + voice
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
                <Layers className="h-6 w-6 text-green-500" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm text-primary">
              Get started <ArrowRight className="ml-2 h-4 w-4" />
            </div>
          </Card>
        </Link>

        <Link href="/chat">
          <Card className="p-6 hover:shadow-lg transition-all cursor-pointer border-2 hover:border-primary">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-lg">Chat Companion</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Talk with AI companion
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-orange-500/10 flex items-center justify-center">
                <MessageCircle className="h-6 w-6 text-orange-500" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm text-primary">
              Get started <ArrowRight className="ml-2 h-4 w-4" />
            </div>
          </Card>
        </Link>
      </div>

      {/* Dashboard Content */}
      {history.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Activity */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
            <EmotionTimeline history={history} />
          </Card>

          {/* Statistics */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Session Statistics</h3>
            <SessionStats history={history} />
          </Card>

          {/* Model Performance */}
          <Card className="p-6 lg:col-span-2">
            <h3 className="text-lg font-semibold mb-4">Model Performance</h3>
            <ModelPerformance history={history} />
          </Card>
        </div>
      ) : (
        <Card className="p-12 text-center">
          <div className="max-w-md mx-auto">
            <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No analysis yet</h3>
            <p className="text-muted-foreground mb-6">
              Start by analyzing your emotions through text, voice, or have a conversation with our AI companion.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Link href="/text">
                <Button className="w-full sm:w-auto">Analyze Text</Button>
              </Link>
              <Link href="/voice">
                <Button variant="outline" className="w-full sm:w-auto">Record Voice</Button>
              </Link>
              <Link href="/chat">
                <Button variant="outline" className="w-full sm:w-auto">Start Chat</Button>
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