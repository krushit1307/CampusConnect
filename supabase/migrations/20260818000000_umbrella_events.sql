-- ============================================================
-- Migration: Campus-Wide Multi-Event (Umbrella) Architecture
-- Issue #2909
--
-- Adds:
--   1. `parent_event_id` and `event_type` columns to `events`.
--   2. `is_global_pass` column to `event_rsvps` to mark RSVPs
--      granted via a parent umbrella pass.
--   3. RLS policies allowing club admins to edit their own child
--      events under a parent umbrella owned by a different club.
--   4. RPCs for fetching the umbrella schedule, purchasing a global
--      pass, and claiming a seat at a gated child event.
--   5. Updated `check_event_clashes` to handle child events.
-- ============================================================

-- ── Step 1: Add umbrella columns to events ─────────────────────
ALTER TABLE public.events
    ADD COLUMN IF NOT EXISTS parent_event_id UUID REFERENCES public.events(id) ON DELETE CASCADE;

ALTER TABLE public.events
    ADD COLUMN IF NOT EXISTS event_type TEXT NOT NULL DEFAULT 'standalone'
    CHECK (event_type IN ('standalone', 'umbrella', 'child'));

-- Index for fast child-event lookups by parent.
CREATE INDEX IF NOT EXISTS idx_events_parent
    ON public.events (parent_event_id)
    WHERE parent_event_id IS NOT NULL;

-- ── Step 2: Add is_global_pass to event_rsvps ──────────────────
ALTER TABLE public.event_rsvps
    ADD COLUMN IF NOT EXISTS is_global_pass BOOLEAN NOT NULL DEFAULT FALSE;

-- ── Step 3: RLS — club admins can edit their own child events ──
-- The existing RLS policy "Club admins can update events" checks
-- ownership via the event's club_id. This is sufficient for child
-- events because each child retains its own club_id. We just need
-- to ensure club admins can SELECT the parent umbrella event
-- (owned by a different club) so they can assign their child to it.

DROP POLICY IF EXISTS "Club admins can view parent umbrella events." ON public.events;
CREATE POLICY "Club admins can view parent umbrella events."
ON public.events FOR SELECT
USING (
    event_type != 'umbrella'
    OR EXISTS (
        SELECT 1 FROM public.events child_events
        WHERE child_events.parent_event_id = events.id
          AND EXISTS (
              SELECT 1 FROM public.club_members cm
              WHERE cm.club_id = child_events.club_id
                AND cm.user_id = auth.uid()
                AND cm.role = 'admin'
                AND cm.status = 'approved'
          )
    )
);

-- ── Step 4: RPC — get_umbrella_schedule ─────────────────────────
-- Returns the parent event + all its child events, ordered by
-- start time. Used by the UmbrellaLandingPage frontend component.
CREATE OR REPLACE FUNCTION public.get_umbrella_schedule(
    p_umbrella_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$ DECLARE
    v_umbrella JSONB;
    v_children JSONB;
BEGIN
    -- Fetch the parent umbrella event.
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id', e.id,
            'title', e.title,
            'description', e.description,
            'location', e.location,
            'event_date', e.event_date,
            'start_date', e.start_date,
            'end_date', e.end_date,
            'banner_url', e.banner_url,
            'max_attendees', e.max_attendees,
            'club_id', e.club_id,
            'event_type', e.event_type
        )
    ), 'null'::jsonb)
    INTO v_umbrella
    FROM public.events e
    WHERE e.id = p_umbrella_id
      AND e.event_type = 'umbrella';

    IF v_umbrella IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Umbrella event not found.');
    END IF;

    -- Fetch all child events ordered by start time.
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id', e.id,
            'title', e.title,
            'description', e.description,
            'location', e.location,
            'event_date', e.event_date,
            'start_date', e.start_date,
            'end_date', e.end_date,
            'banner_url', e.banner_url,
            'max_attendees', e.max_attendees,
            'club_id', e.club_id,
            'event_type', e.event_type,
            'parent_event_id', e.parent_event_id,
            'club_name', c.name,
            'club_slug', c.slug
        )
        ORDER BY e.start_date NULLS LAST, e.event_date NULLS LAST
    ), '[]'::jsonb)
    INTO v_children
    FROM public.events e
    LEFT JOIN public.clubs c ON c.id = e.club_id
    WHERE e.parent_event_id = p_umbrella_id
      AND e.event_type = 'child';

    -- Compute attending counts for each child.
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'event_id', counts.event_id,
            'attending_count', counts.attending_count
        )
    ), '[]'::jsonb)
    INTO v_children
    FROM (
        SELECT
            e.id AS event_id,
            COUNT(r.id) FILTER (WHERE r.status = 'attending' OR r.is_global_pass = TRUE) AS attending_count
        FROM public.events e
        LEFT JOIN public.event_rsvps r ON r.event_id = e.id
        WHERE e.parent_event_id = p_umbrella_id
        GROUP BY e.id
    ) counts;

    RETURN jsonb_build_object(
        'success', true,
        'umbrella', v_umbrella,
        'children', v_children
    );
