-- Migration: Consolidate Insights Tables
-- Purpose: Deprecate legacy tables and ensure single source of truth (master_user_activity)
-- Date: 2025-11-22

-- =============================================================================
-- STEP 1: Add indexes to master_user_activity for performance
-- =============================================================================

-- Index for date-based queries (used heavily in insights)
CREATE INDEX IF NOT EXISTS idx_master_activity_local_date 
ON master_user_activity(user_id, local_date DESC);

-- Index for emotion queries
CREATE INDEX IF NOT EXISTS idx_master_activity_emotion 
ON master_user_activity(user_id, created_at DESC) 
WHERE emotion_data IS NOT NULL;

-- Index for date range queries
CREATE INDEX IF NOT EXISTS idx_master_activity_date_range 
ON master_user_activity(user_id, created_at) 
WHERE emotion_data IS NOT NULL;

-- =============================================================================
-- STEP 2: Add mood_score CHECK constraint to legacy tables (for data integrity)
-- =============================================================================

-- Add constraint to daily_emotion_summary if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'daily_emotion_summary_mood_score_check'
  ) THEN
    ALTER TABLE daily_emotion_summary 
    ADD CONSTRAINT daily_emotion_summary_mood_score_check 
    CHECK (mood_score >= 0 AND mood_score <= 100);
  END IF;
END $$;

-- Add constraint to weekly_emotion_summary if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'weekly_emotion_summary_avg_mood_score_check'
  ) THEN
    ALTER TABLE weekly_emotion_summary 
    ADD CONSTRAINT weekly_emotion_summary_avg_mood_score_check 
    CHECK (average_mood_score >= 0 AND average_mood_score <= 100);
  END IF;
END $$;

-- =============================================================================
-- STEP 3: Add deprecation column to legacy tables
-- =============================================================================

-- Mark daily_emotion_summary as deprecated
ALTER TABLE daily_emotion_summary 
ADD COLUMN IF NOT EXISTS deprecated BOOLEAN DEFAULT TRUE;

COMMENT ON TABLE daily_emotion_summary IS 
'DEPRECATED: This table is no longer actively used. Use master_user_activity as single source of truth. Kept for historical data only.';

-- Mark weekly_emotion_summary as deprecated
ALTER TABLE weekly_emotion_summary 
ADD COLUMN IF NOT EXISTS deprecated BOOLEAN DEFAULT TRUE;

COMMENT ON TABLE weekly_emotion_summary IS 
'DEPRECATED: This table is no longer actively used. Weekly insights are computed on-the-fly from master_user_activity. Kept for historical data only.';

-- =============================================================================
-- STEP 4: Create view for backward compatibility (optional)
-- =============================================================================

-- Create a view that computes daily summaries from master_user_activity
-- This provides backward compatibility if any code still queries old tables
CREATE OR REPLACE VIEW v_daily_emotion_summary AS
SELECT 
  gen_random_uuid() AS id,
  user_id,
  local_date AS date,
  -- Compute dominant emotion from JSON data
  (
    SELECT emotion_data->>'emotion' 
    FROM master_user_activity ma2 
    WHERE ma2.user_id = ma.user_id 
      AND ma2.local_date = ma.local_date 
      AND ma2.emotion_data IS NOT NULL
    ORDER BY created_at DESC 
    LIMIT 1
  ) AS dominant_emotion,
  -- Aggregate emotion distribution
  jsonb_object_agg(
    COALESCE(emotion_data->>'emotion', 'neutral'), 
    1
  ) FILTER (WHERE emotion_data IS NOT NULL) AS emotion_distribution,
  -- Average mood score (calculated from emotion scores)
  NULL::numeric AS mood_score, -- Computed in application layer
  COUNT(*) FILTER (WHERE emotion_data IS NOT NULL) AS total_entries,
  NULL::jsonb AS time_segments, -- Computed in application layer
  NULL::jsonb AS trend_points,
  NULL::jsonb AS compass_points,
  NULL::jsonb AS key_moments,
  NULL::text AS summary_text,
  MIN(created_at) AS created_at,
  MAX(created_at) AS updated_at
FROM master_user_activity ma
WHERE emotion_data IS NOT NULL
GROUP BY user_id, local_date;

COMMENT ON VIEW v_daily_emotion_summary IS 
'Real-time view of daily emotion summaries computed from master_user_activity. Use this instead of daily_emotion_summary table.';

-- =============================================================================
-- STEP 5: Add metadata columns to master_user_activity (if needed)
-- =============================================================================

-- Add any missing columns for complete emotion tracking
ALTER TABLE master_user_activity 
ADD COLUMN IF NOT EXISTS mood_score INTEGER;

