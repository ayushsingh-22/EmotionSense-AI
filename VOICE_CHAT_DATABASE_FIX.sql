-- Fix for Voice Chat Database Issues - SAFE VERSION
-- Run this in your Supabase SQL editor
-- This script is idempotent and safe to run multiple times

-- Step 1: Add created_at column ONLY if it doesn't exist
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
        
        RAISE NOTICE 'Added created_at column';
        
        -- Update existing records to have created_at = timestamp
        UPDATE emotion_analysis 
        SET created_at = timestamp 
        WHERE created_at IS NULL;
    ELSE
        RAISE NOTICE 'created_at column already exists - skipping';
    END IF;
END $$;

-- Step 2: Add audio_features column ONLY if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public'
        AND table_name = 'emotion_analysis' 
        AND column_name = 'audio_features'
    ) THEN
        ALTER TABLE emotion_analysis 
        ADD COLUMN audio_features JSONB;
        
        RAISE NOTICE 'Added audio_features column';
    ELSE
        RAISE NOTICE 'audio_features column already exists - skipping';
    END IF;
END $$;

-- Step 3: Fix column naming - SAFE VERSION
-- Only rename if source exists AND target doesn't exist
DO $$ 
BEGIN
    -- Rename userId to user_id (only if userid exists and user_id doesn't)
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
        RAISE NOTICE 'Renamed userid to user_id';
    ELSE
        RAISE NOTICE 'user_id column already correct - skipping rename';
    END IF;
    
    -- Rename audioFeatures to audio_features (only if audiofeatures exists and audio_features doesn't)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public'
        AND table_name = 'emotion_analysis' 
        AND column_name = 'audiofeatures'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public'
        AND table_name = 'emotion_analysis' 
        AND column_name = 'audio_features'
    ) THEN
        ALTER TABLE emotion_analysis 
        RENAME COLUMN audiofeatures TO audio_features;
        RAISE NOTICE 'Renamed audiofeatures to audio_features';
    ELSE
        RAISE NOTICE 'audio_features column already correct - skipping rename';
    END IF;
END $$;

-- Step 4: Add input_text column ONLY if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public'
        AND table_name = 'emotion_analysis' 
        AND column_name = 'input_text'
    ) THEN
        -- If 'input' column exists, rename it to 'input_text'
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public'
            AND table_name = 'emotion_analysis' 
            AND column_name = 'input'
        ) THEN
            ALTER TABLE emotion_analysis 
            RENAME COLUMN input TO input_text;
            RAISE NOTICE 'Renamed input to input_text';
        ELSE
            -- Otherwise, create new column
            ALTER TABLE emotion_analysis 
            ADD COLUMN input_text TEXT;
            RAISE NOTICE 'Added input_text column';
        END IF;
    ELSE
        RAISE NOTICE 'input_text column already exists - skipping';
    END IF;
END $$;

-- Step 5: Verify the schema
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM 
    information_schema.columns
WHERE 
    table_name = 'emotion_analysis'
ORDER BY 
    ordinal_position;

-- Step 6: Create index on created_at for performance
CREATE INDEX IF NOT EXISTS idx_emotion_analysis_created_at 
ON emotion_analysis(created_at DESC);

-- Done! Your emotion_analysis table should now have all required columns.
