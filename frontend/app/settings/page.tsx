'use client';

import { useStore } from '@/store/useStore';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useTheme } from 'next-themes';

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { preferences, updatePreferences } = useStore();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-2">
          Customize your experience
        </p>
      </div>

      {/* Appearance Settings */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Appearance</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="theme">Theme</Label>
              <p className="text-sm text-muted-foreground">
                Choose your preferred color scheme
              </p>
            </div>
            <Select value={theme} onValueChange={setTheme}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Analysis Settings */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Analysis Preferences</h3>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="default-mode">Default Analysis Mode</Label>
              <p className="text-sm text-muted-foreground">
                Choose which mode to use by default
              </p>
            </div>
            <Select
              value={preferences.defaultMode}
              onValueChange={(value: 'text' | 'voice' | 'multimodal') =>
                updatePreferences({ defaultMode: value })
              }
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Text</SelectItem>
                <SelectItem value="voice">Voice</SelectItem>
                <SelectItem value="multimodal">Multi-Modal</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="voice-enabled">Voice Recording</Label>
              <p className="text-sm text-muted-foreground">
                Enable microphone access for voice analysis
              </p>
            </div>
            <Switch
              id="voice-enabled"
              checked={preferences.voiceEnabled}
              onCheckedChange={(checked) =>
                updatePreferences({ voiceEnabled: checked })
              }
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="tts-enabled">Text-to-Speech</Label>
              <p className="text-sm text-muted-foreground">
                Enable voice playback for AI responses
              </p>
            </div>
            <Switch
              id="tts-enabled"
              checked={preferences.ttsEnabled}
              onCheckedChange={(checked) =>
                updatePreferences({ ttsEnabled: checked })
              }
            />
          </div>
        </div>
      </Card>

      {/* About */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">About</h3>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p><strong>Emotion AI</strong> - Multi-Modal Emotion Detection Platform</p>
          <p>Version 1.0.0</p>
          <p>Powered by BiLSTM and HuggingFace models</p>
        </div>
      </Card>
    </div>
  );
}
