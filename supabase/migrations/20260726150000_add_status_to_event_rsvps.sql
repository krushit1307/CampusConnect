-- Migration: Add status to event_rsvps and requires_approval to events
-- Description: Supports manual RSVP approval flow with waitlist, approved, and rejected states.

-- 1. Add requires_approval column to public.events
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Add status column to public.event_rsvps
ALTER TABLE public.event_rsvps
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'approved';

-- 3. Add CHECK constraint to enforce status values
ALTER TABLE public.event_rsvps
  DROP CONSTRAINT IF EXISTS check_event_rsvps_status;

ALTER TABLE public.event_rsvps
  ADD CONSTRAINT check_event_rsvps_status
  CHECK (status IN ('waitlisted', 'approved', 'rejected'));