COMMENT ON COLUMN master_user_activity.mood_score IS 
'Computed mood score (0-100 scale) based on emotion_data. Stored for performance optimization.';

-- Add constraint for mood_score
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'master_activity_mood_score_check'
  ) THEN
    ALTER TABLE master_user_activity 
    ADD CONSTRAINT master_activity_mood_score_check 
    CHECK (mood_score IS NULL OR (mood_score >= 0 AND mood_score <= 100));
  END IF;
END $$;

-- =============================================================================
-- STEP 6: Create function to update mood_score automatically (optional)
-- =============================================================================

CREATE OR REPLACE FUNCTION calculate_mood_score(emotion_json jsonb)
RETURNS INTEGER AS $$
DECLARE
  emotion TEXT;
  confidence NUMERIC;
  base_score INTEGER;
BEGIN
  -- Extract emotion and confidence from JSON
  emotion := LOWER(COALESCE(emotion_json->>'emotion', 'neutral'));
  confidence := COALESCE((emotion_json->>'confidence')::numeric, 0.5);
  
  -- Map emotion to base score (0-100 scale)
  CASE emotion
    WHEN 'joy' THEN base_score := 85;
    WHEN 'surprise' THEN base_score := 70;
    WHEN 'neutral' THEN base_score := 50;
    WHEN 'sadness' THEN base_score := 30;
    WHEN 'fear' THEN base_score := 25;
    WHEN 'anger' THEN base_score := 20;
    WHEN 'disgust' THEN base_score := 18;
    ELSE base_score := 50; -- Default to neutral
  END CASE;
  
  -- Return base score (confidence doesn't change score, just reliability)
  RETURN base_score;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION calculate_mood_score IS 
'Calculate mood score (0-100) from emotion JSON data. Based on unified emotion service logic.';

-- =============================================================================
-- STEP 7: Update existing records with mood_score (one-time migration)
-- =============================================================================

-- Update mood_score for existing records
UPDATE master_user_activity 
SET mood_score = calculate_mood_score(emotion_data)
WHERE emotion_data IS NOT NULL 
  AND mood_score IS NULL;

-- =============================================================================
-- STEP 8: Create trigger to auto-update mood_score on insert/update
-- =============================================================================

CREATE OR REPLACE FUNCTION trigger_update_mood_score()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.emotion_data IS NOT NULL THEN
    NEW.mood_score := calculate_mood_score(NEW.emotion_data);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_mood_score ON master_user_activity;

CREATE TRIGGER trg_update_mood_score
BEFORE INSERT OR UPDATE OF emotion_data ON master_user_activity
FOR EACH ROW
WHEN (NEW.emotion_data IS NOT NULL)
EXECUTE FUNCTION trigger_update_mood_score();

COMMENT ON TRIGGER trg_update_mood_score ON master_user_activity IS 
'Automatically updates mood_score when emotion_data changes';

-- =============================================================================
-- STEP 9: Document the consolidation
-- =============================================================================

COMMENT ON TABLE master_user_activity IS 
'SINGLE SOURCE OF TRUTH for all user emotional activities. Use this table for insights, history, and analytics. Contains all emotion tracking data with computed mood scores.';

COMMENT ON COLUMN master_user_activity.emotion_data IS 
'JSON object containing emotion analysis results: { "emotion": "joy", "confidence": 0.85, "scores": {...}, "models_used": [...] }';

COMMENT ON COLUMN master_user_activity.local_date IS 
'Activity date in IST timezone (YYYY-MM-DD format). Use for date-based queries and daily summaries.';

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================

-- Verification queries (run these to verify migration success):

-- 1. Check indexes
SELECT schemaname, tablename, indexname 
FROM pg_indexes 
WHERE tablename = 'master_user_activity';

-- 2. Check constraints
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'master_user_activity'::regclass;

-- 3. Sample mood score distribution
SELECT 
  CASE 
    WHEN mood_score >= 70 THEN 'Positive (70-100)'
    WHEN mood_score >= 40 THEN 'Neutral (40-69)'
    WHEN mood_score >= 0 THEN 'Negative (0-39)'
    ELSE 'No Data'
  END AS mood_range,
  COUNT(*) as count
FROM master_user_activity
WHERE emotion_data IS NOT NULL
GROUP BY mood_range
ORDER BY MIN(mood_score) DESC NULLS LAST;

-- 4. Verify trigger is active
SELECT tgname, tgenabled 
FROM pg_trigger 
WHERE tgrelid = 'master_user_activity'::regclass;
