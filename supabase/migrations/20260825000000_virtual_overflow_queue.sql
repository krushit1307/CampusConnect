-- Migration: Real-Time Event Capacity Overflow Queue (#4142)
-- Adds overflow_stream_url to events, creates virtual_attendees table,
-- and creates RPC functions for queue management.

-- 1. Add overflow stream URL to events table
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS overflow_stream_url TEXT;

-- 2. Create virtual_attendees table
CREATE TABLE IF NOT EXISTS public.virtual_attendees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  queue_position INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'notified', 'claimed', 'expired', 'admitted')),
  notified_at TIMESTAMPTZ,
  claim_deadline TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

-- 3. Indexes for virtual_attendees
CREATE INDEX IF NOT EXISTS idx_virtual_attendees_event_id ON public.virtual_attendees(event_id);
CREATE INDEX IF NOT EXISTS idx_virtual_attendees_event_status ON public.virtual_attendees(event_id, status);
CREATE INDEX IF NOT EXISTS idx_virtual_attendees_event_position ON public.virtual_attendees(event_id, queue_position) WHERE status = 'waiting';

-- 4. RPC: Join the virtual overflow queue
CREATE OR REPLACE FUNCTION public.join_virtual_queue(
  p_event_id UUID,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next_position INTEGER;
  v_result JSONB;
BEGIN
  -- Check if user is already in the queue
  IF EXISTS (
    SELECT 1 FROM public.virtual_attendees
    WHERE event_id = p_event_id AND user_id = p_user_id
    AND status IN ('waiting', 'notified')
  ) THEN
    SELECT jsonb_build_object(
      'success', false,
      'error', 'Already in queue',
      'queue_position', (
        SELECT queue_position FROM public.virtual_attendees
        WHERE event_id = p_event_id AND user_id = p_user_id
        LIMIT 1
      )
    ) INTO v_result;
    RETURN v_result;
  END IF;

  -- Get next queue position
  SELECT COALESCE(MAX(queue_position), 0) + 1
  INTO v_next_position
  FROM public.virtual_attendees
  WHERE event_id = p_event_id;

  -- Insert into queue
  INSERT INTO public.virtual_attendees (event_id, user_id, queue_position, status)
  VALUES (p_event_id, p_user_id, v_next_position, 'waiting');

  SELECT jsonb_build_object(
    'success', true,
    'queue_position', v_next_position,
    'message', 'You have been added to the virtual queue. We will notify you when a seat opens up.'
  ) INTO v_result;
  RETURN v_result;
END;
$$;

-- 5. RPC: Process a physical checkout (scan out) and notify next in virtual queue
CREATE OR REPLACE FUNCTION public.process_physical_checkout(
  p_event_id UUID,
  p_checked_out_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next_virtual RECORD;
  v_claim_duration INTERVAL := INTERVAL '2 minutes';
BEGIN
  -- Find the next person in the virtual queue who is waiting
  SELECT id, user_id, queue_position
  INTO v_next_virtual
  FROM public.virtual_attendees
  WHERE event_id = p_event_id
    AND status = 'waiting'
  ORDER BY queue_position ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'notified_user', null,
      'message', 'No one in virtual queue to notify.'
    );
  END IF;

  -- Update their status to notified with a claim deadline
  UPDATE public.virtual_attendees
  SET status = 'notified',
      notified_at = NOW(),
      claim_deadline = NOW() + v_claim_duration,
      updated_at = NOW()
  WHERE id = v_next_virtual.id;

  -- Create in-app notification
  INSERT INTO public.notifications (user_id, type, title, message, metadata)
  VALUES (
    v_next_virtual.user_id,
    'event',
    'A Seat Just Opened Up!',
    'A seat just opened up! You have 2 minutes to claim it at the door.',
    jsonb_build_object(
      'event_id', p_event_id,
      'action', 'claim_seat',
      'deadline', (NOW() + v_claim_duration)::TEXT
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'notified_user', v_next_virtual.user_id,
    'queue_position', v_next_virtual.queue_position,
    'claim_deadline', (NOW() + v_claim_duration)::TEXT,
    'message', 'Notified next person in virtual queue.'
  );
END;
$$;

-- 6. RPC: Claim a seat (virtual attendee arrives at door within deadline)
CREATE OR REPLACE FUNCTION public.claim_seat(
  p_event_id UUID,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_queue_record RECORD;
  v_has_capacity BOOLEAN;
BEGIN
  -- Find the user's queue record
  SELECT id, status, claim_deadline
  INTO v_queue_record
  FROM public.virtual_attendees
  WHERE event_id = p_event_id AND user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Not found in virtual queue.'
    );
  END IF;

  IF v_queue_record.status != 'notified' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'You have not been notified yet. Current status: ' || v_queue_record.status
    );
  END IF;

  IF v_queue_record.claim_deadline < NOW() THEN
    -- Mark as expired
    UPDATE public.virtual_attendees
    SET status = 'expired', updated_at = NOW()
    WHERE id = v_queue_record.id;

    RETURN jsonb_build_object(
      'success', false,
      'error', 'Your claim window has expired. You have been moved to the back of the queue.'
    );
  END IF;

  -- Check if event still has capacity
  SELECT (e.max_attendees IS NULL OR (
    SELECT COUNT(*) FROM public.event_rsvps WHERE event_id = p_event_id
  ) < e.max_attendees)
  INTO v_has_capacity
  FROM public.events e
  WHERE e.id = p_event_id;

  IF NOT v_has_capacity THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Event is at full capacity. Please wait for the next opening.'
    );
  END IF;

  -- Admit: create RSVP and mark as admitted
  INSERT INTO public.event_rsvps (event_id, user_id, checked_in)
  VALUES (p_event_id, p_user_id, true)
  ON CONFLICT (event_id, user_id) DO UPDATE SET checked_in = true;

  UPDATE public.virtual_attendees
  SET status = 'admitted', updated_at = NOW()
  WHERE id = v_queue_record.id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Seat claimed! You have been checked in.',
    'admitted', true
  );
END;
$$;

-- 7. RPC: Get overflow queue status for an event
CREATE OR REPLACE FUNCTION public.get_overflow_queue_status(
  p_event_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_queue_count INTEGER;
  v_notified_count INTEGER;
  v_admitted_count INTEGER;
  v_stream_url TEXT;
BEGIN
  SELECT COUNT(*) INTO v_queue_count
  FROM public.virtual_attendees
  WHERE event_id = p_event_id AND status = 'waiting';

  SELECT COUNT(*) INTO v_notified_count
  FROM public.virtual_attendees
  WHERE event_id = p_event_id AND status = 'notified';

  SELECT COUNT(*) INTO v_admitted_count
  FROM public.virtual_attendees
  WHERE event_id = p_event_id AND status = 'admitted';

  SELECT overflow_stream_url INTO v_stream_url
  FROM public.events WHERE id = p_event_id;

  RETURN jsonb_build_object(
    'event_id', p_event_id,
    'queue_count', v_queue_count,
    'notified_count', v_notified_count,
    'admitted_count', v_admitted_count,
    'overflow_stream_url', v_stream_url
  );
END;
$$;

-- 8. RPC: Expire stale notifications (called by cron)
CREATE OR REPLACE FUNCTION public.expire_stale_virtual_queue()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expired_count INTEGER;
BEGIN
  UPDATE public.virtual_attendees
  SET status = 'expired', updated_at = NOW()
  WHERE status = 'notified'
    AND claim_deadline < NOW();

  GET DIAGNOSTICS v_expired_count = ROW_COUNT;
  RETURN v_expired_count;
END;
$$;
