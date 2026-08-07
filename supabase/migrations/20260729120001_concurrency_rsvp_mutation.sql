-- Migration: 20260729120000_concurrency_rsvp_mutation.sql
-- Description: Add optimistic concurrency version tracking and pessimistic row-level locking
--              RPC function (public.manage_event_rsvp) to prevent overbooking on concurrent RSVPs.

-- 1. Add version and available_spots columns to events table if they don't exist
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS available_spots INTEGER;

-- Initialize available_spots for existing events based on max_attendees and current RSVP count
UPDATE public.events e
SET available_spots = CASE 
  WHEN e.max_attendees IS NULL THEN NULL
  ELSE GREATEST(0, e.max_attendees - (
    SELECT COUNT(*) FROM public.event_rsvps r 
    WHERE r.event_id = e.id AND (r.status IS NULL OR r.status NOT IN ('CANCELLED', 'REJECTED'))
  ))
END
WHERE e.available_spots IS NULL AND e.max_attendees IS NOT NULL;


-- 2. Create manage_event_rsvp RPC function with strict SELECT FOR UPDATE locking
CREATE OR REPLACE FUNCTION public.manage_event_rsvp(
    p_event_id UUID,
    p_user_id UUID DEFAULT auth.uid(),
    p_action TEXT DEFAULT 'RSVP'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_effective_user_id UUID;
  v_max_capacity INT;
  v_requires_approval BOOLEAN;
  v_version INT;
  v_current_rsvps INT;
  v_has_rsvped BOOLEAN;
  v_rsvp_status TEXT;
  v_new_version INT;
  v_new_available_spots INT;
  v_normalized_action TEXT;
BEGIN
  -- Fallback to auth.uid() if p_user_id is NULL
  v_effective_user_id := COALESCE(p_user_id, auth.uid());
  IF v_effective_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'UNAUTHORIZED',
      'message', 'User ID is required to RSVP.'
    );
  END IF;

  v_normalized_action := UPPER(COALESCE(p_action, 'RSVP'));

  -- A. Pessimistically lock the event row to block concurrent RSVP mutations on this event
  SELECT max_attendees, requires_approval, COALESCE(version, 1)
  INTO v_max_capacity, v_requires_approval, v_version
  FROM public.events
  WHERE id = p_event_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'EVENT_NOT_FOUND',
      'message', 'Target event does not exist.'
    );
  END IF;

  -- Count existing active RSVPs for this event
  SELECT COUNT(*)
  INTO v_current_rsvps
  FROM public.event_rsvps
  WHERE event_id = p_event_id
    AND (status IS NULL OR status NOT IN ('CANCELLED', 'REJECTED'));

  -- B. Handle RSVP action
  IF v_normalized_action IN ('RSVP', 'ADD', 'REGISTER') THEN
    -- Check if user is already RSVP'd
    SELECT EXISTS (
      SELECT 1 FROM public.event_rsvps
      WHERE event_id = p_event_id
        AND user_id = v_effective_user_id
        AND (status IS NULL OR status NOT IN ('CANCELLED', 'REJECTED'))
    ) INTO v_has_rsvped;

    IF v_has_rsvped THEN
      RETURN jsonb_build_object(
        'success', false,
        'code', 'ALREADY_RSVPED',
        'message', 'You have already RSVPed for this event.',
        'available_spots', CASE WHEN v_max_capacity IS NULL THEN NULL ELSE GREATEST(0, v_max_capacity - v_current_rsvps) END,
        'version', v_version
      );
    END IF;

    -- Strict Capacity Check: Ensure max_attendees is not exceeded
    IF v_max_capacity IS NOT NULL AND v_current_rsvps >= v_max_capacity THEN
      RETURN jsonb_build_object(
        'success', false,
        'code', 'EVENT_FULL',
        'message', 'Event is fully booked. No available spots remaining.',
        'available_spots', 0,
        'version', v_version
      );
    END IF;

    -- Determine RSVP status based on whether approval is required
    v_rsvp_status := CASE WHEN v_requires_approval = TRUE THEN 'PENDING' ELSE 'CONFIRMED' END;

    -- Upsert RSVP record
    INSERT INTO public.event_rsvps (event_id, user_id, status, rsvp_at)
    VALUES (p_event_id, v_effective_user_id, v_rsvp_status, NOW())
    ON CONFLICT (event_id, user_id)
    DO UPDATE SET status = v_rsvp_status, rsvp_at = NOW();

    -- Increment version and update available_spots on the events table
    v_new_version := v_version + 1;
    v_new_available_spots := CASE WHEN v_max_capacity IS NULL THEN NULL ELSE GREATEST(0, v_max_capacity - (v_current_rsvps + 1)) END;

    UPDATE public.events
    SET version = v_new_version,
        available_spots = v_new_available_spots,
        updated_at = NOW()
    WHERE id = p_event_id;

    RETURN jsonb_build_object(
      'success', true,
      'code', 'RSVP_SUCCESS',
      'message', CASE WHEN v_requires_approval = TRUE THEN 'RSVP submitted! Pending approval.' ELSE 'RSVP confirmed!' END,
      'status', v_rsvp_status,
      'available_spots', v_new_available_spots,
      'version', v_new_version
    );

  -- C. Handle CANCEL action
  ELSIF v_normalized_action IN ('CANCEL', 'REMOVE', 'UNRSVP') THEN
    DELETE FROM public.event_rsvps
    WHERE event_id = p_event_id AND user_id = v_effective_user_id;

    -- Recount RSVPs after deletion
    SELECT COUNT(*) INTO v_current_rsvps
    FROM public.event_rsvps
    WHERE event_id = p_event_id
      AND (status IS NULL OR status NOT IN ('CANCELLED', 'REJECTED'));

    v_new_version := v_version + 1;
    v_new_available_spots := CASE WHEN v_max_capacity IS NULL THEN NULL ELSE GREATEST(0, v_max_capacity - v_current_rsvps) END;

    UPDATE public.events
    SET version = v_new_version,
        available_spots = v_new_available_spots,
        updated_at = NOW()
    WHERE id = p_event_id;

    RETURN jsonb_build_object(
      'success', true,
      'code', 'CANCEL_SUCCESS',
      'message', 'RSVP cancelled successfully.',
      'available_spots', v_new_available_spots,
      'version', v_new_version
    );
  ELSE
    RETURN jsonb_build_object(
      'success', false,
      'code', 'INVALID_ACTION',
      'message', 'Action must be RSVP or CANCEL.'
    );
  END IF;
END;
$$;

-- 3. Grant execution permissions
GRANT EXECUTE ON FUNCTION public.manage_event_rsvp(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.manage_event_rsvp(UUID, UUID, TEXT) TO service_role;
