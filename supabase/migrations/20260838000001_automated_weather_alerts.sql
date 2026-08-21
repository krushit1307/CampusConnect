-- Migration: Automated Weather Alerts & Venue Pivot
-- Issue #3018

ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS is_outdoor BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS backup_indoor_venue TEXT;

-- RPC to atomically shift venue and notify attendees
CREATE OR REPLACE FUNCTION public.shift_event_venue(p_event_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event RECORD;
  v_user_role TEXT;
  v_rsvp RECORD;
BEGIN
  -- 1. Get event details and verify caller has access
  SELECT * INTO v_event FROM public.events WHERE id = p_event_id;
  
  IF v_event IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Event not found');
  END IF;
  
  IF v_event.backup_indoor_venue IS NULL OR TRIM(v_event.backup_indoor_venue) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'No backup venue specified');
  END IF;

  -- Verify permissions: Caller must be the creator OR an admin of the club
  IF v_event.created_by != auth.uid() THEN
    SELECT role INTO v_user_role 
    FROM public.club_members 
    WHERE club_id = v_event.club_id AND user_id = auth.uid() AND status = 'approved';
    
    IF v_user_role != 'admin' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;
  END IF;

  -- 2. Update Event Location
  UPDATE public.events
  SET location = v_event.backup_indoor_venue,
      is_outdoor = false,
      updated_at = NOW()
  WHERE id = p_event_id;

  -- 3. Notify all RSVPs
  FOR v_rsvp IN 
    SELECT user_id FROM public.event_rsvps WHERE event_id = p_event_id 
  LOOP
    INSERT INTO public.notifications (
      user_id,
      type,
      title,
      message,
      link,
      entity_id,
      entity_type
    ) VALUES (
      v_rsvp.user_id,
      'alert',
      'Event Venue Changed due to Weather',
      'The venue for "' || v_event.title || '" has been changed to ' || v_event.backup_indoor_venue || '.',
      '/events/' || p_event_id,
      p_event_id,
      'event'
    );
  END LOOP;

  RETURN jsonb_build_object('success', true);
END;
$$;
