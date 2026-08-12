-- Create Distributed Advisory Lock helper functions for financial transactions and ticket purchases

CREATE OR REPLACE FUNCTION acquire_advisory_lock_with_backoff(
  p_lock_key BIGINT,
  p_max_retries INT DEFAULT 5,
  p_base_delay_ms INT DEFAULT 50
) RETURNS BOOLEAN AS $$
DECLARE
  v_acquired BOOLEAN := FALSE;
  v_attempt INT := 0;
  v_delay_ms INT := p_base_delay_ms;
BEGIN
  WHILE v_attempt < p_max_retries AND NOT v_acquired LOOP
    v_acquired := pg_try_advisory_xact_lock(p_lock_key);
    IF v_acquired THEN
      RETURN TRUE;
    END IF;
    
    v_attempt := v_attempt + 1;
    PERFORM pg_sleep(v_delay_ms / 1000.0);
    v_delay_ms := v_delay_ms * 2; -- Exponential backoff
  END LOOP;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Robust atomic ticket purchase with distributed lock
CREATE OR REPLACE FUNCTION purchase_event_ticket_locked(
  p_event_id UUID,
  p_user_id UUID,
  p_quantity INT DEFAULT 1
) RETURNS JSONB AS $$
DECLARE
  v_lock_key BIGINT;
  v_acquired BOOLEAN;
  v_current_rsvps INT;
  v_max_capacity INT;
BEGIN
  -- Convert UUID event_id to bigint lock key
  v_lock_key := ('x' || substr(md5(p_event_id::text), 1, 15))::bit(64)::bigint;

  -- Acquire distributed advisory transaction lock with exponential backoff
  v_acquired := acquire_advisory_lock_with_backoff(v_lock_key, 5, 50);

  IF NOT v_acquired THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Could not acquire transaction lock. System high concurrency, please retry.'
    );
  END IF;

  -- Get event capacity
  SELECT max_attendees INTO v_max_capacity
  FROM events
  WHERE id = p_event_id;

  -- Get current RSVP count
  SELECT COUNT(*) INTO v_current_rsvps
  FROM event_rsvps
  WHERE event_id = p_event_id AND status = 'confirmed';

  IF v_max_capacity IS NOT NULL AND (v_current_rsvps + p_quantity) > v_max_capacity THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Sold out! Event capacity reached.'
    );
  END IF;

  -- Perform RSVP insertion
  INSERT INTO event_rsvps (event_id, user_id, status, created_at)
  VALUES (p_event_id, p_user_id, 'confirmed', NOW())
  ON CONFLICT (event_id, user_id) DO NOTHING;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Ticket purchase successful.'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
