'use client';

import { useEffect, useRef } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { Card } from '@/components/ui/card';

interface WaveformVisualizerProps {
  audioURL?: string | null;
  isRecording?: boolean;
}

export function WaveformVisualizer({ audioURL, isRecording }: WaveformVisualizerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize WaveSurfer
    const wavesurfer = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#8B5CF6',
      progressColor: '#6366F1',
      cursorColor: '#3B82F6',
      barWidth: 3,
      barRadius: 3,
      cursorWidth: 1,
      height: 100,
      barGap: 2,
      normalize: true,
    });

    wavesurferRef.current = wavesurfer;

    return () => {
      wavesurfer.destroy();
    };
  }, []);

  useEffect(() => {
    if (audioURL && wavesurferRef.current) {
      wavesurferRef.current.load(audioURL);
    }
  }, [audioURL]);

  return (
    <Card className="p-4">
      <div
        ref={containerRef}
        className={`w-full ${isRecording ? 'animate-pulse' : ''}`}
      />
      {!audioURL && !isRecording && (
        <div className="flex items-center justify-center h-[100px] text-muted-foreground">
          <p className="text-sm">No audio recorded yet</p>
        </div>
      )}
    </Card>
  );
}
