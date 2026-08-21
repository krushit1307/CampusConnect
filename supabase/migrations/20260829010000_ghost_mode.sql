-- ============================================================
-- Migration: 20260829010000_ghost_mode.sql
-- Description: Implement Ghost Mode for Privacy-Conscious Attendees
-- Issue: #2878
-- ============================================================

BEGIN;

-- ─── 1. Add is_anonymous to event_rsvps ────────────────────────────────────

ALTER TABLE public.event_rsvps 
ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_event_rsvps_anonymous ON public.event_rsvps(event_id, is_anonymous);

-- ─── 2. Update join_event_or_waitlist RPC ──────────────────────────────────

DROP FUNCTION IF EXISTS public.join_event_or_waitlist(UUID, UUID);

CREATE OR REPLACE FUNCTION public.join_event_or_waitlist(
    p_event_id UUID,
    p_user_id UUID,
    p_is_anonymous BOOLEAN DEFAULT FALSE
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$ DECLARE
    v_max_attendees INTEGER;
    v_current_attending INTEGER;
    v_existing_status TEXT;
    v_waitlist_position INTEGER;
BEGIN
    -- ── Lock the event row to serialise concurrent joins ────────
    SELECT max_attendees
    INTO v_max_attendees
    FROM public.events
    WHERE id = p_event_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Event not found.'
        );
    END IF;

    -- ── Check for an existing RSVP by this user ─────────────────
    SELECT status
    INTO v_existing_status
    FROM public.event_rsvps
    WHERE event_id = p_event_id
      AND user_id = p_user_id
    LIMIT 1;

    IF v_existing_status = 'attending' THEN
        -- Optionally update the anonymity flag if they were already attending
        UPDATE public.event_rsvps 
        SET is_anonymous = p_is_anonymous
        WHERE event_id = p_event_id AND user_id = p_user_id;
        
        RETURN jsonb_build_object(
            'success', true,
            'status', 'attending',
            'message', 'Already RSVPed as attending. Anonymity setting updated.'
        );
    END IF;

    IF v_existing_status = 'waitlisted' THEN
        -- Optionally update the anonymity flag
        UPDATE public.event_rsvps 
        SET is_anonymous = p_is_anonymous
        WHERE event_id = p_event_id AND user_id = p_user_id;

        SELECT COUNT(*) + 1
        INTO v_waitlist_position
        FROM public.event_rsvps
        WHERE event_id = p_event_id
          AND status = 'waitlisted'
          AND rsvp_at < (
              SELECT rsvp_at FROM public.event_rsvps
              WHERE event_id = p_event_id AND user_id = p_user_id
              LIMIT 1
          );
        RETURN jsonb_build_object(
            'success', true,
            'status', 'waitlisted',
            'position', v_waitlist_position
        );
    END IF;

    -- ── If user had previously cancelled, reactivate ────────────
    IF v_existing_status = 'cancelled' THEN
        PERFORM 1
        FROM public.event_rsvps
        WHERE event_id = p_event_id
          AND user_id = p_user_id
          AND status = 'cancelled'
        FOR UPDATE;

        SELECT COUNT(*)
        INTO v_current_attending
        FROM public.event_rsvps
        WHERE event_id = p_event_id
          AND status = 'attending';

        IF v_max_attendees IS NULL OR v_current_attending < v_max_attendees THEN
            UPDATE public.event_rsvps
            SET status = 'attending', rsvp_at = NOW(), checked_in = FALSE, is_anonymous = p_is_anonymous
            WHERE event_id = p_event_id
              AND user_id = p_user_id
              AND status = 'cancelled';
            RETURN jsonb_build_object(
                'success', true,
                'status', 'attending'
            );
        ELSE
            UPDATE public.event_rsvps
            SET status = 'waitlisted', rsvp_at = NOW(), is_anonymous = p_is_anonymous
            WHERE event_id = p_event_id
              AND user_id = p_user_id
              AND status = 'cancelled';
            SELECT COUNT(*)
            INTO v_waitlist_position
            FROM public.event_rsvps
            WHERE event_id = p_event_id
              AND status = 'waitlisted'
              AND rsvp_at <= (
                  SELECT rsvp_at FROM public.event_rsvps
                  WHERE event_id = p_event_id AND user_id = p_user_id
                  LIMIT 1
              );
            RETURN jsonb_build_object(
                'success', true,
                'status', 'waitlisted',
                'position', v_waitlist_position
            );
        END IF;
    END IF;

    -- ── New RSVP: insert as attending or waitlisted ────────────
    SELECT COUNT(*)
    INTO v_current_attending
    FROM public.event_rsvps
    WHERE event_id = p_event_id
      AND status = 'attending';

    IF v_max_attendees IS NULL OR v_current_attending < v_max_attendees THEN
        INSERT INTO public.event_rsvps (event_id, user_id, status, rsvp_at, is_anonymous)
        VALUES (p_event_id, p_user_id, 'attending', NOW(), p_is_anonymous)
        ON CONFLICT (event_id, user_id) DO UPDATE
            SET status = 'attending', rsvp_at = NOW(), checked_in = FALSE, is_anonymous = p_is_anonymous;
        RETURN jsonb_build_object(
            'success', true,
            'status', 'attending'
        );
    ELSE
        INSERT INTO public.event_rsvps (event_id, user_id, status, rsvp_at, is_anonymous)
        VALUES (p_event_id, p_user_id, 'waitlisted', NOW(), p_is_anonymous)
        ON CONFLICT (event_id, user_id) DO UPDATE
            SET status = 'waitlisted', rsvp_at = NOW(), is_anonymous = p_is_anonymous;
        SELECT COUNT(*)
        INTO v_waitlist_position
        FROM public.event_rsvps
        WHERE event_id = p_event_id
          AND status = 'waitlisted'
          AND rsvp_at <= (
              SELECT rsvp_at FROM public.event_rsvps
              WHERE event_id = p_event_id AND user_id = p_user_id
              LIMIT 1
          );
        RETURN jsonb_build_object(
            'success', true,
            'status', 'waitlisted',
            'position', v_waitlist_position
        );
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_event_or_waitlist(UUID, UUID, BOOLEAN) TO authenticated;

