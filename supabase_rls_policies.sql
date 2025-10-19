-- Row Level Security Policies for Chat System
-- Run this in your Supabase SQL editor after creating the tables

-- Enable RLS on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Enable RLS on chat_sessions
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;

-- Enable RLS on chat_messages
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Policy for profiles: Users can access only their own profile
CREATE POLICY "Users can access only their own profile" ON profiles
    FOR ALL USING (auth.uid() = id);

-- Policy for chat_sessions: Users can access only their own sessions
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;

-- Enable RLS on chat_messages
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Policy for chat_sessions: Users can access only their own sessions
CREATE POLICY "Users can access only their own sessions" ON chat_sessions
    FOR ALL USING (auth.uid() = user_id);

-- Policy for chat_messages: Users can access only their own messages
CREATE POLICY "Users can access only their own messages" ON chat_messages
    FOR ALL USING (auth.uid() = user_id);

-- Additional policies for better granularity
CREATE POLICY "Users can insert their own sessions" ON chat_sessions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sessions" ON chat_sessions
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sessions" ON chat_sessions
    FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own messages" ON chat_messages
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own messages" ON chat_messages
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own messages" ON chat_messages
    FOR DELETE USING (auth.uid() = user_id);