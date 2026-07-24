-- ============================================================
-- Migration: 20260722080000_waitlist_auto_promote.sql
-- Issue: #587
-- Description: Trigger AFTER DELETE on event_rsvps to automatically
--              promote the oldest waitlisted user using FOR UPDATE SKIP LOCKED concurrency locking.
-- ============================================================

CREATE OR REPLACE FUNCTION public.promote_waitlist_attendee()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    next_waitlist_record RECORD;
BEGIN
    -- Find and lock the oldest waitlist record for the event (concurrency-safe)
    SELECT id, event_id, user_id INTO next_waitlist_record
    FROM public.event_waitlist
    WHERE event_id = OLD.event_id
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    -- If a waitlisted student exists, promote them to active RSVP and remove from waitlist
    IF FOUND THEN
        INSERT INTO public.event_rsvps (event_id, user_id)
        VALUES (next_waitlist_record.event_id, next_waitlist_record.user_id)
        ON CONFLICT (event_id, user_id) DO NOTHING;

        DELETE FROM public.event_waitlist
        WHERE id = next_waitlist_record.id;
    END IF;

    RETURN OLD;
END;
$$;

-- Trigger: Promote waitlist attendee after RSVP deletion
DROP TRIGGER IF EXISTS tr_promote_waitlist_on_rsvp_cancel ON public.event_rsvps;

CREATE TRIGGER tr_promote_waitlist_on_rsvp_cancel
AFTER DELETE ON public.event_rsvps
FOR EACH ROW
EXECUTE FUNCTION public.promote_waitlist_attendee();
