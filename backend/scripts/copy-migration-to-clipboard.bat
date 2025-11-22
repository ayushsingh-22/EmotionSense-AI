@echo off
echo Copying migration SQL to clipboard...
type "C:\Users\ayush\OneDrive\Desktop\Code Minor\backend\migrations\20251122_consolidate_insights_tables.sql" | clip
echo.
echo ✅ Migration SQL copied to clipboard!
echo.
echo Now paste it into Supabase SQL Editor and run it.
pause
