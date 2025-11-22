-- Add journal_entry column to master_user_activity table
-- This column will store the journal content for journal_entry activity types

ALTER TABLE master_user_activity 
ADD COLUMN IF NOT EXISTS journal_entry TEXT;

-- Add index for faster journal queries
CREATE INDEX IF NOT EXISTS idx_master_user_activity_journal_type 
ON master_user_activity (user_id, activity_type, local_date) 
WHERE activity_type = 'journal_entry';

-- Add comment for documentation
COMMENT ON COLUMN master_user_activity.journal_entry IS 'Journal content for journal_entry activity types';