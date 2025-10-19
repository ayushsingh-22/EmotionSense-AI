-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create emotion_analysis table for storing analysis results
CREATE TABLE public.emotion_analysis (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT CHECK (type IN ('text', 'voice', 'multimodal')) NOT NULL,
    input_text TEXT,
    transcript TEXT,
    emotion TEXT NOT NULL,
    confidence REAL CHECK (confidence >= 0 AND confidence <= 1) NOT NULL,
    scores JSONB,
    audio_features JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create profiles table (extends auth.users)
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create emotion_sessions table for tracking analysis sessions
CREATE TABLE public.emotion_sessions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    session_type TEXT CHECK (session_type IN ('text', 'voice', 'multimodal', 'chat')) NOT NULL,
    emotion_detected TEXT NOT NULL,
    confidence_score REAL CHECK (confidence_score >= 0 AND confidence_score <= 1),
    input_text TEXT,
    audio_url TEXT,
    ai_response TEXT NOT NULL,
    feedback_rating INTEGER CHECK (feedback_rating >= 1 AND feedback_rating <= 5),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create chat_messages table for conversational chat feature
CREATE TABLE public.chat_messages (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    session_id TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    message_type TEXT CHECK (message_type IN ('user', 'assistant')) NOT NULL,
    content TEXT NOT NULL,
    emotion_detected TEXT,
    confidence_score REAL CHECK (confidence_score >= 0 AND confidence_score <= 1),
    audio_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create indexes for better performance
CREATE INDEX idx_emotion_analysis_user_id ON public.emotion_analysis(user_id);
CREATE INDEX idx_emotion_analysis_created_at ON public.emotion_analysis(created_at DESC);
CREATE INDEX idx_emotion_analysis_emotion ON public.emotion_analysis(emotion);
CREATE INDEX idx_emotion_analysis_type ON public.emotion_analysis(type);
CREATE INDEX idx_emotion_sessions_user_id ON public.emotion_sessions(user_id);
CREATE INDEX idx_emotion_sessions_created_at ON public.emotion_sessions(created_at DESC);
CREATE INDEX idx_emotion_sessions_emotion ON public.emotion_sessions(emotion_detected);
CREATE INDEX idx_chat_messages_user_id ON public.chat_messages(user_id);
CREATE INDEX idx_chat_messages_session_id ON public.chat_messages(session_id);
CREATE INDEX idx_chat_messages_created_at ON public.chat_messages(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.emotion_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emotion_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for emotion_analysis
CREATE POLICY "Users can view own emotion analysis" ON public.emotion_analysis
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own emotion analysis" ON public.emotion_analysis
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own emotion analysis" ON public.emotion_analysis
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own emotion analysis" ON public.emotion_analysis
    FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for profiles
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Create RLS policies for emotion_sessions
CREATE POLICY "Users can view own emotion sessions" ON public.emotion_sessions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own emotion sessions" ON public.emotion_sessions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own emotion sessions" ON public.emotion_sessions
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own emotion sessions" ON public.emotion_sessions
    FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for chat_messages
CREATE POLICY "Users can view own chat messages" ON public.chat_messages
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chat messages" ON public.chat_messages
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own chat messages" ON public.chat_messages
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own chat messages" ON public.chat_messages
    FOR DELETE USING (auth.uid() = user_id);

-- Create function to automatically create profile on user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
        NEW.raw_user_meta_data->>'avatar_url'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically create profile on user registration
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at on profiles
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();