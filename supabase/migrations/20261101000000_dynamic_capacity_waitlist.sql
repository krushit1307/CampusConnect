-- Add capacity_prompt_ignored_at
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS capacity_prompt_ignored_at TIMESTAMPTZ DEFAULT NULL;

-- RPC to increase capacity and promote waitlisted users safely
CREATE OR REPLACE FUNCTION public.increase_capacity_and_promote(
    p_event_id UUID,
    p_new_capacity INT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_current_capacity INT;
    v_current_attending INT;
    v_spots_to_fill INT;
    v_promoted_count INT := 0;
    
    v_promoted_rsvp_id UUID;
    v_promoted_user_id UUID;
    v_promoted_email TEXT;
    v_promoted_name TEXT;
    v_event_title TEXT;
    v_event_short_id TEXT;
    v_webhook_url TEXT;
BEGIN
    -- 1. Get current capacity and attendees
    SELECT max_attendees INTO v_current_capacity
    FROM public.events WHERE id = p_event_id FOR UPDATE;

    IF v_current_capacity >= p_new_capacity THEN
        RETURN jsonb_build_object('success', false, 'error', 'New capacity must be greater than current capacity');
    END IF;

    -- 2. Update capacity
    UPDATE public.events SET max_attendees = p_new_capacity WHERE id = p_event_id;

    -- 3. Calculate spots to fill
    SELECT COUNT(*) INTO v_current_attending
    FROM public.event_rsvps WHERE event_id = p_event_id AND status = 'attending';

    v_spots_to_fill := p_new_capacity - v_current_attending;

    -- Get webhook URL
    v_webhook_url := COALESCE(
        current_setting('app.waitlist_webhook_url', true),
        'http://localhost:54321/functions/v1/waitlist-promotion-email'
    );

    SELECT title, short_id INTO v_event_title, v_event_short_id
    FROM public.events WHERE id = p_event_id;

    -- 4. Loop to promote waitlisted users up to v_spots_to_fill
    WHILE v_promoted_count < v_spots_to_fill LOOP
        v_promoted_rsvp_id := NULL;
        v_promoted_user_id := NULL;
        v_promoted_email := NULL;
        v_promoted_name := NULL;

        SELECT id, user_id
        INTO v_promoted_rsvp_id, v_promoted_user_id
        FROM public.event_rsvps
        WHERE event_id = p_event_id AND status = 'waitlisted'
        ORDER BY rsvp_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1;

        IF v_promoted_rsvp_id IS NULL THEN
            EXIT; -- No more waitlisted users
        END IF;

        UPDATE public.event_rsvps
        SET status = 'attending', rsvp_at = NOW()
        WHERE id = v_promoted_rsvp_id;

        SELECT email, COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')
        INTO v_promoted_email, v_promoted_name
        FROM public.profiles
        WHERE id = v_promoted_user_id;

        -- Fire webhook (synchronously queued by pg_net)
        PERFORM extensions.net.http_post(
            url := v_webhook_url,
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || COALESCE(current_setting('app.service_role_key', true), '')
            ),
            body := jsonb_build_object(
                'event', 'waitlist_promoted',
                'event_id', p_event_id,
                'event_title', v_event_title,
                'event_short_id', v_event_short_id,
                'promoted_user_id', v_promoted_user_id,
                'promoted_email', v_promoted_email,
                'promoted_name', v_promoted_name,
                'promoted_rsvp_id', v_promoted_rsvp_id,
                'via', 'capacity_increase'
            )
        );

        v_promoted_count := v_promoted_count + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true, 
        'promoted_count', v_promoted_count, 
        'new_capacity', p_new_capacity
    );
END;
$$;

-- Schedule the hourly cron job
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        PERFORM extensions.cron.schedule('dynamic-capacity-waitlist', '0 * * * *', $$
        SELECT net.http_post(
            url := COALESCE(current_setting('app.supabase_url', true), 'http://localhost:54321') || '/functions/v1/dynamic-capacity-waitlist',
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || COALESCE(current_setting('app.service_role_key', true), '')
            ),
            body := '{"action": "detect"}'::jsonb
        );
        $$);
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron not available';
END $$;
