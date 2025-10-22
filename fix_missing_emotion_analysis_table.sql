-- Fix for missing emotion_analysis table
-- Run this in your Supabase SQL editor to fix the connection error

-- Create emotion_analysis table for storing detailed emotion analysis data
CREATE TABLE IF NOT EXISTS emotion_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    userId UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- 'text', 'voice', 'multimodal'
    input TEXT,
    transcript TEXT,
    emotion TEXT,
    confidence DECIMAL(3,2),
    scores JSONB, -- Store emotion scores as JSON
    audioFeatures JSONB, -- Store audio features as JSON
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_emotion_analysis_userId ON emotion_analysis(userId);
CREATE INDEX IF NOT EXISTS idx_emotion_analysis_timestamp ON emotion_analysis(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_emotion_analysis_type ON emotion_analysis(type);