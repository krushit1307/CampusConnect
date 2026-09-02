-- ============================================================
-- Notification Delivery Deduplication (#5222)
--
-- Adds:
--   1. A deterministic notification event key.
--   2. Durable delivery state and retry information.
--   3. Atomic claiming so multiple workers cannot process the
--      same notification event at the same time.
-- ============================================================

-- ------------------------------------------------------------
-- Step 1: Deduplication key for the in-app notification.
-- ------------------------------------------------------------

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS notification_event_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS
  idx_notifications_event_key_unique
ON public.notifications (notification_event_key)
WHERE notification_event_key IS NOT NULL;


-- ------------------------------------------------------------
-- Step 2: Durable delivery state for the push queue.
-- ------------------------------------------------------------

ALTER TABLE public.pending_notifications
  ADD COLUMN IF NOT EXISTS notification_event_key TEXT;

ALTER TABLE public.pending_notifications
  ADD COLUMN IF NOT EXISTS delivery_status TEXT
  NOT NULL DEFAULT 'pending';

ALTER TABLE public.pending_notifications
  ADD COLUMN IF NOT EXISTS attempt_count INTEGER
  NOT NULL DEFAULT 0;

ALTER TABLE public.pending_notifications
  ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;

ALTER TABLE public.pending_notifications
  ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;

ALTER TABLE public.pending_notifications
  ADD COLUMN IF NOT EXISTS last_error TEXT;

ALTER TABLE public.pending_notifications
  ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ
  NOT NULL DEFAULT NOW();

ALTER TABLE public.pending_notifications
  DROP CONSTRAINT IF EXISTS pending_notifications_delivery_status_check;

ALTER TABLE public.pending_notifications
  ADD CONSTRAINT pending_notifications_delivery_status_check
  CHECK (
    delivery_status IN ('pending', 'processing', 'sent', 'failed')
  );

CREATE UNIQUE INDEX IF NOT EXISTS
  idx_pending_notifications_event_key_unique
ON public.pending_notifications (notification_event_key)
WHERE notification_event_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS
  idx_pending_notifications_ready
ON public.pending_notifications (delivery_status, next_attempt_at, created_at)
WHERE delivery_status IN ('pending', 'failed');


-- ------------------------------------------------------------
-- Step 3: Generate one deterministic logical event key.
--
-- Same action + recipient + entity = same notification event.
-- A different actor can still generate a different logical event
-- when actor_id is part of the supplied key.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.build_notification_event_key(
  p_user_id UUID,
  p_notification_type TEXT,
  p_entity_id UUID DEFAULT NULL,
  p_actor_id UUID DEFAULT NULL,
  p_event_id TEXT DEFAULT NULL
) RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT encode(
    digest(
      concat_ws(
        ':',
        p_user_id::TEXT,
        p_notification_type,
        COALESCE(p_entity_id::TEXT, ''),
        COALESCE(p_actor_id::TEXT, ''),
        COALESCE(p_event_id, '')
      ),
      'sha256'
    ),
    'hex'
  );
$$;


-- ------------------------------------------------------------
-- Step 4: Replace the existing notification queue helper.
--
-- The notification row and delivery queue are both protected
-- by the same unique event key.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.queue_or_send_notification(
  p_user_id UUID,
  p_notification_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_link TEXT DEFAULT NULL,
  p_entity_id UUID DEFAULT NULL,
  p_entity_type TEXT DEFAULT NULL,
  p_actor_id UUID DEFAULT NULL,
  p_actor_name TEXT DEFAULT NULL,
  p_event_id TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_key TEXT;
  v_notification_id UUID;
  v_is_immediate BOOLEAN;
BEGIN
  v_event_key := public.build_notification_event_key(
    p_user_id,
    p_notification_type,
    p_entity_id,
    p_actor_id,
    p_event_id
  );

  -- Idempotency check happens before creating either the in-app
  -- notification or the delivery job.
  SELECT id
  INTO v_notification_id
  FROM public.notifications
  WHERE notification_event_key = v_event_key
  LIMIT 1;

  IF v_notification_id IS NOT NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.notifications (
    user_id,
    type,
    title,
    message,
    link,
    entity_id,
    entity_type,
    actor_id,
    actor_name,
    notification_event_key
  )
  VALUES (
    p_user_id,
    p_notification_type,
    p_title,
    p_message,
    p_link,
    p_entity_id,
    p_entity_type,
    p_actor_id,
    p_actor_name,
    v_event_key
  )
  ON CONFLICT (notification_event_key) DO NOTHING
  RETURNING id INTO v_notification_id;

  -- Another concurrent transaction created the same logical
  -- notification first.
  IF v_notification_id IS NULL THEN
    RETURN;
  END IF;

  v_is_immediate :=
    p_notification_type = ANY (
      ARRAY['event_cancelled', 'waitlist_promoted']
    );

  IF v_is_immediate THEN
    -- Critical notifications are still persisted first.
    -- Delivery is handled by the same durable queue so a worker
    -- restart cannot lose the event.
    INSERT INTO public.pending_notifications (
      user_id,
      notification_type,
      entity_id,
      entity_type,
      actor_id,
      actor_name,
      title,
      message,
      link,
      notification_event_key,
      delivery_status,
      next_attempt_at
    )
    VALUES (
      p_user_id,
      p_notification_type,
      p_entity_id,
      p_entity_type,
      p_actor_id,
      p_actor_name,
      p_title,
      p_message,
      p_link,
      v_event_key,
      'pending',
      NOW()
    )
    ON CONFLICT (notification_event_key) DO NOTHING;

    RETURN;
  END IF;

  INSERT INTO public.pending_notifications (
    user_id,
    notification_type,
    entity_id,
    entity_type,
    actor_id,
    actor_name,
    title,
    message,
    link,
    notification_event_key,
    delivery_status,
    next_attempt_at
  )
  VALUES (
    p_user_id,
    p_notification_type,
    p_entity_id,
    p_entity_type,
    p_actor_id,
    p_actor_name,
    p_title,
    p_message,
    p_link,
    v_event_key,
    'pending',
    NOW()
  )
  ON CONFLICT (notification_event_key) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.queue_or_send_notification(
  UUID,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  UUID,
  TEXT,
  UUID,
  TEXT,
  TEXT
) TO service_role;


-- ------------------------------------------------------------
-- Step 5: Atomically claim notification jobs.
--
-- FOR UPDATE SKIP LOCKED means worker A and worker B cannot
-- claim the same notification row.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.claim_pending_notifications(
  p_limit INTEGER DEFAULT 100
)
RETURNS SETOF public.pending_notifications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT id
    FROM public.pending_notifications
    WHERE delivery_status IN ('pending', 'failed')
      AND next_attempt_at <= NOW()
    ORDER BY created_at ASC
    LIMIT GREATEST(1, LEAST(p_limit, 500))
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.pending_notifications p
  SET delivery_status = 'processing',
      attempt_count = p.attempt_count + 1,
      locked_at = NOW()
  FROM candidates
  WHERE p.id = candidates.id
  RETURNING p.*;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_pending_notifications(INTEGER)
TO service_role;


-- ------------------------------------------------------------
-- Step 6: Mark a delivery successful.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.mark_notification_delivered(
  p_notification_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE public.pending_notifications
  SET delivery_status = 'sent',
      processed = TRUE,
      processed_at = NOW(),
      locked_at = NULL,
      last_error = NULL
  WHERE id = p_notification_id
    AND delivery_status = 'processing';

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RETURN v_updated = 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_notification_delivered(UUID)
TO service_role;


-- ------------------------------------------------------------
-- Step 7: Mark a delivery failure and schedule a retry.
-- Exponential backoff prevents a failing provider from being
-- hammered continuously.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.mark_notification_delivery_failed(
  p_notification_id UUID,
  p_error TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attempt_count INTEGER;
  v_updated INTEGER;
BEGIN
  SELECT attempt_count
  INTO v_attempt_count
  FROM public.pending_notifications
  WHERE id = p_notification_id
    AND delivery_status = 'processing'
  FOR UPDATE;

  IF v_attempt_count IS NULL THEN
    RETURN FALSE;
  END IF;

  UPDATE public.pending_notifications
  SET delivery_status = 'failed',
      processed = FALSE,
      locked_at = NULL,
      last_error = LEFT(p_error, 2000),
      next_attempt_at =
        NOW() + LEAST(
          INTERVAL '1 hour',
          INTERVAL '5 seconds' * POWER(2, LEAST(v_attempt_count - 1, 10))
        )
  WHERE id = p_notification_id
    AND delivery_status = 'processing';

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RETURN v_updated = 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_notification_delivery_failed(UUID, TEXT)
TO service_role;


-- ------------------------------------------------------------
-- Step 8: Recover jobs abandoned by a worker restart.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.recover_stale_notification_jobs(
  p_timeout INTERVAL DEFAULT INTERVAL '10 minutes'
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recovered INTEGER;
BEGIN
  UPDATE public.pending_notifications
  SET delivery_status = 'failed',
      locked_at = NULL,
      last_error = 'Worker lock expired; notification returned to retry queue.',
      next_attempt_at = NOW()
  WHERE delivery_status = 'processing'
    AND locked_at < NOW() - p_timeout;

  GET DIAGNOSTICS v_recovered = ROW_COUNT;

  RETURN v_recovered;
END;
$$;

GRANT EXECUTE ON FUNCTION public.recover_stale_notification_jobs(INTERVAL)
TO service_role;

-- ------------------------------------------------------------
-- Step 9: Event announcement notifications.
--
-- The announcement row itself is the logical event ID, so a
-- trigger retry can never create another notification for the
-- same announcement + recipient.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_event_announcement_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attendee RECORD;
  v_event_title TEXT;
BEGIN
  SELECT title
  INTO v_event_title
  FROM public.events
  WHERE id = NEW.event_id;

  FOR v_attendee IN
    SELECT user_id
    FROM public.event_rsvps
    WHERE event_id = NEW.event_id
      AND status = 'attending'
  LOOP
    PERFORM public.queue_or_send_notification(
      p_user_id => v_attendee.user_id,
      p_notification_type => 'event_announcement',
      p_title => 'Event Announcement',
      p_message => NEW.message,
      p_link => '/events/' || NEW.event_id,
      p_entity_id => NEW.id,
      p_entity_type => 'event_announcement',
      p_event_id => NEW.id::TEXT
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_event_announcement_notification
ON public.event_announcements;

CREATE TRIGGER on_event_announcement_notification
AFTER INSERT ON public.event_announcements
FOR EACH ROW
EXECUTE FUNCTION public.handle_event_announcement_notification();