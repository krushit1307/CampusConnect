-- Event Capacity Reservation Consistency (#5221)
--
-- Makes RSVP creation/cancellation use one database transaction so
-- concurrent requests cannot exceed event capacity.

DROP FUNCTION IF EXISTS public.join_event_or_waitlist(UUID, UUID, BOOLEAN);

CREATE OR REPLACE FUNCTION public.join_event_or_waitlist(
    p_event_id UUID,
    p_user_id UUID,
    p_is_anonymous BOOLEAN DEFAULT FALSE,
    p_resume_path TEXT DEFAULT NULL,
    p_referred_by UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_max_attendees INTEGER;
    v_current_attending INTEGER;
    v_existing_status TEXT;
    v_waitlist_position INTEGER;
    v_rsvp_at TIMESTAMPTZ;
    v_is_resume_required BOOLEAN;
BEGIN
    -- Serialize every capacity decision for this event.
    SELECT max_attendees, is_resume_required
    INTO v_max_attendees, v_is_resume_required
    FROM public.events
    WHERE id = p_event_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Event not found.'
        );
    END IF;

    IF v_is_resume_required AND p_resume_path IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'A resume is required to RSVP for this event.'
        );
    END IF;

    -- Duplicate requests are idempotent and do not consume capacity.
    SELECT status
    INTO v_existing_status
    FROM public.event_rsvps
    WHERE event_id = p_event_id
      AND user_id = p_user_id
    FOR UPDATE;

    IF v_existing_status = 'attending' THEN
        UPDATE public.event_rsvps
        SET is_anonymous = p_is_anonymous,
            resume_path = COALESCE(p_resume_path, resume_path)
        WHERE event_id = p_event_id
          AND user_id = p_user_id;

        RETURN jsonb_build_object(
            'success', true,
            'status', 'attending',
            'message', 'Already RSVPed as attending.'
        );
    END IF;

    IF v_existing_status = 'waitlisted' THEN
        UPDATE public.event_rsvps
        SET is_anonymous = p_is_anonymous,
            resume_path = COALESCE(p_resume_path, resume_path)
        WHERE event_id = p_event_id
          AND user_id = p_user_id;

        SELECT COUNT(*) + 1
        INTO v_waitlist_position
        FROM public.event_rsvps
        WHERE event_id = p_event_id
          AND status = 'waitlisted'
          AND rsvp_at < (
              SELECT rsvp_at
              FROM public.event_rsvps
              WHERE event_id = p_event_id
                AND user_id = p_user_id
          );

        RETURN jsonb_build_object(
            'success', true,
            'status', 'waitlisted',
            'position', v_waitlist_position
        );
    END IF;

    -- Re-RSVP after cancellation uses the same locked capacity check.
    IF v_existing_status = 'cancelled' THEN
        SELECT COUNT(*)
        INTO v_current_attending
        FROM public.event_rsvps
        WHERE event_id = p_event_id
          AND status = 'attending';

        IF v_max_attendees IS NULL
           OR v_current_attending < v_max_attendees THEN

            UPDATE public.event_rsvps
            SET status = 'attending',
                rsvp_at = NOW(),
                checked_in = FALSE,
                is_anonymous = p_is_anonymous,
                resume_path = COALESCE(p_resume_path, resume_path)
            WHERE event_id = p_event_id
              AND user_id = p_user_id;

            RETURN jsonb_build_object(
                'success', true,
                'status', 'attending'
            );
        END IF;

        v_rsvp_at := NOW();

        UPDATE public.event_rsvps
        SET status = 'waitlisted',
            rsvp_at = v_rsvp_at,
            is_anonymous = p_is_anonymous,
            resume_path = COALESCE(p_resume_path, resume_path)
        WHERE event_id = p_event_id
          AND user_id = p_user_id;

        SELECT COUNT(*) + 1
        INTO v_waitlist_position
        FROM public.event_rsvps
        WHERE event_id = p_event_id
          AND status = 'waitlisted'
          AND rsvp_at < v_rsvp_at;

        RETURN jsonb_build_object(
            'success', true,
            'status', 'waitlisted',
            'position', v_waitlist_position
        );
    END IF;

    -- Count only confirmed attendees.
    SELECT COUNT(*)
    INTO v_current_attending
    FROM public.event_rsvps
    WHERE event_id = p_event_id
      AND status = 'attending';

    -- The event row is locked for the whole transaction, so another
    -- concurrent request cannot make the same capacity decision.
    IF v_max_attendees IS NULL
       OR v_current_attending < v_max_attendees THEN

        INSERT INTO public.event_rsvps (
            event_id,
            user_id,
            status,
            rsvp_at,
            is_anonymous,
            resume_path
        )
        VALUES (
            p_event_id,
            p_user_id,
            'attending',
            NOW(),
            p_is_anonymous,
            p_resume_path
        );

        RETURN jsonb_build_object(
            'success', true,
            'status', 'attending'
        );
    END IF;

    -- Capacity is full: reserve the user on the waitlist instead.
    v_rsvp_at := NOW();

    INSERT INTO public.event_rsvps (
        event_id,
        user_id,
        status,
        rsvp_at,
        is_anonymous,
        resume_path
    )
    VALUES (
        p_event_id,
        p_user_id,
        'waitlisted',
        v_rsvp_at,
        p_is_anonymous,
        p_resume_path
    );

    SELECT COUNT(*) + 1
    INTO v_waitlist_position
    FROM public.event_rsvps
    WHERE event_id = p_event_id
      AND status = 'waitlisted'
      AND rsvp_at < v_rsvp_at;

    RETURN jsonb_build_object(
        'success', true,
        'status', 'waitlisted',
        'position', v_waitlist_position
    );

