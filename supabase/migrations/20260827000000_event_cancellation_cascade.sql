-- Migration: 20260827000000_event_cancellation_cascade.sql
-- Description: Cascades event cancellation to RSVPs, waitlists, certificates, and feedbacks safely.

CREATE OR REPLACE FUNCTION public.handle_event_cancellation()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
  BEGIN
    -- 1. Create notifications for RSVP'd users BEFORE data is deleted
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
  
    -- 2. Clear waitlist FIRST to prevent auto-promotion triggers from firing into a cancelled event
    DELETE FROM public.event_waitlist WHERE event_id = NEW.id;

    -- 3. Delete all RSVPs for the cancelled event
    -- (This triggers tr_promote_waitlist_on_rsvp_cancel, but waitlist is now empty)
    DELETE FROM public.event_rsvps WHERE event_id = NEW.id;

    -- 4. Delete pending or issued certificates (since event didn't occur)
    DELETE FROM public.certificates WHERE event_id = NEW.id;

    -- 5. Delete event feedbacks (prevent feedback for non-events)
    DELETE FROM public.event_feedbacks WHERE event_id = NEW.id;

    RETURN NEW;
  END;
  $$;
