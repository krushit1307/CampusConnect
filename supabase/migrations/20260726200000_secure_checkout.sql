-- Migration: 20260726200000_secure_checkout.sql
-- Description: Create database function for secure concurrent ticket checkout utilizing advisory locks.

-- 1. Create check-out RPC function
CREATE OR REPLACE FUNCTION public.secure_event_checkout(
    p_event_id UUID,
    p_user_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lock_key INT;
  v_lock_acquired BOOLEAN;
  v_max_capacity INT;
  v_current_rsvps INT;
  v_requires_approval BOOLEAN;
  v_has_rsvped BOOLEAN;
BEGIN
  -- Convert UUID string deterministically to a signed 32-bit integer for PG advisory locks
  v_lock_key := ('x' || substr(md5(p_event_id::text), 1, 8))::bit(32)::int;

  -- A. Try to acquire transaction-level exclusive advisory lock on the key
  SELECT pg_try_advisory_xact_lock(v_lock_key) INTO v_lock_acquired;

  IF NOT v_lock_acquired THEN
    RETURN 'BUSY';
  END IF;

  -- B. Check if user already has an RSVP record
  SELECT EXISTS (
    SELECT 1 FROM public.event_rsvps 
    WHERE event_id = p_event_id AND user_id = p_user_id
  ) INTO v_has_rsvped;

  IF v_has_rsvped THEN
    RETURN 'ALREADY_RSVPED';
  END IF;

  -- C. Fetch event parameters
  SELECT max_attendees, requires_approval
  INTO v_max_capacity, v_requires_approval
  FROM public.events
  WHERE id = p_event_id;

  -- D. Count existing RSVPs
  SELECT COUNT(*)
  INTO v_current_rsvps
  FROM public.event_rsvps
  WHERE event_id = p_event_id;

  -- E. Verify capacity if limits exist
  IF v_max_capacity IS NOT NULL AND v_current_rsvps >= v_max_capacity THEN
    RETURN 'FULL';
  END IF;

  -- F. Create RSVP record
  INSERT INTO public.event_rsvps (event_id, user_id, status)
  VALUES (
    p_event_id,
    p_user_id,
    CASE WHEN v_requires_approval = TRUE THEN 'PENDING' ELSE 'FREE' END
  );

  RETURN 'SUCCESS';
END;
$$;

-- 2. Grant permissions
GRANT EXECUTE ON FUNCTION public.secure_event_checkout(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.secure_event_checkout(UUID, UUID) TO service_role;
