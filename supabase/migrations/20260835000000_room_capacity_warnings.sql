-- ============================================================
-- Migration: 20260835000000_room_capacity_warnings.sql
-- Description: Adds venue_capacity and capacity_warning_sent columns,
--              and configures the trigger on event_rsvps to dispatch
--              an async Edge Function webhook via pg_net.
-- ============================================================

-- 1. Schema Updates
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS venue_capacity INTEGER;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS capacity_warning_sent BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Enable pg_net in extensions schema if not present
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 3. Trigger Function to evaluate capacity
CREATE OR REPLACE FUNCTION public.check_event_room_capacity()
RETURNS TRIGGER AS $$
DECLARE
    v_venue_capacity INTEGER;
    v_capacity_warning_sent BOOLEAN;
    v_rsvp_count INTEGER;
    v_threshold_count INTEGER;
BEGIN
    -- 1. Fetch capacity constraints
    SELECT venue_capacity, capacity_warning_sent
    INTO v_venue_capacity, v_capacity_warning_sent
    FROM public.events
    WHERE id = NEW.event_id;

    -- 2. Exit immediately if capacity is not set or warning has already been sent
    IF v_venue_capacity IS NULL OR v_capacity_warning_sent = TRUE THEN
        RETURN NEW;
    END IF;

    -- 3. Calculate 90% threshold (rounded up)
    v_threshold_count := ceil(v_venue_capacity * 0.90)::integer;

    -- 4. Count current approved RSVPs
    SELECT COUNT(*) INTO v_rsvp_count
    FROM public.event_rsvps
    WHERE event_id = NEW.event_id AND status = 'approved';

    -- 5. If limit crossed, set sent = TRUE and send webhook payload
    IF v_rsvp_count >= v_threshold_count THEN
        UPDATE public.events
        SET capacity_warning_sent = TRUE
        WHERE id = NEW.event_id;

        BEGIN
            IF EXISTS (
                SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
                WHERE p.proname = 'http_post' AND n.nspname = 'net'
            ) THEN
                PERFORM net.http_post(
                    url := 'http://localhost:54321/functions/v1/capacity-warning',
                    headers := '{"Content-Type": "application/json"}'::jsonb,
                    body := jsonb_build_object(
                        'eventId', NEW.event_id,
                        'rsvpCount', v_rsvp_count,
                        'venueCapacity', v_venue_capacity
                    )
                );
            ELSIF EXISTS (
                SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
                WHERE p.proname = 'http_post' AND n.nspname = 'extensions'
            ) THEN
                PERFORM extensions.http_post(
                    url := 'http://localhost:54321/functions/v1/capacity-warning',
                    headers := '{"Content-Type": "application/json"}'::jsonb,
                    body := jsonb_build_object(
                        'eventId', NEW.event_id,
                        'rsvpCount', v_rsvp_count,
                        'venueCapacity', v_venue_capacity
                    )
                );
            END IF;
        EXCEPTION WHEN OTHERS THEN
            -- Gracefully swallow webhook errors to prevent blocking the transaction
            NULL;
        END;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create trigger
DROP TRIGGER IF EXISTS trg_on_rsvp_inserted_capacity_check ON public.event_rsvps;
CREATE TRIGGER trg_on_rsvp_inserted_capacity_check
AFTER INSERT OR UPDATE ON public.event_rsvps
FOR EACH ROW
EXECUTE FUNCTION public.check_event_room_capacity();