-- ─── 3. Guest List RPCs ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_public_event_guests(p_event_id UUID)
RETURNS TABLE (
    user_id UUID,
    display_name TEXT,
    avatar_url TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        CASE
            WHEN r.is_anonymous THEN NULL
            ELSE u.id
        END AS user_id,

        CASE
            WHEN r.is_anonymous THEN 'Anonymous Student'
            ELSE u.full_name
        END AS display_name,

        CASE
            WHEN r.is_anonymous THEN NULL
            ELSE u.avatar_url
        END AS avatar_url

    FROM public.event_rsvps r
    JOIN public.profiles u ON u.id = r.user_id
    WHERE r.event_id = p_event_id AND r.status = 'attending';
$$;

GRANT EXECUTE ON FUNCTION public.get_public_event_guests(UUID) TO public;
GRANT EXECUTE ON FUNCTION public.get_public_event_guests(UUID) TO authenticated;


CREATE OR REPLACE FUNCTION public.get_event_admin_guests(p_event_id UUID)
RETURNS TABLE (
    user_id UUID,
    display_name TEXT,
    avatar_url TEXT,
    is_anonymous BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_is_organizer BOOLEAN;
BEGIN
    -- Check if current user is an organizer
    -- Assume we check if they are part of the club that hosts the event
    -- We can use standard RLS checks or custom logic, here's a basic check:
    SELECT EXISTS (
        SELECT 1 FROM public.events e
        JOIN public.club_members cm ON e.club_id = cm.club_id
        WHERE e.id = p_event_id AND cm.user_id = auth.uid() AND cm.role IN ('admin', 'officer')
    ) INTO v_is_organizer;

    IF NOT v_is_organizer THEN
        RAISE EXCEPTION 'Access denied. Only event organizers can view this.';
    END IF;

    RETURN QUERY
    SELECT
        u.id AS user_id,
        u.full_name AS display_name,
        u.avatar_url,
        r.is_anonymous
    FROM public.event_rsvps r
    JOIN public.profiles u ON u.id = r.user_id
    WHERE r.event_id = p_event_id AND r.status = 'attending';
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_event_admin_guests(UUID) TO authenticated;

COMMIT;
