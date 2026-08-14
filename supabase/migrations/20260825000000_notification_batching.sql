-- ============================================================
-- Migration: 20260825000000_notification_batching.sql
-- Description:
--   Debounces push notifications so a burst of similar events (e.g. 30
--   replies to one forum post in 5 minutes) becomes a single aggregated
--   push instead of 30 individual ones. Critical notification types
--   ("event_cancelled", "waitlist_promoted") bypass the queue entirely
--   and push immediately.
--
--   IMPORTANT: this only changes the PUSH channel. The existing in-app
--   notification center (public.notifications, with its own group_key
--   merge-on-insert grouping from the unified_notification_center
--   migration) is untouched — every call still writes exactly the same
--   in-app row it always did. This migration adds a second, separate
--   path specifically for push dispatch.
-- ============================================================

-- ── Step 1: pending_notifications queue table ────────────────────

CREATE TABLE public.pending_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- e.g. 'post_reply'. Grouping never crosses notification_type, so a
  -- forum reply and a ticket receipt can never merge into one push —
  -- this is what satisfies the "don't over-aggregate" edge case, by
  -- construction rather than extra filtering logic.
  notification_type TEXT NOT NULL,
  entity_id UUID,
  entity_type TEXT,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_name TEXT,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed BOOLEAN NOT NULL DEFAULT FALSE,
  processed_at TIMESTAMPTZ
);

-- The worker's core query is "unprocessed rows, grouped by (user_id,
-- entity_id, notification_type)" — this partial index covers exactly
-- that, and stays small since processed rows fall out of it.
CREATE INDEX idx_pending_notifications_unprocessed
  ON public.pending_notifications (user_id, entity_id, notification_type, created_at)
  WHERE processed = FALSE;

ALTER TABLE public.pending_notifications ENABLE ROW LEVEL SECURITY;

-- Nobody reads this table from the client at all — it's an internal
-- queue for the worker (service_role) only. No SELECT/INSERT/UPDATE
-- policy exists for `authenticated`, matching the same "no policy means
-- no access" approach used for `votes` in the election module.

-- ── Step 2: central dispatch helper ───────────────────────────────
-- Every notification-producing trigger should call this instead of
-- inserting into public.notifications directly. It always writes the
-- in-app row (unchanged behavior), then either pushes immediately
-- (critical types) or queues for the batching worker (everything else).

