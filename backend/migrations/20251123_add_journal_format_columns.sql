-- Add new columns for 7-section journal format
-- Migration: Add title, date_time, context, reflections, emotions_text, insights, plans columns

ALTER TABLE journal_entries
ADD COLUMN IF NOT EXISTS title TEXT,
ADD COLUMN IF NOT EXISTS date_time TEXT,
ADD COLUMN IF NOT EXISTS context TEXT,
ADD COLUMN IF NOT EXISTS reflections TEXT,
ADD COLUMN IF NOT EXISTS emotions_text TEXT,
ADD COLUMN IF NOT EXISTS insights JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS plans TEXT;

-- Add comments for documentation
COMMENT ON COLUMN journal_entries.title IS 'Journal entry title (3-8 words capturing day essence)';
COMMENT ON COLUMN journal_entries.date_time IS 'Formatted date and time string';
COMMENT ON COLUMN journal_entries.context IS 'What happened - factual description of events';
COMMENT ON COLUMN journal_entries.reflections IS 'Thoughts and deeper reflections';
COMMENT ON COLUMN journal_entries.emotions_text IS 'Full emotion check section with mood pattern';
COMMENT ON COLUMN journal_entries.insights IS 'Array of key insights and takeaways';
COMMENT ON COLUMN journal_entries.plans IS 'Action items and next steps';

-- Note: Old columns (overview, key_moments, analysis, closing) are kept for backward compatibility
