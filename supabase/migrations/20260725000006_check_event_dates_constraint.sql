-- ============================================================
-- Migration: 20260725000006_check_event_dates_constraint.sql
-- Issue: #1102
-- Description: Adds check_event_dates CHECK constraint on public.events
--              to ensure end_date >= start_date at the database level.
-- ============================================================

-- Drop existing check_event_dates constraint if it exists
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS check_event_dates;

-- Add CHECK constraint enforcing end_date >= start_date
ALTER TABLE public.events
ADD CONSTRAINT check_event_dates
CHECK (start_date IS NULL OR end_date IS NULL OR end_date >= start_date);
