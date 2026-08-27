-- Migration: 20260907000000_customizable_push_schedule_dnd.sql
-- Description: Issue #3450 - Build a 'Customizable Push Notification Schedule' (DND Quiet Hours & Emergency Override)

-- 1. Add dnd_start_time and dnd_end_time columns to public.user_preferences
ALTER TABLE public.user_preferences 
ADD COLUMN IF NOT EXISTS dnd_start_time TIME,
ADD COLUMN IF NOT EXISTS dnd_end_time TIME;

-- Sync existing quiet_hours_start and quiet_hours_end if present
UPDATE public.user_preferences
SET 
  dnd_start_time = COALESCE(dnd_start_time, quiet_hours_start),
  dnd_end_time = COALESCE(dnd_end_time, quiet_hours_end)
WHERE dnd_start_time IS NULL OR dnd_end_time IS NULL;

COMMENT ON COLUMN public.user_preferences.dnd_start_time IS 'Start time of Do Not Disturb quiet hours (e.g. 22:00)';
COMMENT ON COLUMN public.user_preferences.dnd_end_time IS 'End time of Do Not Disturb quiet hours (e.g. 08:00)';
