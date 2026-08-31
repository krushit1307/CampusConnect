-- ============================================================
-- Notification Delivery Deduplication (#5222)
-- ============================================================

BEGIN;

DO $$
DECLARE
  v_user UUID := gen_random_uuid();
  v_event UUID := gen_random_uuid();
  v_actor UUID := gen_random_uuid();
  v_key TEXT;
  v_count INTEGER;
  v_pending_count INTEGER;
BEGIN
  -- Same logical event must always generate the same key.
  v_key := public.build_notification_event_key(
    v_user,
    'event_rsvp',
    v_event,
    v_actor,
    'same-event'
  );

  PERFORM public.queue_or_send_notification(
    p_user_id => v_user,
    p_notification_type => 'event_rsvp',
    p_title => 'New RSVP',
    p_message => 'Someone RSVPd.',
    p_entity_id => v_event,
    p_entity_type => 'event',
    p_actor_id => v_actor,
    p_event_id => 'same-event'
  );

  -- Replaying the exact same logical event must be a no-op.
  PERFORM public.queue_or_send_notification(
    p_user_id => v_user,
    p_notification_type => 'event_rsvp',
    p_title => 'New RSVP',
    p_message => 'Someone RSVPd.',
    p_entity_id => v_event,
    p_entity_type => 'event',
    p_actor_id => v_actor,
    p_event_id => 'same-event'
  );

  SELECT COUNT(*)
  INTO v_count
  FROM public.notifications
  WHERE notification_event_key = v_key;

  IF v_count <> 1 THEN
    RAISE EXCEPTION
      'Duplicate notification created: expected 1, got %',
      v_count;
  END IF;

  SELECT COUNT(*)
  INTO v_pending_count
  FROM public.pending_notifications
  WHERE notification_event_key = v_key;

  IF v_pending_count <> 1 THEN
    RAISE EXCEPTION
      'Duplicate delivery job created: expected 1, got %',
      v_pending_count;
  END IF;
END;
$$;


DO $$
DECLARE
  v_user UUID := gen_random_uuid();
  v_event UUID := gen_random_uuid();
  v_actor UUID := gen_random_uuid();
  v_job_id UUID;
  v_claimed_count INTEGER;
BEGIN
  PERFORM public.queue_or_send_notification(
    p_user_id => v_user,
    p_notification_type => 'event_rsvp',
    p_title => 'New RSVP',
    p_message => 'Retry test.',
    p_entity_id => v_event,
    p_entity_type => 'event',
    p_actor_id => v_actor,
    p_event_id => 'retry-test'
  );

  SELECT id
  INTO v_job_id
  FROM public.pending_notifications
  WHERE notification_event_key =
    public.build_notification_event_key(
      v_user,
      'event_rsvp',
      v_event,
      v_actor,
      'retry-test'
    );

  -- Worker claims the job.
  PERFORM *
  FROM public.claim_pending_notifications(10);

  SELECT COUNT(*)
  INTO v_claimed_count
  FROM public.pending_notifications
  WHERE id = v_job_id
    AND delivery_status = 'processing'
    AND attempt_count = 1;

  IF v_claimed_count <> 1 THEN
    RAISE EXCEPTION 'Notification was not atomically claimed';
  END IF;

  -- Simulate a failed delivery.
  IF NOT public.mark_notification_delivery_failed(
    v_job_id,
    'temporary provider failure'
  ) THEN
    RAISE EXCEPTION 'Failed delivery was not recorded';
  END IF;

  SELECT COUNT(*)
  INTO v_claimed_count
  FROM public.pending_notifications
  WHERE id = v_job_id
    AND delivery_status = 'failed'
    AND attempt_count = 1
    AND last_error = 'temporary provider failure';

  IF v_claimed_count <> 1 THEN
    RAISE EXCEPTION 'Retry state was not persisted';
  END IF;
END;
$$;


DO $$
DECLARE
  v_user UUID := gen_random_uuid();
  v_event UUID := gen_random_uuid();
  v_actor UUID := gen_random_uuid();
  v_job_id UUID;
  v_claimed_count INTEGER;
BEGIN
  PERFORM public.queue_or_send_notification(
    p_user_id => v_user,
    p_notification_type => 'event_rsvp',
    p_title => 'Concurrent worker test',
    p_message => 'Worker locking test.',
    p_entity_id => v_event,
    p_entity_type => 'event',
    p_actor_id => v_actor,
    p_event_id => 'worker-lock-test'
  );

  SELECT id
  INTO v_job_id
  FROM public.pending_notifications
  WHERE notification_event_key =
    public.build_notification_event_key(
      v_user,
      'event_rsvp',
      v_event,
      v_actor,
      'worker-lock-test'
    );

  -- Once the job is claimed, it must no longer be claimable by
  -- another worker.
  PERFORM *
  FROM public.claim_pending_notifications(10);

  SELECT COUNT(*)
  INTO v_claimed_count
  FROM public.claim_pending_notifications(10)
  WHERE id = v_job_id;

  IF v_claimed_count <> 0 THEN
    RAISE EXCEPTION
      'The same notification was claimed by multiple workers';
  END IF;
END;
$$;

ROLLBACK;