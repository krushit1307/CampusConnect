-- ============================================================
-- Migration: 20270203000000_speaker_travel_itineraries.sql
-- Issue: #3753 — Automated Speaker Travel Itinerary & Arrival
--                Buffer Coordination
--
-- Context
--   Speaker travel lives in email threads and forwarded ticket PDFs,
--   never in the same system as the session schedule. So the one
--   calculation that matters — does this person physically arrive
--   before they are due on stage, with margin? — is never performed.
--
-- Design notes
--   1. `speaker_itineraries` ties a journey to a session and a call
--      time. Without the call time there is no buffer to compute.
--   2. `itinerary_legs` models multi-leg journeys. Legs are ordered by
--      `sequence`, unique per itinerary, so the chain is unambiguous.
--   3. `delay_minutes` is per leg and mutable. Entering a delay on the
--      first leg has to cascade, which is done in the application
--      layer (src/lib/speakerItinerary.ts) because the propagation
--      rule — a long layover absorbs a delay, a short one turns it
--      into a missed connection — is not expressible as a simple
--      column default.
--   4. Post-arrival processing (immigration, baggage) and minimum
--      connection times are mode characteristics, held in a lookup
--      table so an institution can tune them for its own airport
--      without a code change.
--   5. Itineraries carry personal travel detail. RLS restricts them to
--      event organisers and the assigned host — not to the whole club.
-- ============================================================

BEGIN;

-- ─── 1. Enums ───────────────────────────────────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'travel_mode') THEN
        CREATE TYPE public.travel_mode AS ENUM (
            'flight_international',
            'flight_domestic',
            'rail',
            'bus',
            'car',
            'ground_transfer'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'itinerary_direction') THEN
        CREATE TYPE public.itinerary_direction AS ENUM ('inbound', 'outbound');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'itinerary_status') THEN
        CREATE TYPE public.itinerary_status AS ENUM (
            'draft',
            'confirmed',
            'in_transit',
            'arrived',
            'cancelled'
        );
    END IF;
END$$;

-- ─── 2. Travel mode characteristics ─────────────────────────────────
-- A 40-minute layover is comfortable off a train and a missed flight
-- in an international terminal. Institutions differ (a small regional
-- airport clears immigration far faster than a hub), so these are
-- data, not constants.
CREATE TABLE IF NOT EXISTS public.travel_mode_profiles (
    mode                       public.travel_mode PRIMARY KEY,
    -- Minimum gap needed to connect FROM this mode onto the next leg.
    min_connection_minutes     INTEGER NOT NULL,
    -- Time on the ground after arriving by this mode before onward
    -- travel can begin: immigration, baggage, platform egress.
    post_arrival_minutes       INTEGER NOT NULL,
    updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT travel_mode_min_connection_nonneg
        CHECK (min_connection_minutes >= 0),
    CONSTRAINT travel_mode_post_arrival_nonneg
        CHECK (post_arrival_minutes >= 0)
);

-- Defaults mirror MINIMUM_CONNECTION_MINUTES / POST_ARRIVAL_PROCESSING_MINUTES
-- in src/lib/speakerItinerary.ts.
INSERT INTO public.travel_mode_profiles (mode, min_connection_minutes, post_arrival_minutes)
VALUES
    ('flight_international', 90, 60),
    ('flight_domestic',      45, 25),
    ('rail',                 20, 10),
    ('bus',                  15,  5),
    ('car',                  10,  0),
    ('ground_transfer',      10,  0)
ON CONFLICT (mode) DO NOTHING;