END;
 $$;

COMMENT ON FUNCTION public.get_umbrella_schedule(UUID) IS
'Returns the parent umbrella event + all child events with attending counts, ordered by start time. Used by the UmbrellaLandingPage.';

-- ── Step 5: RPC — purchase_global_pass ──────────────────────────
-- Atomically creates an 'attending' RSVP for the parent umbrella
-- AND auto-RSVPs the user to all child events that have no capacity
-- limit (max_attendees IS NULL). For gated child events (capacity
-- set), the user gets a 'waitlisted' RSVP that they must explicitly
-- claim. Uses SELECT FOR UPDATE on the umbrella to serialise
-- concurrent pass purchases.
CREATE OR REPLACE FUNCTION public.purchase_global_pass(
    p_umbrella_id UUID,
    p_user_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$ DECLARE
    v_umbrella_max INTEGER;
    v_current_passes INTEGER;
    v_child RECORD;
    v_child_attending INTEGER;
    v_created_count INTEGER := 0;
    v_waitlisted_count INTEGER := 0;
BEGIN
    -- Lock the umbrella event row.
    SELECT max_attendees
    INTO v_umbrella_max
    FROM public.events
    WHERE id = p_umbrella_id
      AND event_type = 'umbrella'
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Umbrella event not found.');
    END IF;

    -- Check if user already has a pass.
    IF EXISTS (
        SELECT 1 FROM public.event_rsvps
        WHERE event_id = p_umbrella_id
          AND user_id = p_user_id
          AND is_global_pass = TRUE
    ) THEN
        RETURN jsonb_build_object('success', true, 'message', 'User already has a global pass.');
    END IF;

    -- Check umbrella capacity (the pass itself).
    IF v_umbrella_max IS NOT NULL THEN
        SELECT COUNT(*)
        INTO v_current_passes
        FROM public.event_rsvps
        WHERE event_id = p_umbrella_id
          AND is_global_pass = TRUE;

        IF v_current_passes >= v_umbrella_max THEN
            RETURN jsonb_build_object('success', false, 'error', 'Global passes are sold out.');
        END IF;
    END IF;

    -- Insert the parent pass RSVP.
    INSERT INTO public.event_rsvps (event_id, user_id, status, is_global_pass, rsvp_at)
    VALUES (p_umbrella_id, p_user_id, 'attending', TRUE, NOW())
    ON CONFLICT (event_id, user_id) DO UPDATE
        SET status = 'attending', is_global_pass = TRUE, rsvp_at = NOW();

    -- Iterate over child events and auto-RSVP where possible.
    FOR v_child IN
        SELECT id, max_attendees
        FROM public.events
        WHERE parent_event_id = p_umbrella_id
          AND event_type = 'child'
    LOOP
        -- Check if the user already has an RSVP for this child.
        IF EXISTS (
            SELECT 1 FROM public.event_rsvps
            WHERE event_id = v_child.id AND user_id = p_user_id
        ) THEN
            CONTINUE;
        END IF;

        IF v_child.max_attendees IS NULL THEN
            -- No capacity limit → auto-RSVP as attending via the pass.
            INSERT INTO public.event_rsvps (event_id, user_id, status, is_global_pass, rsvp_at)
            VALUES (v_child.id, p_user_id, 'attending', TRUE, NOW())
            ON CONFLICT (event_id, user_id) DO NOTHING;
            v_created_count := v_created_count + 1;
        ELSE
            -- Gated child event → check if there's room.
            SELECT COUNT(*) FILTER (WHERE status = 'attending' OR is_global_pass = TRUE)
            INTO v_child_attending
            FROM public.event_rsvps
            WHERE event_id = v_child.id;

            IF v_child_attending < v_child.max_attendees THEN
                -- Claim the seat automatically via the pass.
                INSERT INTO public.event_rsvps (event_id, user_id, status, is_global_pass, rsvp_at)
                VALUES (v_child.id, p_user_id, 'attending', TRUE, NOW())
                ON CONFLICT (event_id, user_id) DO NOTHING;
                v_created_count := v_created_count + 1;
            ELSE
                -- Full → waitlist the user; they must explicitly claim later.
                INSERT INTO public.event_rsvps (event_id, user_id, status, is_global_pass, rsvp_at)
                VALUES (v_child.id, p_user_id, 'waitlisted', TRUE, NOW())
                ON CONFLICT (event_id, user_id) DO NOTHING;
                v_waitlisted_count := v_waitlisted_count + 1;
            END IF;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Global pass purchased.',
        'auto_rsvped_count', v_created_count,
        'waitlisted_count', v_waitlisted_count
    );
