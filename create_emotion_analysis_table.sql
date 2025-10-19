-- Fixed Supabase Database Schema for Emotion AI Platform
-- This schema is fully compatible with your existing backend code

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- Drop existing tables if they exist (CAUTION: This deletes existing data!)
-- =============================================================================
DROP TABLE IF EXISTS public.emotion_analysis CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.emotion_sessions CASCADE;
DROP TABLE IF EXISTS public.chat_messages CASCADE;

-- =============================================================================
-- MAIN EMOTION ANALYSIS TABLE (Backend Compatible - FIXED)
-- =============================================================================

CREATE TABLE public.emotion_analysis (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    
    -- TEXT field for backend compatibility (supports both anonymous and auth users)
    user_id TEXT,
    
    -- Analysis metadata (FIXED type constraint)
    type TEXT CHECK (type IN ('text', 'voice', 'multimodal')) NOT NULL,
    input_text TEXT,
    transcript TEXT,
    emotion TEXT NOT NULL,
    confidence REAL CHECK (confidence >= 0 AND confidence <= 1) NOT NULL,
    scores JSONB,
    audio_features JSONB,
    
    -- Timestamps
    timestamp TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- =============================================================================
-- USER PROFILES TABLE (For authenticated users)
-- =============================================================================

CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    avatar_url TEXT,
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- =============================================================================
-- EMOTION SESSIONS TABLE (For grouping related analyses)
-- =============================================================================

CREATE TABLE public.emotion_sessions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL,
    session_type TEXT CHECK (session_type IN ('text', 'voice', 'multimodal', 'chat')) DEFAULT 'text',
    emotion_detected TEXT,
    confidence_score REAL CHECK (confidence_score >= 0 AND confidence_score <= 1),
    total_messages INTEGER DEFAULT 1,
    session_summary TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- =============================================================================
-- CHAT MESSAGES TABLE (For conversational chat feature)
-- =============================================================================

CREATE TABLE public.chat_messages (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    session_id TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    message_type TEXT CHECK (message_type IN ('user', 'assistant')) NOT NULL,
    content TEXT NOT NULL,
    emotion_detected TEXT,
    confidence_score REAL CHECK (confidence_score >= 0 AND confidence_score <= 1),
    audio_url TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

-- Emotion Analysis indexes
CREATE INDEX idx_emotion_analysis_user_id ON public.emotion_analysis(user_id);
CREATE INDEX idx_emotion_analysis_timestamp ON public.emotion_analysis(timestamp DESC);
CREATE INDEX idx_emotion_analysis_created_at ON public.emotion_analysis(created_at DESC);
CREATE INDEX idx_emotion_analysis_emotion ON public.emotion_analysis(emotion);
CREATE INDEX idx_emotion_analysis_type ON public.emotion_analysis(type);

-- Emotion Sessions indexes
CREATE INDEX idx_emotion_sessions_user_id ON public.emotion_sessions(user_id);
CREATE INDEX idx_emotion_sessions_session_id ON public.emotion_sessions(session_id);
CREATE INDEX idx_emotion_sessions_created_at ON public.emotion_sessions(created_at DESC);
CREATE INDEX idx_emotion_sessions_emotion ON public.emotion_sessions(emotion_detected);

-- Chat Messages indexes
CREATE INDEX idx_chat_messages_user_id ON public.chat_messages(user_id);
CREATE INDEX idx_chat_messages_session_id ON public.chat_messages(session_id);
CREATE INDEX idx_chat_messages_created_at ON public.chat_messages(created_at DESC);

-- Profiles indexes
CREATE INDEX idx_profiles_email ON public.profiles(email);

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE public.emotion_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emotion_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- EMOTION_ANALYSIS POLICIES (Permissive for backend compatibility)
-- =============================================================================

-- Allow service role (backend) full access
CREATE POLICY "Service role full access" ON public.emotion_analysis
    FOR ALL USING (auth.role() = 'service_role');

-- Allow anonymous role access (for testing without auth)
CREATE POLICY "Anonymous access" ON public.emotion_analysis
    FOR ALL USING (auth.role() = 'anon');

-- Allow authenticated users access (for future frontend auth)
CREATE POLICY "Authenticated users access" ON public.emotion_analysis
    FOR ALL USING (auth.role() = 'authenticated');

-- =============================================================================
-- PROFILES POLICIES
-- =============================================================================

CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- =============================================================================
-- EMOTION_SESSIONS POLICIES
-- =============================================================================

CREATE POLICY "Users can view own emotion sessions" ON public.emotion_sessions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own emotion sessions" ON public.emotion_sessions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own emotion sessions" ON public.emotion_sessions
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own emotion sessions" ON public.emotion_sessions
    FOR DELETE USING (auth.uid() = user_id);

-- =============================================================================
-- CHAT_MESSAGES POLICIES
-- =============================================================================

CREATE POLICY "Users can view own chat messages" ON public.chat_messages
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chat messages" ON public.chat_messages
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own chat messages" ON public.chat_messages
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own chat messages" ON public.chat_messages
    FOR DELETE USING (auth.uid() = user_id);

-- =============================================================================
-- FUNCTIONS AND TRIGGERS
-- =============================================================================

-- Function to automatically create profile on user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create profile on user registration
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER emotion_sessions_updated_at BEFORE UPDATE ON public.emotion_sessions
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =============================================================================
-- UTILITY FUNCTIONS
-- =============================================================================

-- Function to get emotion statistics for a user (TEXT user_id)
CREATE OR REPLACE FUNCTION get_user_emotion_stats(target_user_id TEXT, days_back INTEGER DEFAULT 7)
RETURNS TABLE (
    emotion TEXT,
    count BIGINT,
    avg_confidence NUMERIC,
    latest_timestamp TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ea.emotion,
        COUNT(*) as count,
        ROUND(AVG(ea.confidence)::numeric, 3) as avg_confidence,
        MAX(ea.timestamp) as latest_timestamp
    FROM public.emotion_analysis ea
    WHERE ea.user_id = target_user_id
        AND ea.created_at >= NOW() - INTERVAL '1 day' * days_back
    GROUP BY ea.emotion
    ORDER BY count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up old records
CREATE OR REPLACE FUNCTION cleanup_old_analysis(days_old INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.emotion_analysis 
    WHERE created_at < NOW() - INTERVAL '1 day' * days_old;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- VIEWS FOR EASIER QUERYING
-- =============================================================================

-- View for emotion analysis summary
CREATE OR REPLACE VIEW emotion_analysis_summary AS
SELECT 
    id,
    user_id,
    type,
    emotion,
    confidence,
    timestamp,
    created_at,
    EXTRACT(EPOCH FROM (NOW() - created_at))/3600 as hours_ago
FROM public.emotion_analysis
ORDER BY created_at DESC;

-- View for recent emotion trends
CREATE OR REPLACE VIEW recent_emotion_trends AS
SELECT 
    emotion,
    COUNT(*) as count,
    ROUND(AVG(confidence)::numeric, 3) as avg_confidence,
    DATE_TRUNC('day', created_at) as analysis_date
FROM public.emotion_analysis
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY emotion, DATE_TRUNC('day', created_at)
ORDER BY analysis_date DESC, count DESC;

-- =============================================================================
-- COMMENTS FOR DOCUMENTATION
-- =============================================================================

COMMENT ON TABLE public.emotion_analysis IS 'Stores emotion analysis results from text, voice, and multimodal inputs';
COMMENT ON COLUMN public.emotion_analysis.user_id IS 'User identifier (TEXT for backend compatibility)';
COMMENT ON COLUMN public.emotion_analysis.type IS 'Type of analysis: text, voice, or multimodal';
COMMENT ON COLUMN public.emotion_analysis.input_text IS 'Original text input or filename for voice inputs';
COMMENT ON COLUMN public.emotion_analysis.transcript IS 'Speech-to-text transcript for voice inputs';
COMMENT ON COLUMN public.emotion_analysis.emotion IS 'Detected primary emotion';
COMMENT ON COLUMN public.emotion_analysis.confidence IS 'Confidence score between 0 and 1';
COMMENT ON COLUMN public.emotion_analysis.scores IS 'JSON object with all emotion scores';
COMMENT ON COLUMN public.emotion_analysis.audio_features IS 'JSON object with extracted audio features (for voice inputs)';

COMMENT ON TABLE public.profiles IS 'User profiles for authenticated users';
COMMENT ON TABLE public.emotion_sessions IS 'Groups related emotion analyses into sessions';
COMMENT ON TABLE public.chat_messages IS 'Stores conversational chat messages and AI responses';