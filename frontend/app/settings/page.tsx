'use client';

import { useStore } from '@/store/useStore';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useTheme } from 'next-themes';
import { Palette, Brain, Info, Settings as SettingsIcon } from 'lucide-react';
import { GradientHeader } from '@/components/ui/GradientHeader';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { AnimatedIcon } from '@/components/ui/AnimatedIcon';

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { preferences, updatePreferences } = useStore();

  return (
    <div className="space-y-8 p-6">
      {/* Header */}
      <GradientHeader 
        title="Settings"
        subtitle="Customize your MantrAI experience and preferences"
        icon={<SettingsIcon className="h-10 w-10 text-primary" />}
      />

      {/* Appearance Settings */}
      <GlassPanel 
        title="Appearance"
        icon={<Palette className="h-6 w-6 text-white" />}
        gradient="from-pink-500/10"
        delay={0.2}
      >
        <div className="space-y-6">
          <div className="flex items-center justify-between p-5 rounded-2xl bg-background/80 border-2 border-border/40 backdrop-blur-sm hover:border-primary/40 transition-all">
            <div>
              <Label htmlFor="theme" className="text-base font-semibold">Theme Preference</Label>
              <p className="text-sm text-muted-foreground mt-1">
                Choose your preferred color scheme for the best experience
              </p>
            </div>
            <Select value={theme} onValueChange={setTheme}>
              <SelectTrigger className="w-44 h-12 rounded-2xl border-2 focus:border-primary/60 focus:ring-4 focus:ring-primary/20 shadow-md">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">☀️ Light</SelectItem>
                <SelectItem value="dark">🌙 Dark</SelectItem>
                <SelectItem value="system">💻 System</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </GlassPanel>

      {/* Analysis Settings */}
      <GlassPanel 
        title="Analysis Preferences"
        icon={<Brain className="h-6 w-6 text-white" />}
        gradient="from-blue-500/10"
        delay={0.3}
      >
        <div className="space-y-6">
          <div className="flex items-center justify-between p-5 rounded-2xl bg-background/80 border-2 border-border/40 backdrop-blur-sm hover:border-primary/40 transition-all">
            <div className="space-y-1">
              <Label htmlFor="default-mode" className="text-base font-semibold">Default Analysis Mode</Label>
              <p className="text-sm text-muted-foreground">
                Choose which mode to use by default for emotion analysis
              </p>
            </div>
            <Select
              value={preferences.defaultMode}
              onValueChange={(value: 'text' | 'voice' | 'multimodal') =>
                updatePreferences({ defaultMode: value })
              }
            >
              <SelectTrigger className="w-48 h-12 rounded-2xl border-2 focus:border-primary/60 focus:ring-4 focus:ring-primary/20 shadow-md">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">📝 Text Analysis</SelectItem>
                <SelectItem value="voice">🎤 Voice Analysis</SelectItem>
                <SelectItem value="multimodal">🎭 Multi-Modal</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator className="my-6" />

          <div className="flex items-center justify-between p-5 rounded-2xl bg-background/80 border-2 border-border/40 backdrop-blur-sm hover:border-primary/40 transition-all">
            <div className="space-y-1">
              <Label htmlFor="voice-enabled" className="text-base font-semibold">Voice Recording</Label>
              <p className="text-sm text-muted-foreground">
                Enable microphone access for voice emotion analysis
              </p>
            </div>
            <Switch
              id="voice-enabled"
              checked={preferences.voiceEnabled}
              onCheckedChange={(checked) =>
                updatePreferences({ voiceEnabled: checked })
              }
              className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-blue-500 data-[state=checked]:to-purple-600"
            />
          </div>

          <Separator className="my-6" />

          <div className="flex items-center justify-between p-5 rounded-2xl bg-background/80 border-2 border-border/40 backdrop-blur-sm hover:border-primary/40 transition-all">
            <div className="space-y-1">
              <Label htmlFor="tts-enabled" className="text-base font-semibold">Text-to-Speech</Label>
              <p className="text-sm text-muted-foreground">
                Enable voice playback for MantrAI responses
              </p>
            </div>
            <Switch
              id="tts-enabled"
              checked={preferences.ttsEnabled}
              onCheckedChange={(checked) =>
                updatePreferences({ ttsEnabled: checked })
              }
              className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-blue-500 data-[state=checked]:to-purple-600"
            />
          </div>
        </div>
      </GlassPanel>

      {/* About */}
      <GlassPanel 
        title="About MantrAI"
        icon={<Info className="h-6 w-6 text-white" />}
        gradient="from-purple-500/10"
        delay={0.4}
      >
        <div className="p-5 rounded-2xl bg-gradient-to-br from-primary/5 to-purple-500/5 border-2 border-border/40 backdrop-blur-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold text-base mb-2 bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">Platform</h4>
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">MantrAI</strong> - Advanced Multi-Modal Emotion Detection Platform
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-base mb-2 bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">Version</h4>
              <p className="text-sm text-muted-foreground font-medium">1.0.0</p>
            </div>
            <div>
              <h4 className="font-semibold text-base mb-2 bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">AI Models</h4>
              <p className="text-sm text-muted-foreground">
                Powered by BiLSTM and HuggingFace transformer models for precise emotion analysis
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-base mb-2 bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">Technology</h4>
              <p className="text-sm text-muted-foreground">
                Next.js, TypeScript, Supabase, and advanced neural networks
              </p>
            </div>
          </div>
        </div>
      </GlassPanel>
    </div>
  );
}
