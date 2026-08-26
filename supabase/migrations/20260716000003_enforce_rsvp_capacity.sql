-- Migration: Enforce RSVP capacity limits via trigger
-- This trigger function runs BEFORE INSERT on event_rsvps to check if the event
-- has a max_attendees limit, and if so, aborts the insert when capacity is full.

-- Step 1: Create the trigger function
CREATE OR REPLACE FUNCTION public.check_event_capacity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max_attendees INTEGER;
  v_current_count INTEGER;
BEGIN
  -- Fetch the max_attendees for the event being RSVP'd to.
  -- If max_attendees is NULL, the event has unlimited capacity.
  SELECT max_attendees
  INTO v_max_attendees
  FROM public.events
  WHERE id = NEW.event_id;

  -- Only enforce capacity if a limit is set
  IF v_max_attendees IS NOT NULL THEN
    -- Count existing approved RSVPs for this event
    SELECT COUNT(*)
    INTO v_current_count
    FROM public.event_rsvps
    WHERE event_id = NEW.event_id;

    -- Raise an exception if at or over capacity
    IF v_current_count >= v_max_attendees THEN
      RAISE EXCEPTION 'Event has reached its maximum capacity of % attendees.', v_max_attendees
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Step 2: Bind the trigger to run BEFORE INSERT-- 2. Create the trigger
DROP TRIGGER IF EXISTS before_rsvp_insert ON public.event_rsvps;
CREATE TRIGGER before_rsvp_insert
BEFORE INSERT ON public.event_rsvps
FOR EACH ROW
EXECUTE FUNCTION public.check_event_capacity();
