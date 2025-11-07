-- COMPLETE DATABASE FIX for Voice Chat
-- Run this entire script in your Supabase SQL Editor
-- This is safe to run multiple times

-- Step 1: Add created_at column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public'
        AND table_name = 'emotion_analysis' 
        AND column_name = 'created_at'
    ) THEN
        ALTER TABLE emotion_analysis 
        ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        
        UPDATE emotion_analysis 
        SET created_at = timestamp 
        WHERE created_at IS NULL;
        
        RAISE NOTICE '✅ Added created_at column';
    ELSE
        RAISE NOTICE 'ℹ️  created_at column already exists';
    END IF;
END $$;

-- Step 2: Add input_text column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public'
        AND table_name = 'emotion_analysis' 
        AND column_name = 'input_text'
    ) THEN
        ALTER TABLE emotion_analysis 
        ADD COLUMN input_text TEXT;
        
        RAISE NOTICE '✅ Added input_text column';
    ELSE
        RAISE NOTICE 'ℹ️  input_text column already exists';
    END IF;
END $$;

-- Step 3: Ensure user_id column exists (rename from userId if needed)
DO $$ 
BEGIN
    -- Check if userId exists but user_id doesn't
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public'
        AND table_name = 'emotion_analysis' 
        AND column_name = 'userid'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public'
        AND table_name = 'emotion_analysis' 
        AND column_name = 'user_id'
    ) THEN
        ALTER TABLE emotion_analysis 
        RENAME COLUMN userid TO user_id;
        RAISE NOTICE '✅ Renamed userid to user_id';
    ELSE
        RAISE NOTICE 'ℹ️  user_id column already correct';
    END IF;
END $$;

-- Step 4: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_emotion_analysis_created_at 
ON emotion_analysis(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_emotion_analysis_user_id 
ON emotion_analysis(user_id);

-- Step 5: Verify all required columns exist
DO $$
DECLARE
    missing_columns TEXT[];
    col TEXT;
BEGIN
    -- Check for required columns
    SELECT ARRAY_AGG(column_name) INTO missing_columns
    FROM (
        SELECT unnest(ARRAY['id', 'user_id', 'type', 'input_text', 'transcript', 
                            'emotion', 'confidence', 'scores', 'audio_features', 
                            'timestamp', 'created_at']) AS column_name
    ) required
    WHERE column_name NOT IN (
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'emotion_analysis'
    );
    
    IF missing_columns IS NOT NULL THEN
        RAISE NOTICE '⚠️  Missing columns: %', array_to_string(missing_columns, ', ');
    ELSE
        RAISE NOTICE '✅ All required columns exist!';
    END IF;
END $$;

-- Step 6: Display current schema
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM 
    information_schema.columns
WHERE 
    table_schema = 'public'
    AND table_name = 'emotion_analysis'
ORDER BY 
    ordinal_position;
