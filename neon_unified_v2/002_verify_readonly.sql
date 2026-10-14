-- Read-only verification after applying 001 against development branch.
SELECT table_name FROM information_schema.tables
WHERE table_schema='public' AND table_name IN (
  'user_preferences','user_consents','mood_checkins','journal_entries',
  'media_assets','content_items','activity_sessions','activity_feedback',
  'recommendation_runs','recommendation_items') ORDER BY table_name;

SELECT conrelid::regclass::text AS table_name, conname AS constraint_name, contype
FROM pg_constraint
WHERE connamespace='public'::regnamespace
  AND conrelid::regclass::text IN (
  'user_preferences','user_consents','mood_checkins','journal_entries',
  'media_assets','content_items','activity_sessions','activity_feedback',
  'recommendation_runs','recommendation_items')
ORDER BY table_name, constraint_name;

-- Historical issue: report orphaned legacy activity references; do not delete automatically.
SELECT COUNT(*) AS orphaned_legacy_chat_activity_count
FROM public.master_user_activity a
LEFT JOIN public.chat_sessions s ON s.id=a.session_id
WHERE a.source='chat' AND a.session_id IS NOT NULL AND s.id IS NULL;
