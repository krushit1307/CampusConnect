-- Migration: Refactor notifications to use JSONB metadata column
-- Timestamp: 20260731230000

-- 1. Add metadata column of type JSONB
ALTER TABLE public.notifications 
ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 2. Create helper indexes on metadata subfields for quick lookups/joins
CREATE INDEX IF NOT EXISTS idx_notifications_metadata_event_id ON public.notifications ((metadata->>'event_id'));
CREATE INDEX IF NOT EXISTS idx_notifications_metadata_post_id ON public.notifications ((metadata->>'post_id'));
CREATE INDEX IF NOT EXISTS idx_notifications_metadata_comment_id ON public.notifications ((metadata->>'comment_id'));
CREATE INDEX IF NOT EXISTS idx_notifications_metadata_club_id ON public.notifications ((metadata->>'club_id'));

-- 3. Perform migration: Convert existing old strict relational columns to JSONB metadata if they exist
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifications' AND column_name = 'event_id'
    ) THEN
        UPDATE public.notifications
        SET metadata = jsonb_strip_nulls(
            jsonb_build_object(
                'event_id', event_id,
                'post_id', post_id,
                'comment_id', comment_id
            )
        );
    END IF;
END $$;

-- 4. Drop the old relational columns if they exist
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'event_id') THEN
        ALTER TABLE public.notifications DROP COLUMN event_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'post_id') THEN
        ALTER TABLE public.notifications DROP COLUMN post_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'comment_id') THEN
        ALTER TABLE public.notifications DROP COLUMN comment_id;
    END IF;
END $$;

-- 5. Update trigger functions to insert JSONB metadata automatically

-- A. parse_mentions_from_content / handle_comment_mention_notification
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
  v_mentioned_handles := regexp_matches(NEW.content, '@([a-zA-Z0-9_-]+)', 'g');

  SELECT NULLIF(TRIM(CONCAT(first_name, ' ', last_name)), '')
  INTO v_author_name
  FROM public.profiles
  WHERE id = NEW.author_id;

  IF v_mentioned_handles IS NOT NULL THEN
    FOREACH v_handle IN ARRAY v_mentioned_handles
    LOOP
      SELECT id INTO v_mentioned_user_id
      FROM public.profiles
      WHERE handle = v_handle;

      IF FOUND AND v_mentioned_user_id IS DISTINCT FROM NEW.author_id THEN
        INSERT INTO public.notifications (user_id, type, title, message, link, metadata)
        VALUES (
          v_mentioned_user_id,
          'mention',
          'You were mentioned',
          COALESCE(v_author_name, 'Someone') || ' mentioned you in a comment.',
          '/posts/' || NEW.post_id || '#comment-' || NEW.id,
          jsonb_build_object('post_id', NEW.post_id, 'comment_id', NEW.id)
        );
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

-- B. handle_event_rsvp_notification
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
  SELECT organizer_id, title INTO v_organizer_id, v_event_title
  FROM public.events
  WHERE id = NEW.event_id;

  SELECT NULLIF(TRIM(CONCAT(first_name, ' ', last_name)), '')
  INTO v_rsvp_name
  FROM public.profiles
  WHERE id = NEW.user_id;

  IF v_organizer_id IS DISTINCT FROM NEW.user_id THEN
    INSERT INTO public.notifications (user_id, type, title, message, link, metadata)
    VALUES (
      v_organizer_id,
      'event_rsvp',
      'New RSVP',
      COALESCE(v_rsvp_name, 'Someone') || ' RSVPed "' || COALESCE(NEW.status, 'yes') || '" to ' || COALESCE(v_event_title, 'your event') || '.',
      '/events/' || NEW.event_id,
      jsonb_build_object('event_id', NEW.event_id)
    );
  END IF;

  RETURN NEW;
END;
$$;

-- C. notify_admins_on_flagged_post
CREATE OR REPLACE FUNCTION public.notify_admins_on_flagged_post()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, message, link, metadata)
  SELECT 
    cm.user_id,
    'alert',
    'Post Flagged for Moderation',
    'A post in your club has been flagged for review.',
    '/clubs/' || NEW.club_id || '/posts/' || NEW.id,
    jsonb_build_object('club_id', NEW.club_id, 'post_id', NEW.id)
  FROM public.club_members cm
  WHERE cm.club_id = NEW.club_id 
    AND cm.role = 'admin' 
    AND cm.status = 'approved';
    
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- D. handle_new_message_notification
CREATE OR REPLACE FUNCTION public.handle_new_message_notification()
RETURNS trigger AS $$
DECLARE
  v_sender_name TEXT;
BEGIN
  SELECT NULLIF(TRIM(CONCAT(first_name, ' ', last_name)), '') INTO v_sender_name FROM public.profiles WHERE id = NEW.sender_id;
  
  INSERT INTO public.notifications (user_id, type, title, message, link, metadata)
  VALUES (
    NEW.receiver_id,
    'reply',
    'New Message',
    COALESCE(v_sender_name, 'Someone') || ' sent you a new secure message.',
    '/messages',
    jsonb_build_object('sender_id', NEW.sender_id, 'message_id', NEW.id)
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- E. handle_event_cancellation
CREATE OR REPLACE FUNCTION public.handle_event_cancellation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, message, link, metadata)
  SELECT 
    rsvp.user_id,
    'event',
    'Event Canceled',
    'Event ' || NEW.title || ' has been canceled by the organizer.',
    '/events/' || NEW.id,
    jsonb_build_object('event_id', NEW.id)
  FROM public.event_rsvps rsvp
  WHERE rsvp.event_id = NEW.id;

  RETURN NEW;
END;
$$;
