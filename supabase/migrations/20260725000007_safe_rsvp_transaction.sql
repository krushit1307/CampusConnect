-- ============================================================
-- Migration: 20260725000005_safe_rsvp_transaction.sql
-- Issue: #1103
-- Description: Implement safe_rsvp PL/pgSQL function with row-level locking (FOR UPDATE)
--              to prevent race conditions under high concurrency and safely manage waitlist overflow.
-- ============================================================

CREATE OR REPLACE FUNCTION public.safe_rsvp(
  target_event_id UUID,
  target_user_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max_attendees INTEGER;
  v_current_count INTEGER;
  v_club_id UUID;
BEGIN
  -- 1. Explicitly lock the target event row using FOR UPDATE to serialize concurrent RSVPs
  SELECT max_attendees, club_id
  INTO v_max_attendees, v_club_id
  FROM public.events
  WHERE id = target_event_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found' USING ERRCODE = 'P0002';
  END IF;

  -- 2. Check if user already has an active RSVP
  IF EXISTS (
    SELECT 1 FROM public.event_rsvps
    WHERE event_id = target_event_id AND user_id = target_user_id
  ) THEN
    RETURN 'rsvp';
  END IF;

  -- 3. Count current active RSVPs for this event
  SELECT COUNT(*)
  INTO v_current_count
  FROM public.event_rsvps
  WHERE event_id = target_event_id;

  -- 4. Check if event capacity allows another attendee
  IF v_max_attendees IS NULL OR v_current_count < v_max_attendees THEN
    -- Remove from waitlist if user was previously waitlisted
    DELETE FROM public.event_waitlist
    WHERE event_id = target_event_id AND user_id = target_user_id;

    -- Insert user into active RSVPs
    INSERT INTO public.event_rsvps (event_id, user_id)
    VALUES (target_event_id, target_user_id)
    ON CONFLICT (event_id, user_id) DO NOTHING;

    RETURN 'rsvp';
  ELSE
    -- Capacity reached: add user to waitlist
    INSERT INTO public.event_waitlist (event_id, user_id)
    VALUES (target_event_id, target_user_id)
    ON CONFLICT (event_id, user_id) DO NOTHING;

    RETURN 'waitlist';
  END IF;
END;
$$;

-- Grant execution privileges to authenticated users, service role, and anon
GRANT EXECUTE ON FUNCTION public.safe_rsvp(UUID, UUID) TO authenticated, service_role, anon;
