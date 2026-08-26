-- ============================================================
-- Migration: 20260729000001_auto_notifications.sql
-- Description:
--   Creates trigger functions that automatically insert
--   notifications for:
--     1. Comment mentions (@handle → notify mentioned user)
--     2. Event RSVPs (RSVP → notify event organizer)
-- ============================================================

-- 1. Trigger function: handle_comment_mention_notification
--    Parses @handle patterns from comment content and notifies
--    the mentioned user.
CREATE OR REPLACE FUNCTION public.handle_comment_mention_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_handle TEXT;
  v_mentioned_user_id UUID;
  v_mentioned_handles TEXT[];
  v_author_name TEXT;
BEGIN
  -- Extract all @handle tokens from the comment content
  v_mentioned_handles := regexp_matches(NEW.content, '@([a-zA-Z0-9_-]+)', 'g');

  -- Get the comment author's display name
  SELECT NULLIF(TRIM(CONCAT(first_name, ' ', last_name)), '')
  INTO v_author_name
  FROM public.profiles
  WHERE id = NEW.author_id;

  -- Iterate over each mentioned handle
  IF v_mentioned_handles IS NOT NULL THEN
    FOREACH v_handle IN ARRAY v_mentioned_handles
    LOOP
      -- Look up the user id for this handle
      SELECT id INTO v_mentioned_user_id
      FROM public.profiles
      WHERE handle = v_handle;

      -- If the user exists and is not the comment author, insert notification
      IF FOUND AND v_mentioned_user_id IS DISTINCT FROM NEW.author_id THEN
        INSERT INTO public.notifications (user_id, type, title, message, link)
        VALUES (
          v_mentioned_user_id,
          'mention',
          'You were mentioned',
          COALESCE(v_author_name, 'Someone') || ' mentioned you in a comment.',
          '/posts/' || NEW.post_id || '#comment-' || NEW.id
        );
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

-- 2. Trigger function: handle_event_rsvp_notification
--    Notifies the event organizer when someone RSVPs.
CREATE OR REPLACE FUNCTION public.handle_event_rsvp_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_organizer_id UUID;
  v_event_title TEXT;
  v_rsvp_name TEXT;
BEGIN
  -- Get event details
  SELECT organizer_id, title INTO v_organizer_id, v_event_title
  FROM public.events
  WHERE id = NEW.event_id;

  -- Get the RSVP user's display name
  SELECT NULLIF(TRIM(CONCAT(first_name, ' ', last_name)), '')
  INTO v_rsvp_name
  FROM public.profiles
  WHERE id = NEW.user_id;

  -- Only notify if the RSVP user is not the organizer themselves
  IF v_organizer_id IS DISTINCT FROM NEW.user_id THEN
    INSERT INTO public.notifications (user_id, type, title, message, link)
    VALUES (
      v_organizer_id,
      'event_rsvp',
      'New RSVP',
      COALESCE(v_rsvp_name, 'Someone') || ' RSVPed "' || COALESCE(NEW.status, 'yes') || '" to ' || COALESCE(v_event_title, 'your event') || '.',
      '/events/' || NEW.event_id
    );
  END IF;

  RETURN NEW;
END;
$$;

-- 3. Bind triggers

DROP TRIGGER IF EXISTS on_comment_mention ON public.comments;
CREATE TRIGGER on_comment_mention
  AFTER INSERT ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_comment_mention_notification();

DROP TRIGGER IF EXISTS on_event_rsvp ON public.event_rsvps;
CREATE TRIGGER on_event_rsvp
  AFTER INSERT ON public.event_rsvps
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_event_rsvp_notification();