-- ─── 3. Itineraries ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.speaker_itineraries (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id     UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    -- The speaker may or may not have an account on the platform;
    -- external keynotes usually do not, hence the free-text name.
    speaker_id   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    speaker_name TEXT NOT NULL,
    speaker_contact TEXT,
    direction    public.itinerary_direction NOT NULL DEFAULT 'inbound',
    -- When the speaker is due ON SITE, which is earlier than when they
    -- are due on stage — briefing, mic check, green room.
    call_time    TIMESTAMPTZ NOT NULL,
    session_title TEXT,
    -- Who meets them. The handoff is the part that gets dropped.
    host_id      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    -- Minutes from the final arrival point to campus.
    ground_transfer_minutes INTEGER NOT NULL DEFAULT 60,
    status       public.itinerary_status NOT NULL DEFAULT 'draft',
    notes        TEXT,
    created_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT speaker_itineraries_name_not_blank
        CHECK (LENGTH(TRIM(speaker_name)) > 0),
    CONSTRAINT speaker_itineraries_transfer_nonneg
        CHECK (ground_transfer_minutes >= 0)
);

COMMENT ON COLUMN public.speaker_itineraries.call_time IS
    'When the speaker is due on site, not on stage — the buffer is measured against this.';

CREATE INDEX IF NOT EXISTS idx_speaker_itineraries_event
    ON public.speaker_itineraries (event_id, direction);
CREATE INDEX IF NOT EXISTS idx_speaker_itineraries_host
    ON public.speaker_itineraries (host_id);

