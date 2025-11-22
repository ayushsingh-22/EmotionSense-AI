-- Migration: Backfill emotion_data in master_user_activity from messages table
-- Created: 2025-11-22
-- Purpose: Fix NULL emotion_data in master_user_activity by copying from messages table

-- Step 1: Update master_user_activity with emotion data from messages table
-- Match on user_id, session_id, and approximate timestamp
UPDATE master_user_activity AS m
SET 
  emotion_data = CASE 
    WHEN msg.emotion IS NOT NULL OR msg.emotion_confidence IS NOT NULL THEN
      jsonb_build_object(
        'emotion', COALESCE(msg.emotion, 'neutral'),
        'confidence', COALESCE(msg.emotion_confidence, 0.5),
        'scores', COALESCE(msg.metadata->'scores', '{}'::jsonb),
        'source', 'backfilled_from_messages'
      )
    ELSE
      m.emotion_data
  END,
  primary_emotion = COALESCE(msg.emotion, m.primary_emotion, 'neutral')
FROM messages AS msg
WHERE 
  m.user_id = msg.user_id
  AND m.session_id = msg.session_id
  AND m.role = msg.role
  AND (m.emotion_data IS NULL OR m.emotion_data = '{}'::jsonb OR NOT (m.emotion_data ? 'emotion'))
  AND ABS(EXTRACT(EPOCH FROM (m.created_at - msg.created_at))) < 2; -- Within 2 seconds

-- Step 2: For remaining NULLs (messages without corresponding messages table entries),
-- set default values to prevent insights from breaking
UPDATE master_user_activity
SET 
  emotion_data = jsonb_build_object(
    'emotion', COALESCE(primary_emotion, 'neutral'),
    'confidence', 0.5,
    'source', 'default_fallback'
  ),
  primary_emotion = COALESCE(primary_emotion, 'neutral')
WHERE 
  emotion_data IS NULL 
  OR emotion_data = '{}'::jsonb 
  OR NOT (emotion_data ? 'emotion');

-- Step 3: Add comment documenting the backfill
COMMENT ON COLUMN master_user_activity.emotion_data IS 
  'JSONB: {emotion: string, confidence: float, scores: object, transcript: string}. Backfilled 2025-11-22.';

-- Step 4: Verify the results
DO $$
DECLARE
  total_records INTEGER;
  null_emotion_data INTEGER;
  valid_emotion_data INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_records FROM master_user_activity;
  SELECT COUNT(*) INTO null_emotion_data FROM master_user_activity 
    WHERE emotion_data IS NULL OR emotion_data = '{}'::jsonb;
  SELECT COUNT(*) INTO valid_emotion_data FROM master_user_activity 
    WHERE emotion_data ? 'emotion';
  
  RAISE NOTICE '=== BACKFILL VERIFICATION ===';
  RAISE NOTICE 'Total records: %', total_records;
  RAISE NOTICE 'Records with NULL/empty emotion_data: %', null_emotion_data;
  RAISE NOTICE 'Records with valid emotion_data: %', valid_emotion_data;
  RAISE NOTICE 'Completion: % %%', ROUND((valid_emotion_data::numeric / total_records * 100), 2);
END $$;
