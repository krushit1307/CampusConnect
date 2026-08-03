-- Migration: 20260727030000_merge_events_rpc.sql
-- Description: Implement a transaction-safe RPC function to merge co-hosted events, re-parenting all children and preventing duplicates.

CREATE OR REPLACE FUNCTION public.merge_events(
    p_primary_event_id UUID,
    p_secondary_event_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_primary_club_id UUID;
    v_secondary_club_id UUID;
BEGIN
    -- 1. Validate both events exist and resolve their respective club_ids
    SELECT club_id INTO v_primary_club_id
    FROM public.events
    WHERE id = p_primary_event_id;

    IF v_primary_club_id IS NULL THEN
        RAISE EXCEPTION 'Primary event % not found.', p_primary_event_id;
    END IF;

    SELECT club_id INTO v_secondary_club_id
    FROM public.events
    WHERE id = p_secondary_event_id;

    IF v_secondary_club_id IS NULL THEN
        RAISE EXCEPTION 'Secondary event % not found.', p_secondary_event_id;
    END IF;

    -- Prevent self-merge
    IF p_primary_event_id = p_secondary_event_id THEN
        RAISE EXCEPTION 'Cannot merge an event with itself.';
    END IF;

    -- 2. Merge unique child records using INSERT ON CONFLICT DO NOTHING and DELETE

    -- A. event_rsvps (composite unique constraint on event_id, user_id, club_id)
    INSERT INTO public.event_rsvps (event_id, user_id, club_id, checked_in, rsvp_at, status)
    SELECT p_primary_event_id, user_id, v_primary_club_id, checked_in, rsvp_at, status
    FROM public.event_rsvps
    WHERE event_id = p_secondary_event_id
    ON CONFLICT (event_id, user_id, club_id) DO NOTHING;

    DELETE FROM public.event_rsvps WHERE event_id = p_secondary_event_id;

    -- B. event_waitlist (composite unique constraint on event_id, user_id, club_id)
    INSERT INTO public.event_waitlist (event_id, user_id, club_id, created_at)
    SELECT p_primary_event_id, user_id, v_primary_club_id, created_at
    FROM public.event_waitlist
    WHERE event_id = p_secondary_event_id
    ON CONFLICT (event_id, user_id, club_id) DO NOTHING;

    DELETE FROM public.event_waitlist WHERE event_id = p_secondary_event_id;

    -- C. saved_events (composite unique constraint on event_id, user_id, club_id)
    INSERT INTO public.saved_events (event_id, user_id, club_id, saved_at)
    SELECT p_primary_event_id, user_id, v_primary_club_id, saved_at
    FROM public.saved_events
    WHERE event_id = p_secondary_event_id
    ON CONFLICT (event_id, user_id, club_id) DO NOTHING;

    DELETE FROM public.saved_events WHERE event_id = p_secondary_event_id;

    -- D. event_feedbacks (unique constraint on event_id, user_id)
    INSERT INTO public.event_feedbacks (event_id, user_id, rating, comment, created_at)
    SELECT p_primary_event_id, user_id, rating, comment, created_at
    FROM public.event_feedbacks
    WHERE event_id = p_secondary_event_id
    ON CONFLICT (event_id, user_id) DO NOTHING;

    DELETE FROM public.event_feedbacks WHERE event_id = p_secondary_event_id;

    -- E. event_co_hosts (unique constraint on event_id, club_id)
    INSERT INTO public.event_co_hosts (event_id, club_id, created_at)
    SELECT p_primary_event_id, club_id, created_at
    FROM public.event_co_hosts
    WHERE event_id = p_secondary_event_id
    ON CONFLICT (event_id, club_id) DO NOTHING;

    DELETE FROM public.event_co_hosts WHERE event_id = p_secondary_event_id;

    -- F. event_cohosts (unique constraint on event_id, user_id)
    INSERT INTO public.event_cohosts (event_id, user_id, created_at)
    SELECT p_primary_event_id, user_id, created_at
    FROM public.event_cohosts
    WHERE event_id = p_secondary_event_id
    ON CONFLICT (event_id, user_id) DO NOTHING;

    DELETE FROM public.event_cohosts WHERE event_id = p_secondary_event_id;

    -- 3. Re-parent non-unique child records using UPDATE

    -- A. certificates (foreign key references public.events(id, club_id))
    UPDATE public.certificates
    SET event_id = p_primary_event_id, club_id = v_primary_club_id
    WHERE event_id = p_secondary_event_id;

    -- B. polls (foreign key references public.events(id))
    UPDATE public.polls
    SET event_id = p_primary_event_id
    WHERE event_id = p_secondary_event_id;

    -- C. event_resources (foreign key references public.events(id))
    UPDATE public.event_resources
    SET event_id = p_primary_event_id
    WHERE event_id = p_secondary_event_id;

    -- D. event_photos (foreign key references public.events(id))
    UPDATE public.event_photos
    SET event_id = p_primary_event_id
    WHERE event_id = p_secondary_event_id;

    -- 4. Delete the secondary event record itself
    DELETE FROM public.events
    WHERE id = p_secondary_event_id;

END;
$$;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.merge_events(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.merge_events(UUID, UUID) TO service_role;
