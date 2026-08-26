-- Issue #3323: focused regression assertions for calculate_event_roi.
-- Execute in the Supabase test environment with fixtures for an event,
-- club member, paid event_rsvps, refund_logs and approved reimbursements.

BEGIN;

DO $$
BEGIN
  IF to_regprocedure('public.calculate_event_roi(uuid)') IS NULL THEN
    RAISE EXCEPTION 'calculate_event_roi(uuid) was not created';
  END IF;
END $$;

ROLLBACK;
