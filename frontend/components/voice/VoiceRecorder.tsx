'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Mic, Square, Pause, Play, RotateCcw } from 'lucide-react';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';

interface VoiceRecorderProps {
  onRecordingComplete?: (audioBlob: Blob) => void;
}

export function VoiceRecorder({ onRecordingComplete }: VoiceRecorderProps) {
  const {
    isRecording,
    isPaused,
    recordingTime,
    audioBlob,
    audioURL,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    resetRecording,
    error,
  } = useVoiceRecorder();

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStop = async () => {
    try {
      await stopRecording();
    } catch (error) {
      console.error('Error stopping recording:', error);
    }
  };

  const handleComplete = () => {
    if (audioBlob && onRecordingComplete) {
      onRecordingComplete(audioBlob);
    }
  };

  return (
    <Card className="p-6">
      <div className="space-y-6">
        {/* Timer */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 text-4xl font-mono font-bold">
            {isRecording && !isPaused && (
              <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
            )}
            {formatTime(recordingTime)}
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            {isRecording
              ? isPaused
                ? 'Recording paused'
                : 'Recording in progress...'
              : audioBlob
              ? 'Recording complete'
              : 'Ready to record'}
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
            {error}
          </div>
        )}

        {/* Audio Player */}
        {audioURL && !isRecording && (
          <div className="space-y-2">
            <audio src={audioURL} controls className="w-full" />
          </div>
        )}

        {/* Control Buttons */}
        <div className="flex justify-center gap-3">
          {!isRecording && !audioBlob && (
            <Button
              size="lg"
              onClick={startRecording}
              className="gap-2"
            >
              <Mic className="h-5 w-5" />
              Start Recording
            </Button>
          )}

          {isRecording && (
            <>
              {isPaused ? (
                <Button
                  size="lg"
                  onClick={resumeRecording}
                  variant="outline"
                  className="gap-2"
                >
                  <Play className="h-5 w-5" />
                  Resume
                </Button>
              ) : (
                <Button
                  size="lg"
                  onClick={pauseRecording}
                  variant="outline"
                  className="gap-2"
                >
                  <Pause className="h-5 w-5" />
                  Pause
                </Button>
              )}

              <Button
                size="lg"
                onClick={handleStop}
                variant="destructive"
                className="gap-2"
              >
                <Square className="h-5 w-5" />
                Stop
              </Button>
            </>
          )}

          {audioBlob && !isRecording && (
            <>
              <Button
                size="lg"
                onClick={resetRecording}
                variant="outline"
                className="gap-2"
              >
                <RotateCcw className="h-5 w-5" />
                Reset
              </Button>

              <Button
                size="lg"
                onClick={handleComplete}
                className="gap-2"
              >
                Analyze Recording
              </Button>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
