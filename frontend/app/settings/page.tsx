'use client';

import { useStore } from '@/store/useStore';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useTheme } from 'next-themes';
import { Palette, Brain, Info, Settings as SettingsIcon } from 'lucide-react';

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { preferences, updatePreferences } = useStore();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-purple-600/5 rounded-2xl"></div>
        <div className="relative bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm rounded-2xl p-8 border border-white/20">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
              <SettingsIcon className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Settings
              </h1>
              <p className="text-muted-foreground mt-2 text-lg">
                Customize your MantrAI experience and preferences
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Appearance Settings */}
      <Card className="border-0 shadow-2xl bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800">
        <div className="p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-palette-500 to-palette-600 flex items-center justify-center">
              <Palette className="h-5 w-5 text-white" />
            </div>
            <h3 className="text-2xl font-semibold">Appearance</h3>
          </div>
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 rounded-xl bg-white/80 dark:bg-gray-800/80 border border-gray-200/50 dark:border-gray-700/50">
              <div>
                <Label htmlFor="theme" className="text-base font-medium">Theme Preference</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Choose your preferred color scheme for the best experience
                </p>
              </div>
              <Select value={theme} onValueChange={setTheme}>
                <SelectTrigger className="w-40 h-12 rounded-xl border-2 focus:border-blue-500">
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
        </div>
      </Card>

      {/* Analysis Settings */}
      <Card className="border-0 shadow-2xl bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800">
        <div className="p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brain-500 to-brain-600 flex items-center justify-center">
              <Brain className="h-5 w-5 text-white" />
            </div>
            <h3 className="text-2xl font-semibold">Analysis Preferences</h3>
          </div>
          <div className="space-y-8">
            <div className="flex items-center justify-between p-4 rounded-xl bg-white/80 dark:bg-gray-800/80 border border-gray-200/50 dark:border-gray-700/50">
              <div className="space-y-1">
                <Label htmlFor="default-mode" className="text-base font-medium">Default Analysis Mode</Label>
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
                <SelectTrigger className="w-48 h-12 rounded-xl border-2 focus:border-blue-500">
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

            <div className="flex items-center justify-between p-4 rounded-xl bg-white/80 dark:bg-gray-800/80 border border-gray-200/50 dark:border-gray-700/50">
              <div className="space-y-1">
                <Label htmlFor="voice-enabled" className="text-base font-medium">Voice Recording</Label>
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

            <div className="flex items-center justify-between p-4 rounded-xl bg-white/80 dark:bg-gray-800/80 border border-gray-200/50 dark:border-gray-700/50">
              <div className="space-y-1">
                <Label htmlFor="tts-enabled" className="text-base font-medium">Text-to-Speech</Label>
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
        </div>
      </Card>

      {/* About */}
      <Card className="border-0 shadow-2xl bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800">
        <div className="p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-info-500 to-info-600 flex items-center justify-center">
              <Info className="h-5 w-5 text-white" />
            </div>
            <h3 className="text-2xl font-semibold">About MantrAI</h3>
          </div>
          <div className="space-y-4 p-4 rounded-xl bg-white/80 dark:bg-gray-800/80 border border-gray-200/50 dark:border-gray-700/50">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold text-base mb-2 text-primary">Platform</h4>
                <p className="text-sm text-muted-foreground">
                  <strong className="text-foreground">MantrAI</strong> - Advanced Multi-Modal Emotion Detection Platform
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-base mb-2 text-primary">Version</h4>
                <p className="text-sm text-muted-foreground">1.0.0</p>
              </div>
              <div>
                <h4 className="font-semibold text-base mb-2 text-primary">AI Models</h4>
                <p className="text-sm text-muted-foreground">
                  Powered by BiLSTM and HuggingFace transformer models for precise emotion analysis
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-base mb-2 text-primary">Technology</h4>
                <p className="text-sm text-muted-foreground">
                  Next.js, TypeScript, Supabase, and advanced neural networks
                </p>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