CREATE OR REPLACE FUNCTION public.queue_or_send_notification(
  p_user_id UUID,
  p_notification_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_link TEXT DEFAULT NULL,
  p_entity_id UUID DEFAULT NULL,
  p_entity_type TEXT DEFAULT NULL,
  p_actor_id UUID DEFAULT NULL,
  p_actor_name TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_immediate BOOLEAN;
  v_supabase_url TEXT;
  v_service_key TEXT;
BEGIN
  -- Unchanged: always write the in-app notification exactly as every
  -- existing trigger already does.
  INSERT INTO public.notifications (
    user_id, type, title, message, link, entity_id, entity_type, actor_id, actor_name
  ) VALUES (
    p_user_id, p_notification_type, p_title, p_message, p_link,
    p_entity_id, p_entity_type, p_actor_id, p_actor_name
  );

  -- Critical notification types bypass the batching queue entirely,
  -- per the issue's explicit requirement. Keep this list short and
  -- deliberate — everything else should batch.
  v_is_immediate := p_notification_type = ANY (ARRAY['event_cancelled', 'waitlist_promoted']);

  IF v_is_immediate THEN
    v_supabase_url := COALESCE(current_setting('app.supabase_url', true), 'http://127.0.0.1:54321');
    v_service_key := COALESCE(current_setting('app.service_role_key', true), '');

    -- Fire-and-forget push for just this one user, right now. Wrapped
    -- so that a push-dispatch failure (e.g. Edge Functions down
    -- locally) can never roll back the triggering transaction — the
    -- in-app notification above still lands either way.
    --
    -- NOTE: this is `net.http_post` (pg_net's actual schema), not
    -- `extensions.net.http_post` like promote_waitlist_on_cancel() /
    -- promote_waitlist_on_delete() use in 20260816000000. That 3-part
    -- form is a cross-database reference to Postgres (verified locally
    -- — it throws "cross-database references are not implemented"),
    -- so those two existing webhook calls are almost certainly dead
    -- code today. Worth a separate fix; not touched here since it's
    -- outside this issue's scope.
    BEGIN
      PERFORM net.http_post(
        url := v_supabase_url || '/functions/v1/send-push-notification',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_service_key
        ),
        body := jsonb_build_object(
          'user_id', p_user_id,
          'title', p_title,
          'message', p_message,
          'url', p_link
        )
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  ELSE
    INSERT INTO public.pending_notifications (
      user_id, notification_type, entity_id, entity_type,
      actor_id, actor_name, title, message, link
    ) VALUES (
      p_user_id, p_notification_type, p_entity_id, p_entity_type,
      p_actor_id, p_actor_name, p_title, p_message, p_link
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.queue_or_send_notification(
  UUID, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, UUID, TEXT
) TO service_role;
-- Deliberately NOT granted to `authenticated` — this is only ever
-- called from SECURITY DEFINER trigger functions below, never
-- directly by a client.

-- ── Step 3: post reply notification (the exact scenario from the issue) ─
-- Nothing in the existing schema notifies a post's author when someone
-- replies — this is new. Routed through the batching helper above, so
-- 30 rapid replies become one aggregated push instead of 30.

CREATE OR REPLACE FUNCTION public.handle_post_reply_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post_author_id UUID;
  v_replier_name TEXT;
BEGIN
  SELECT author_id INTO v_post_author_id FROM public.posts WHERE id = NEW.post_id;

  -- Don't notify someone for replying to their own post.
  IF v_post_author_id IS NULL OR v_post_author_id = NEW.author_id THEN
    RETURN NEW;
  END IF;

  SELECT NULLIF(TRIM(CONCAT(first_name, ' ', last_name)), '')
    INTO v_replier_name
  FROM public.profiles
  WHERE id = NEW.author_id;

  PERFORM public.queue_or_send_notification(
    p_user_id => v_post_author_id,
    p_notification_type => 'post_reply',
    p_title => 'New reply',
    p_message => COALESCE(v_replier_name, 'Someone') || ' replied to your post.',
    p_link => '/posts/' || NEW.post_id,
    p_entity_id => NEW.post_id,
    p_entity_type => 'post',
    p_actor_id => NEW.author_id,
    p_actor_name => COALESCE(v_replier_name, 'Someone')
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_comment_notify_post_author ON public.comments;
CREATE TRIGGER on_comment_notify_post_author
  AFTER INSERT ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_post_reply_notification();

-- ── Step 4: wire the two named "critical, bypass the queue" cases ──

-- 4a. Event cancellation: the existing handle_event_cancellation()
-- trigger already inserts one public.notifications row per RSVP'd
-- attendee directly. Re-point it at the shared helper so cancellations
-- also get an immediate push (they were previously in-app only), while
-- keeping the exact same in-app row shape.
CREATE OR REPLACE FUNCTION public.handle_event_cancellation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rsvp RECORD;
BEGIN
  FOR v_rsvp IN
    SELECT user_id FROM public.event_rsvps WHERE event_id = NEW.id
  LOOP
    PERFORM public.queue_or_send_notification(
      p_user_id => v_rsvp.user_id,
      p_notification_type => 'event_cancelled',
      p_title => 'Event Canceled',
      p_message => 'Event ' || NEW.title || ' has been canceled by the organizer.',
      p_link => '/events/' || NEW.id,
      p_entity_id => NEW.id,
      p_entity_type => 'event'
    );
  END LOOP;

  RETURN NEW;
END;
$$;

-- 4b. Waitlist promotion: both promote_waitlist_on_cancel() and
-- promote_waitlist_on_delete() (in 20260816000000_automated_waitlist_
-- system.sql) end by running `UPDATE event_rsvps SET status =
-- 'attending' ... WHERE id = <promoted row>`, which always transitions
-- that row from waitlisted -> attending. Rather than redefining either
-- (large, easy to introduce a copy/paste bug into), this adds one more
-- independent trigger on that same transition — exactly mirroring how
-- on_rsvp_promoted_sync_legacy already does the same thing for a
-- different concern (keeping the legacy event_waitlist table in sync).
-- It fires regardless of which of the two promotion paths triggered it.
CREATE OR REPLACE FUNCTION public.notify_waitlist_promotion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_title TEXT;
BEGIN
  SELECT title INTO v_event_title FROM public.events WHERE id = NEW.event_id;

  PERFORM public.queue_or_send_notification(
    p_user_id => NEW.user_id,
    p_notification_type => 'waitlist_promoted',
    p_title => 'A spot opened up!',
    p_message => 'You''re off the waitlist for ' || COALESCE(v_event_title, 'the event') || ' — you have a spot.',
    p_link => '/events/' || NEW.event_id,
    p_entity_id => NEW.event_id,
    p_entity_type => 'event'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_rsvp_promoted_notify ON public.event_rsvps;
CREATE TRIGGER on_rsvp_promoted_notify
AFTER UPDATE OF status ON public.event_rsvps
FOR EACH ROW
WHEN (OLD.status = 'waitlisted' AND NEW.status = 'attending')
EXECUTE FUNCTION public.notify_waitlist_promotion();

COMMENT ON FUNCTION public.notify_waitlist_promotion() IS
'Fires whenever an event_rsvps row transitions from waitlisted to attending, regardless of which promotion path caused it. Sends an immediate push via queue_or_send_notification''s critical-type bypass — this notification must never wait for the 2-minute batching worker.';

-- ── Step 5: schedule the batching worker every 2 minutes ──────────

CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'dispatch-batched-notifications') THEN
    PERFORM cron.unschedule('dispatch-batched-notifications');
  END IF;
END
$$;

SELECT cron.schedule(
  'dispatch-batched-notifications',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT value FROM secrets.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1) || '/functions/v1/dispatch-batched-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT value FROM secrets.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1)
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ============================================================
-- End of migration
-- ============================================================