-- ─── 4. Legs ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.itinerary_legs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    itinerary_id  UUID NOT NULL REFERENCES public.speaker_itineraries(id) ON DELETE CASCADE,
    sequence      INTEGER NOT NULL,
    mode          public.travel_mode NOT NULL,
    carrier       TEXT,
    reference     TEXT,
    origin        TEXT NOT NULL,
    destination   TEXT NOT NULL,
    scheduled_departure TIMESTAMPTZ NOT NULL,
    scheduled_arrival   TIMESTAMPTZ NOT NULL,
    -- Live delay, entered by an organiser tracking the journey.
    -- Negative means running early, which does happen.
    delay_minutes INTEGER NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT itinerary_legs_sequence_unique UNIQUE (itinerary_id, sequence),
    CONSTRAINT itinerary_legs_sequence_positive CHECK (sequence >= 1),
    -- A leg that lands before it takes off is a data entry error, and
    -- silently accepting it produces a nonsense buffer downstream.
    CONSTRAINT itinerary_legs_times_ordered
        CHECK (scheduled_arrival >= scheduled_departure),
    CONSTRAINT itinerary_legs_origin_not_blank CHECK (LENGTH(TRIM(origin)) > 0),
    CONSTRAINT itinerary_legs_destination_not_blank
        CHECK (LENGTH(TRIM(destination)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_itinerary_legs_itinerary
    ON public.itinerary_legs (itinerary_id, sequence);

-- ─── 5. Leg chaining guard ──────────────────────────────────────────
-- Refuses a leg that departs before the previous one has landed. This
-- catches the common copy-paste error where two bookings are pasted in
-- the wrong order, which would otherwise produce a confidently wrong
-- arrival projection.
CREATE OR REPLACE FUNCTION public.validate_itinerary_leg_chain()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_prev_arrival TIMESTAMPTZ;
    v_next_departure TIMESTAMPTZ;
BEGIN
    SELECT scheduled_arrival INTO v_prev_arrival
    FROM public.itinerary_legs
    WHERE itinerary_id = NEW.itinerary_id
      AND sequence < NEW.sequence
    ORDER BY sequence DESC
    LIMIT 1;

    IF v_prev_arrival IS NOT NULL AND NEW.scheduled_departure < v_prev_arrival THEN
        RAISE EXCEPTION
            'Leg % departs at % but the previous leg does not land until %',
            NEW.sequence, NEW.scheduled_departure, v_prev_arrival;
    END IF;

    SELECT scheduled_departure INTO v_next_departure
    FROM public.itinerary_legs
    WHERE itinerary_id = NEW.itinerary_id
      AND sequence > NEW.sequence
    ORDER BY sequence ASC
    LIMIT 1;

    IF v_next_departure IS NOT NULL AND NEW.scheduled_arrival > v_next_departure THEN
        RAISE EXCEPTION
            'Leg % lands at % but the next leg departs at %',
            NEW.sequence, NEW.scheduled_arrival, v_next_departure;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_itinerary_leg_chain ON public.itinerary_legs;
CREATE TRIGGER trg_itinerary_leg_chain
    BEFORE INSERT OR UPDATE ON public.itinerary_legs
    FOR EACH ROW EXECUTE FUNCTION public.validate_itinerary_leg_chain();

-- ─── 6. updated_at maintenance ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.touch_itinerary_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_speaker_itineraries_touch ON public.speaker_itineraries;
CREATE TRIGGER trg_speaker_itineraries_touch
    BEFORE UPDATE ON public.speaker_itineraries
    FOR EACH ROW EXECUTE FUNCTION public.touch_itinerary_updated_at();

DROP TRIGGER IF EXISTS trg_itinerary_legs_touch ON public.itinerary_legs;
CREATE TRIGGER trg_itinerary_legs_touch
    BEFORE UPDATE ON public.itinerary_legs
    FOR EACH ROW EXECUTE FUNCTION public.touch_itinerary_updated_at();

-- ─── 7. Access predicates ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.can_view_itinerary(p_itinerary_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.speaker_itineraries i
        JOIN public.events e ON e.id = i.event_id
        LEFT JOIN public.club_members cm
               ON cm.club_id = e.club_id AND cm.user_id = p_user_id
        WHERE i.id = p_itinerary_id
          AND (
                -- The assigned host needs the details to do the pickup.
                i.host_id = p_user_id
                -- The speaker themselves, if they have an account.
                OR i.speaker_id = p_user_id
                -- Organisers of the owning club.
                OR (
                     cm.status::TEXT = 'approved'
                     AND cm.role::TEXT IN ('owner', 'admin', 'officer')
                   )
              )
    );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_itinerary(p_event_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.events e
        JOIN public.club_members cm ON cm.club_id = e.club_id
        WHERE e.id = p_event_id
          AND cm.user_id = p_user_id
          AND cm.status::TEXT = 'approved'
          AND cm.role::TEXT IN ('owner', 'admin', 'officer')
    );
$$;

-- ─── 8. Arrival board RPC ───────────────────────────────────────────
-- Hands the organiser view a complete, already-authorised picture of
-- every inbound journey for an event, with the legs nested as JSON.
-- The buffer maths runs client-side so that entering a delay re-bands
-- the whole board instantly, but the *inputs* (including the tunable
-- mode profiles) come from here so client and server never disagree
-- about how long immigration takes.
CREATE OR REPLACE FUNCTION public.get_event_arrival_board(
    p_event_id  UUID,
    p_direction TEXT DEFAULT 'inbound'
)
RETURNS TABLE (
    itinerary_id            UUID,
    speaker_name            TEXT,
    speaker_contact         TEXT,
    direction               TEXT,
    call_time               TIMESTAMPTZ,
    session_title           TEXT,
    host_name               TEXT,
    ground_transfer_minutes INTEGER,
    status                  TEXT,
    legs                    JSONB
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT public.can_manage_itinerary(p_event_id, auth.uid()) THEN
        RAISE EXCEPTION 'Only event organisers may view the arrival board';
    END IF;

    RETURN QUERY
    SELECT
        i.id,
        i.speaker_name,
        i.speaker_contact,
        i.direction::TEXT,
        i.call_time,
        i.session_title,
        host.full_name,
        i.ground_transfer_minutes,
        i.status::TEXT,
        COALESCE(
            (
                SELECT JSONB_AGG(
                    JSONB_BUILD_OBJECT(
                        'id', l.id,
                        'sequence', l.sequence,
                        'mode', l.mode,
                        'carrier', l.carrier,
                        'reference', l.reference,
                        'origin', l.origin,
                        'destination', l.destination,
                        'scheduledDeparture', l.scheduled_departure,
                        'scheduledArrival', l.scheduled_arrival,
                        'delayMinutes', l.delay_minutes
                    )
                    ORDER BY l.sequence
                )
                FROM public.itinerary_legs l
                WHERE l.itinerary_id = i.id
            ),
            '[]'::JSONB
        )
    FROM public.speaker_itineraries i
    LEFT JOIN public.profiles host ON host.id = i.host_id
    WHERE i.event_id = p_event_id
      AND i.direction::TEXT = p_direction
      AND i.status <> 'cancelled'
    ORDER BY i.call_time;
END;
$$;

-- ─── 9. Delay reporting RPC ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.report_leg_delay(
    p_leg_id  UUID,
    p_minutes INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event_id UUID;
BEGIN
    SELECT i.event_id INTO v_event_id
    FROM public.itinerary_legs l
    JOIN public.speaker_itineraries i ON i.id = l.itinerary_id
    WHERE l.id = p_leg_id;

    IF v_event_id IS NULL THEN
        RAISE EXCEPTION 'Itinerary leg % not found', p_leg_id;
    END IF;

    IF NOT public.can_manage_itinerary(v_event_id, auth.uid()) THEN
        RAISE EXCEPTION 'Only event organisers may report travel delays';
    END IF;

    -- A "delay" of several days is a data entry slip, not a delay, and
    -- would silently produce an absurd arrival projection.
    IF p_minutes < -720 OR p_minutes > 2880 THEN
        RAISE EXCEPTION 'Delay of % minutes is out of plausible range', p_minutes;
    END IF;

    UPDATE public.itinerary_legs
    SET delay_minutes = p_minutes
    WHERE id = p_leg_id;
END;
$$;

-- ─── 10. Row Level Security ─────────────────────────────────────────
ALTER TABLE public.speaker_itineraries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itinerary_legs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.travel_mode_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Organisers and hosts read itineraries" ON public.speaker_itineraries;
CREATE POLICY "Organisers and hosts read itineraries"
    ON public.speaker_itineraries FOR SELECT
    USING (public.can_view_itinerary(id, auth.uid()));

DROP POLICY IF EXISTS "Organisers manage itineraries" ON public.speaker_itineraries;
CREATE POLICY "Organisers manage itineraries"
    ON public.speaker_itineraries FOR ALL
    USING (public.can_manage_itinerary(event_id, auth.uid()))
    WITH CHECK (public.can_manage_itinerary(event_id, auth.uid()));

DROP POLICY IF EXISTS "Organisers and hosts read legs" ON public.itinerary_legs;
CREATE POLICY "Organisers and hosts read legs"
    ON public.itinerary_legs FOR SELECT
    USING (public.can_view_itinerary(itinerary_id, auth.uid()));

DROP POLICY IF EXISTS "Organisers manage legs" ON public.itinerary_legs;
CREATE POLICY "Organisers manage legs"
    ON public.itinerary_legs FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.speaker_itineraries i
            WHERE i.id = itinerary_id
              AND public.can_manage_itinerary(i.event_id, auth.uid())
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.speaker_itineraries i
            WHERE i.id = itinerary_id
              AND public.can_manage_itinerary(i.event_id, auth.uid())
        )
    );

-- Mode profiles are reference data — readable by any signed-in user so
-- the client can compute buffers, writable by nobody through the API.
DROP POLICY IF EXISTS "Anyone reads travel mode profiles" ON public.travel_mode_profiles;
CREATE POLICY "Anyone reads travel mode profiles"
    ON public.travel_mode_profiles FOR SELECT
    USING (auth.uid() IS NOT NULL);

-- ─── 11. Grants ─────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.speaker_itineraries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.itinerary_legs TO authenticated;
GRANT SELECT ON public.travel_mode_profiles TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_event_arrival_board(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_leg_delay(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_itinerary(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_itinerary(UUID, UUID) TO authenticated;

COMMIT;
