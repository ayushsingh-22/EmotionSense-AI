'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useStore } from '@/store/useStore';
import { SessionStats } from '@/components/emotions/SessionStats';
import { RecentChats } from '@/components/home/RecentChats';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, Activity, Brain, MessageCircle, History, Settings, Sparkles, TrendingUp, Mic } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { GradientHeader } from '@/components/ui/GradientHeader';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { AnimatedIcon } from '@/components/ui/AnimatedIcon';
import { SectionWrapper } from '@/components/ui/SectionWrapper';

function LandingPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-950 dark:via-blue-950 dark:to-purple-950 relative overflow-hidden">
      {/* Floating gradient shapes */}
      <motion.div
        className="absolute top-20 left-10 w-72 h-72 bg-gradient-to-br from-blue-400/20 to-purple-600/20 rounded-full blur-3xl"
        animate={{
          y: [0, 30, 0],
          x: [0, 20, 0],
        }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-20 right-10 w-96 h-96 bg-gradient-to-br from-pink-400/20 to-purple-600/20 rounded-full blur-3xl"
        animate={{
          y: [0, -40, 0],
          x: [0, -30, 0],
        }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />
      
      <div className="container mx-auto px-4 py-20 relative z-10">
        {/* Hero Section */}
        <motion.div 
          className="text-center mb-20"
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
        >
          <div className="flex items-center justify-center mb-8">
            <motion.div 
              className="relative"
              whileHover={{ scale: 1.1, rotate: 5 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full blur-xl opacity-40 animate-pulse"></div>
              <div className="relative p-4 rounded-3xl bg-gradient-to-br from-blue-500 to-purple-600 shadow-2xl">
                <Activity className="h-16 w-16 text-white" />
              </div>
            </motion.div>
          </div>
          
          <motion.h1 
            className="text-7xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-6"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            MantrAI
          </motion.h1>
          
          <motion.p 
            className="text-2xl text-muted-foreground mb-12 max-w-3xl mx-auto leading-relaxed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            Your intelligent emotional companion. Experience 
            <span className="font-semibold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent"> empathetic AI conversations</span> that understand and respond to your feelings with care.
          </motion.p>
          
          <motion.div 
            className="flex flex-col sm:flex-row items-center justify-center gap-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <Link href="/auth/signup">
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button size="lg" className="px-12 py-6 text-lg bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 shadow-2xl hover:shadow-purple-500/50 transition-all duration-300 rounded-2xl">
                  Get Started Free
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </motion.div>
            </Link>
            <Link href="/auth/login">
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button variant="outline" size="lg" className="px-12 py-6 text-lg border-2 hover:bg-accent/50 transition-all duration-300 rounded-2xl backdrop-blur-sm">
                  Sign In
                </Button>
              </motion.div>
            </Link>
          </motion.div>
        </motion.div>

        {/* Features */}
        <SectionWrapper delay={0.8}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
            <motion.div whileHover={{ scale: 1.05, y: -8 }} transition={{ type: "spring", stiffness: 300 }}>
              <Card className="text-center group hover:shadow-2xl transition-all duration-500 border-2 border-border/50 bg-gradient-to-br from-blue-500/10 via-background to-background backdrop-blur-sm rounded-3xl overflow-hidden">
                <CardHeader className="pb-4">
                  <AnimatedIcon 
                    icon={<MessageCircle className="h-10 w-10" />}
                    gradient="from-blue-500 to-blue-600"
                    glowColor="rgba(59, 130, 246, 0.4)"
                    size="lg"
                    className="mx-auto mb-6"
                  />
                  <CardTitle className="text-2xl mb-2 bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent">Intelligent Chat</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-lg leading-relaxed">
                    Chat with MantrAI, your empathetic AI companion that understands your emotions with precision
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div whileHover={{ scale: 1.05, y: -8 }} transition={{ type: "spring", stiffness: 300 }}>
              <Card className="text-center group hover:shadow-2xl transition-all duration-500 border-2 border-border/50 bg-gradient-to-br from-green-500/10 via-background to-background backdrop-blur-sm rounded-3xl overflow-hidden">
                <CardHeader className="pb-4">
                  <AnimatedIcon 
                    icon={<Brain className="h-10 w-10" />}
                    gradient="from-green-500 to-emerald-600"
                    glowColor="rgba(34, 197, 94, 0.4)"
                    size="lg"
                    className="mx-auto mb-6"
                    delay={0.3}
                  />
                  <CardTitle className="text-2xl mb-2 bg-gradient-to-r from-green-600 to-emerald-400 bg-clip-text text-transparent">Emotion Analysis</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-lg leading-relaxed">
                    Advanced AI analyzes your emotions and provides thoughtful, personalized responses instantly
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div whileHover={{ scale: 1.05, y: -8 }} transition={{ type: "spring", stiffness: 300 }}>
              <Card className="text-center group hover:shadow-2xl transition-all duration-500 border-2 border-border/50 bg-gradient-to-br from-purple-500/10 via-background to-background backdrop-blur-sm rounded-3xl overflow-hidden">
                <CardHeader className="pb-4">
                  <AnimatedIcon 
                    icon={<Activity className="h-10 w-10" />}
                    gradient="from-purple-500 to-pink-600"
                    glowColor="rgba(168, 85, 247, 0.4)"
                    size="lg"
                    className="mx-auto mb-6"
                    delay={0.6}
                  />
                  <CardTitle className="text-2xl mb-2 bg-gradient-to-r from-purple-600 to-pink-400 bg-clip-text text-transparent">Personal History</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-lg leading-relaxed">
                    Track your emotional journey with secure, personalized conversation history and insights
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </SectionWrapper>

        {/* How it works */}
        <SectionWrapper delay={1.0}>
          <div className="text-center mb-20">
            <motion.h2 
              className="text-5xl font-bold mb-4 bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              How It Works
            </motion.h2>
            <p className="text-xl text-muted-foreground mb-12 max-w-2xl mx-auto">
              Experience emotional intelligence in four simple steps
            </p>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              {[
                { num: 1, title: "Express", desc: "Share your emotions through text or voice with natural conversation", gradient: "from-blue-500 to-purple-600", glow: "rgba(59, 130, 246, 0.3)" },
                { num: 2, title: "Analyze", desc: "AI analyzes your emotional state with advanced machine learning precision", gradient: "from-green-500 to-emerald-600", glow: "rgba(34, 197, 94, 0.3)" },
                { num: 3, title: "Understand", desc: "Get detailed insights and understanding about your emotional patterns", gradient: "from-orange-500 to-red-600", glow: "rgba(249, 115, 22, 0.3)" },
                { num: 4, title: "Connect", desc: "Receive empathetic MantrAI responses and personalized emotional support", gradient: "from-purple-500 to-pink-600", glow: "rgba(168, 85, 247, 0.3)" }
              ].map((step, i) => (
                <motion.div 
                  key={step.num}
                  className="text-center group"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.2 + i * 0.1 }}
                >
                  <div className="relative mb-6">
                    <motion.div 
                      className={`w-20 h-20 rounded-full bg-gradient-to-br ${step.gradient} text-white flex items-center justify-center mx-auto text-3xl font-bold shadow-2xl`}
                      whileHover={{ scale: 1.15, rotate: 360 }}
                      transition={{ type: "spring", stiffness: 200 }}
                      animate={{
                        boxShadow: [
                          `0 0 20px ${step.glow}`,
                          `0 0 40px ${step.glow.replace('0.3', '0.5')}`,
                        ],
                      }}
                      style={{ 
                        transition: `box-shadow 2s ease-in-out infinite alternate`,
                        animationDelay: `${i * 0.5}s` 
                      }}
                    >
                      {step.num}
                    </motion.div>
                    {i < 3 && (
                      <div className="hidden md:block absolute top-10 left-full w-full h-1 bg-gradient-to-r from-current to-transparent opacity-20"></div>
                    )}
                  </div>
                  <h3 className="font-semibold text-xl mb-3 text-primary">{step.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{step.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </SectionWrapper>

        {/* CTA */}
        <SectionWrapper delay={1.6}>
          <motion.div 
            className="text-center relative"
            whileHover={{ scale: 1.02 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-600/10 rounded-3xl blur-3xl"></div>
            <div className="relative bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm rounded-3xl p-12 border-2 border-white/20 shadow-2xl">
              <h2 className="text-5xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Ready to start your emotional journey?
              </h2>
              <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
                Join thousands of users who are improving their emotional intelligence with AI-powered insights and personalized support
              </p>
              <Link href="/auth/signup">
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button size="lg" className="px-16 py-6 text-lg bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 shadow-2xl hover:shadow-purple-500/50 transition-all duration-300 rounded-2xl">
                    Get Started Now
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </motion.div>
              </Link>
            </div>
          </motion.div>
        </SectionWrapper>
      </div>
    </div>
  );
}

function DashboardPage() {
  const { user } = useAuth();
  const history = useStore((state) => state.history);

  return (
    <div className="space-y-8 p-6">
      {/* Header */}
      <GradientHeader 
        title="Welcome Back!"
        subtitle="Ready to continue your journey with MantrAI? Let's explore your emotional insights."
        icon={<Sparkles className="h-10 w-10 text-primary" />}
      />

      {/* Quick Actions */}
      <SectionWrapper delay={0.2}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Link href="/chat">
            <motion.div whileHover={{ scale: 1.05, y: -4 }} transition={{ type: "spring", stiffness: 300 }}>
              <GlassPanel 
                gradient="from-blue-500/10"
                hoverable={false}
                className="cursor-pointer"
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-xl bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent">Start Chatting</h3>
                    <p className="text-sm text-muted-foreground mt-2">
                      Talk with MantrAI now
                    </p>
                  </div>
                  <AnimatedIcon 
                    icon={<MessageCircle className="h-6 w-6" />}
                    gradient="from-blue-500 to-blue-600"
                    glowColor="rgba(59, 130, 246, 0.3)"
                  />
                </div>
                <div className="mt-6 flex items-center text-sm text-blue-600 dark:text-blue-400 font-medium">
                  Chat now <ArrowRight className="ml-2 h-4 w-4" />
                </div>
              </GlassPanel>
            </motion.div>
          </Link>

          <Link href="/history">
            <motion.div whileHover={{ scale: 1.05, y: -4 }} transition={{ type: "spring", stiffness: 300 }}>
              <GlassPanel 
                gradient="from-purple-500/10"
                hoverable={false}
                className="cursor-pointer"
                delay={0.1}
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-xl bg-gradient-to-r from-purple-600 to-purple-400 bg-clip-text text-transparent">View History</h3>
                    <p className="text-sm text-muted-foreground mt-2">
                      Review past conversations
                    </p>
                  </div>
                  <AnimatedIcon 
                    icon={<History className="h-6 w-6" />}
                    gradient="from-purple-500 to-purple-600"
                    glowColor="rgba(168, 85, 247, 0.3)"
                    delay={0.5}
                  />
                </div>
                <div className="mt-6 flex items-center text-sm text-purple-600 dark:text-purple-400 font-medium">
                  View history <ArrowRight className="ml-2 h-4 w-4" />
                </div>
              </GlassPanel>
            </motion.div>
          </Link>

          <Link href="/settings">
            <motion.div whileHover={{ scale: 1.05, y: -4 }} transition={{ type: "spring", stiffness: 300 }}>
              <GlassPanel 
                gradient="from-green-500/10"
                hoverable={false}
                className="cursor-pointer"
                delay={0.2}
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-xl bg-gradient-to-r from-green-600 to-green-400 bg-clip-text text-transparent">Settings</h3>
                    <p className="text-sm text-muted-foreground mt-2">
                      Customize your experience
                    </p>
                  </div>
                  <AnimatedIcon 
                    icon={<Settings className="h-6 w-6" />}
                    gradient="from-green-500 to-green-600"
                    glowColor="rgba(34, 197, 94, 0.3)"
                    delay={1}
                  />
                </div>
                <div className="mt-6 flex items-center text-sm text-green-600 dark:text-green-400 font-medium">
                  Customize <ArrowRight className="ml-2 h-4 w-4" />
                </div>
              </GlassPanel>
            </motion.div>
          </Link>

          <Link href="/multimodal">
            <motion.div whileHover={{ scale: 1.05, y: -4 }} transition={{ type: "spring", stiffness: 300 }}>
              <GlassPanel 
                gradient="from-orange-500/10"
                hoverable={false}
                className="cursor-pointer"
                delay={0.3}
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-xl bg-gradient-to-r from-orange-600 to-orange-400 bg-clip-text text-transparent">Multi-Modal</h3>
                    <p className="text-sm text-muted-foreground mt-2">
                      Voice & text analysis
                    </p>
                  </div>
                  <AnimatedIcon 
                    icon={<Mic className="h-6 w-6" />}
                    gradient="from-orange-500 to-orange-600"
                    glowColor="rgba(249, 115, 22, 0.3)"
                    delay={1.5}
                  />
                </div>
                <div className="mt-6 flex items-center text-sm text-orange-600 dark:text-orange-400 font-medium">
                  Explore <ArrowRight className="ml-2 h-4 w-4" />
                </div>
              </GlassPanel>
            </motion.div>
          </Link>
        </div>
      </SectionWrapper>

      {/* Dashboard Content */}
      {history.length > 0 ? (
        <SectionWrapper delay={0.4}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Recent Activity */}
            <GlassPanel 
              title="Recent Chats"
              icon={<MessageCircle className="h-6 w-6 text-white" />}
              gradient="from-blue-500/10"
            >
              {user && <RecentChats userId={user.id} />}
            </GlassPanel>

            {/* Statistics */}
            <GlassPanel 
              title="Session Statistics"
              icon={<TrendingUp className="h-6 w-6 text-white" />}
              gradient="from-purple-500/10"
              delay={0.1}
            >
              <SessionStats />
            </GlassPanel>
          </div>
        </SectionWrapper>
      ) : (
        <SectionWrapper delay={0.4}>
          <GlassPanel gradient="from-blue-500/10" className="text-center py-12">
            <div className="max-w-lg mx-auto">
              <AnimatedIcon 
                icon={<Activity className="h-12 w-12" />}
                gradient="from-blue-500 to-purple-600"
                glowColor="rgba(59, 130, 246, 0.4)"
                size="lg"
                className="mx-auto mb-8"
              />
              <h3 className="text-3xl font-semibold mb-4 bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">No analysis yet</h3>
              <p className="text-muted-foreground mb-8 text-lg leading-relaxed">
                Start by having a conversation with MantrAI, your intelligent emotional companion and begin your journey.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/text">
                  <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                    <Button className="w-full sm:w-auto bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-lg rounded-xl">
                      Analyze Text
                    </Button>
                  </motion.div>
                </Link>
                <Link href="/voice">
                  <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                    <Button variant="outline" className="w-full sm:w-auto border-2 hover:bg-accent/50 rounded-xl">
                      Record Voice
                    </Button>
                  </motion.div>
                </Link>
                <Link href="/chat">
                  <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                    <Button variant="outline" className="w-full sm:w-auto border-2 hover:bg-accent/50 rounded-xl">
                      Start Chat
                    </Button>
                  </motion.div>
                </Link>
              </div>
            </div>
          </GlassPanel>
        </SectionWrapper>
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