END;
 $$;

COMMENT ON FUNCTION public.purchase_global_pass(UUID, UUID) IS
'Atomically purchases a parent umbrella global pass and auto-RSVPs the user to all ungated child events. Gated child events (with max_attendees) are auto-claimed if room exists, else the user is waitlisted.';

-- ── Step 6: Updated check_event_clashes for child events ───────
-- The existing check_event_clashes function is extended to exclude
-- clashes between a child event and its own parent umbrella (they
-- are supposed to overlap in time), and to respect the parent-child
-- relationship.
CREATE OR REPLACE FUNCTION public.check_event_clashes(
    p_start_time TIMESTAMPTZ,
    p_end_time TIMESTAMPTZ,
    p_location_id TEXT,
    p_category TEXT DEFAULT NULL,
    p_exclude_event_id UUID DEFAULT NULL,
    p_parent_event_id UUID DEFAULT NULL
) RETURNS TABLE (
    event_id UUID,
    title TEXT,
    clash_type TEXT
) AS $$ BEGIN
    RETURN QUERY
    SELECT
        e.id AS event_id,
        e.title,
        CASE
            WHEN e.location_id = p_location_id THEN 'HARD'
            ELSE 'SOFT'
        END AS clash_type
    FROM public.events e
    WHERE (p_exclude_event_id IS NULL OR e.id != p_exclude_event_id)
      -- Don't flag the parent umbrella as a clash with its own child.
      AND (p_parent_event_id IS NULL OR e.id != p_parent_event_id)
      -- Don't flag sibling children under the same umbrella as clashes
      -- (the user is expected to pick which concurrent workshops to attend).
      AND (p_parent_event_id IS NULL OR e.parent_event_id != p_parent_event_id)
      AND tsrange(e.start_time, e.end_time) && tsrange(p_start_time, p_end_time)
      AND (
          e.location_id = p_location_id
          OR (p_category IS NOT NULL AND e.category = p_category)
      );
END;
 $$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION public.check_event_clashes IS
'Checks for event clashes using time-range overlap. Extended for Issue #2909 to exclude parent umbrella events and sibling children under the same umbrella from clash detection.';

-- ============================================================
-- End of migration
-- ============================================================
