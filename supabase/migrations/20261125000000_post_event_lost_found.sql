-- Migration: 20261125000000_post_event_lost_found.sql
-- Description: Implement Automated Post-Event Lost & Found Scraping and notifications (#3460).

-- 1. Add lost_found_scraped column to events
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS lost_found_scraped BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Create the scraper function
CREATE OR REPLACE FUNCTION public.scrape_post_event_lost_found()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event RECORD;
  v_found_items TEXT;
  v_items_count INTEGER;
  v_attendee RECORD;
BEGIN
  -- Find all events that ended >= 24 hours ago and haven't been scraped yet
  FOR v_event IN
    SELECT id, title, start_time
    FROM public.events
    WHERE end_time <= NOW() - INTERVAL '24 hours'
      AND lost_found_scraped = FALSE
      AND deleted_at IS NULL
  LOOP
    -- Count and aggregate found items for this event
    SELECT string_agg(title, ', '), count(*)
      INTO v_found_items, v_items_count
    FROM public.lost_items
    WHERE event_id = v_event.id
      AND type = 'found'
      AND created_at > v_event.start_time;

    -- If there are items found, notify all attendees who checked in
    IF v_items_count > 0 THEN
      FOR v_attendee IN
        SELECT r.user_id, p.email
        FROM public.event_rsvps r
        JOIN public.profiles p ON p.id = r.user_id
        WHERE r.event_id = v_event.id
          AND r.status = 'attended'
      LOOP
        -- Enqueue outbox event for sending email
        INSERT INTO public.outbox_events (payload)
        VALUES (
          jsonb_build_object(
            'table', 'lost_items',
            'action', 'POST_EVENT_LOST_FOUND',
            'record', jsonb_build_object(
              'event_id', v_event.id,
              'event_title', v_event.title,
              'attendee_email', v_attendee.email,
              'found_items', v_found_items,
              'items_count', v_items_count
            )
          )
        );
      END LOOP;
    END IF;

    -- Mark event as scraped
    UPDATE public.events
    SET lost_found_scraped = TRUE
    WHERE id = v_event.id;
  END LOOP;
END;
$$;

-- 3. Schedule hourly cron task if pg_cron is enabled
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'post-event-lost-found-scraping',
      '0 * * * *', -- every hour
      'SELECT public.scrape_post_event_lost_found();'
    );
  ELSE
    RAISE NOTICE 'pg_cron extension not found; skipping cron scheduling.';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not schedule post-event lost & found scraping: %', SQLERRM;
END;
$$;
