-- Migration: Prevent users from RSVP'ing to overlapping events
-- Description: Trigger to validate that a user does not have an overlapping active RSVP.

CREATE OR REPLACE FUNCTION public.prevent_rsvp_overlap()
RETURNS TRIGGER AS $$
DECLARE
    new_event_start TIMESTAMPTZ;
    new_event_end TIMESTAMPTZ;
    new_event_status TEXT;
BEGIN
    -- Get start and end times of the new event
    SELECT start_date, end_date, status
    INTO new_event_start, new_event_end, new_event_status
    FROM public.events
    WHERE id = NEW.event_id;

    -- If the event is canceled, we don't need to prevent overlaps
    IF new_event_status = 'canceled' THEN
        RETURN NEW;
    END IF;

    -- Check if times are valid and check for overlaps
    IF new_event_start IS NOT NULL AND new_event_end IS NOT NULL THEN
        IF EXISTS (
            SELECT 1 
            FROM public.event_rsvps r
            JOIN public.events e ON r.event_id = e.id
            WHERE r.user_id = NEW.user_id
              AND r.status <> 'rejected'
              AND e.status <> 'canceled'
              AND e.start_date < new_event_end
              AND e.end_date > new_event_start
              AND e.id <> NEW.event_id
        ) THEN
            RAISE EXCEPTION 'You are already RSVPed to another event during this time range.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Bind the BEFORE INSERT trigger to event_rsvps table
DROP TRIGGER IF EXISTS trg_prevent_rsvp_overlap ON public.event_rsvps;

CREATE TRIGGER trg_prevent_rsvp_overlap
BEFORE INSERT ON public.event_rsvps
FOR EACH ROW
EXECUTE FUNCTION public.prevent_rsvp_overlap();