EXCEPTION
    WHEN OTHERS THEN
        -- Any error aborts the entire PostgreSQL transaction.
        -- Therefore no capacity slot or partial RSVP remains reserved.
        RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_event_or_waitlist(
    UUID,
    UUID,
    BOOLEAN,
    TEXT,
    UUID
) TO authenticated;

-- Cancellation is also serialized against RSVP creation by locking
-- the event row before releasing the attendee slot.
CREATE OR REPLACE FUNCTION public.cancel_event_rsvp(
    p_event_id UUID,
    p_user_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_status TEXT;
BEGIN
    SELECT id
    FROM public.events
    WHERE id = p_event_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Event not found.'
        );
    END IF;

    SELECT status
    INTO v_status
    FROM public.event_rsvps
    WHERE event_id = p_event_id
      AND user_id = p_user_id
    FOR UPDATE;

    IF v_status IS NULL OR v_status NOT IN ('attending', 'waitlisted') THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'No active RSVP found for this event.'
        );
    END IF;

    UPDATE public.event_rsvps
    SET status = 'cancelled',
        rsvp_at = NOW()
    WHERE event_id = p_event_id
      AND user_id = p_user_id
      AND status IN ('attending', 'waitlisted');

    RETURN jsonb_build_object(
        'success', true,
        'was_attending', v_status = 'attending',
        'message',
        CASE
            WHEN v_status = 'attending'
            THEN 'RSVP cancelled. Next waitlisted user will be promoted.'
            ELSE 'Waitlist entry removed.'
        END
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_event_rsvp(UUID, UUID)
TO authenticated;

COMMENT ON FUNCTION public.join_event_or_waitlist(UUID, UUID, BOOLEAN, TEXT, UUID)
IS 'Atomically reserves event capacity and creates an attending or waitlisted RSVP. The event row is locked with FOR UPDATE so concurrent requests cannot exceed capacity.';

COMMENT ON FUNCTION public.cancel_event_rsvp(UUID, UUID)
IS 'Atomically cancels an RSVP while locking the event row so cancellation, capacity release, and waitlist promotion cannot race with a new RSVP.';