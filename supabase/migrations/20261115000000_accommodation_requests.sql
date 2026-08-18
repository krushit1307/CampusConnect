-- Migration: 20261115000000_accommodation_requests.sql
-- Description: Issue #3396 - Attendee Accessibility Accommodation Requests
--
-- The venues table already records what a room has (20260812125000_accessibility_audits).
-- This adds the other half: what an individual attendee needs, whether there is
-- still time to arrange it, and who has to arrange it.

-- 1. Accommodations a student has permanently on file with disability
--    services. Without these, somebody with a permanent need has to re-declare
--    a disability for every single event they attend, which is both a poor
--    experience and an unnecessary repeated disclosure.
CREATE TABLE IF NOT EXISTS public.standing_accommodations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    accommodation_type TEXT NOT NULL CHECK (
        accommodation_type IN (
            'ASL_INTERPRETER', 'CART_CAPTIONING', 'ASSISTIVE_LISTENING',
            'WHEELCHAIR_SEATING', 'COMPANION_SEAT', 'PERSONAL_AIDE',
            'SERVICE_ANIMAL', 'QUIET_ROOM', 'LARGE_PRINT_MATERIALS',
            'DIETARY_MEDICAL'
        )
    ),
    effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    effective_until TIMESTAMPTZ,
    -- Detail for the fulfilling office. Never exposed to event organisers.
    private_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT standing_accommodation_window CHECK (
        effective_until IS NULL OR effective_until > effective_from
    )
);

-- One live entry per person per accommodation; a duplicate would silently
-- double-book a finite venue resource.
CREATE UNIQUE INDEX IF NOT EXISTS idx_standing_accommodation_unique
    ON public.standing_accommodations (user_id, accommodation_type)
    WHERE effective_until IS NULL;

CREATE INDEX IF NOT EXISTS idx_standing_accommodation_user
    ON public.standing_accommodations (user_id);

-- 2. The per-event request itself.
CREATE TABLE IF NOT EXISTS public.accommodation_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    accommodation_type TEXT NOT NULL CHECK (
        accommodation_type IN (
            'ASL_INTERPRETER', 'CART_CAPTIONING', 'ASSISTIVE_LISTENING',
            'WHEELCHAIR_SEATING', 'COMPANION_SEAT', 'PERSONAL_AIDE',
            'SERVICE_ANIMAL', 'QUIET_ROOM', 'LARGE_PRINT_MATERIALS',
            'DIETARY_MEDICAL'
        )
    ),
    state TEXT NOT NULL DEFAULT 'SUBMITTED' CHECK (
        state IN ('SUBMITTED', 'ACKNOWLEDGED', 'ARRANGED', 'DECLINED', 'WITHDRAWN')
    ),
    -- Set when the row was generated from a standing accommodation rather than
    -- asked for directly, so the two can be told apart when reporting.
    from_standing_id UUID REFERENCES public.standing_accommodations(id) ON DELETE SET NULL,
    private_note TEXT,
    -- The feasibility verdict computed at submission. Stored rather than
    -- recomputed on read because it is what the student was told at the time.
    submitted_feasibility TEXT CHECK (
        submitted_feasibility IN (
            'FEASIBLE', 'AT_RISK', 'MISSED_DEADLINE',
            'SATISFIED_BY_VENUE', 'VENUE_INCOMPATIBLE', 'OVER_CAPACITY'
        )
    ),
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    decline_reason TEXT,
    CONSTRAINT accommodation_resolution_recorded CHECK (
        state NOT IN ('ARRANGED', 'DECLINED') OR resolved_at IS NOT NULL
    ),
    CONSTRAINT accommodation_decline_has_reason CHECK (
        state <> 'DECLINED' OR decline_reason IS NOT NULL
    )
);

-- A student cannot hold two live requests for the same thing at the same
-- event. Withdrawn rows are excluded so a withdrawal can be reversed by
-- requesting again.
CREATE UNIQUE INDEX IF NOT EXISTS idx_accommodation_request_unique
    ON public.accommodation_requests (event_id, requester_id, accommodation_type)
    WHERE state <> 'WITHDRAWN';

CREATE INDEX IF NOT EXISTS idx_accommodation_request_event
    ON public.accommodation_requests (event_id, accommodation_type);

-- The escalation queue reads this: unresolved requests, oldest first.
CREATE INDEX IF NOT EXISTS idx_accommodation_request_open
    ON public.accommodation_requests (submitted_at)
    WHERE state = 'SUBMITTED';

-- 3. Finite venue resources. Wheelchair spaces are a fixed count, not an
--    unbounded queue, and the eleventh request for a ten-space room is a
--    decision somebody has to make rather than a row that sits pending.
CREATE TABLE IF NOT EXISTS public.venue_accommodation_resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
    resource TEXT NOT NULL CHECK (
        resource IN ('WHEELCHAIR_SPACE', 'COMPANION_SEAT', 'QUIET_ROOM_PLACE')
    ),
    quantity INTEGER NOT NULL CHECK (quantity >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (venue_id, resource)
);

-- 4. Lead times, kept in the database so the deadline shown on the request
--    form and the deadline enforced by a scheduled job cannot drift apart.
--    Values mirror ACCOMMODATION_SPECS in src/lib/accommodationRequests.ts.
CREATE TABLE IF NOT EXISTS public.accommodation_lead_times (
    accommodation_type TEXT PRIMARY KEY,
    fulfiller TEXT NOT NULL CHECK (
        fulfiller IN ('DISABILITY_SERVICES', 'VENUE', 'ORGANISER')
    ),
    lead_time_business_days INTEGER NOT NULL CHECK (lead_time_business_days > 0),
    at_risk_grace_business_days INTEGER NOT NULL CHECK (at_risk_grace_business_days >= 0),
    CONSTRAINT lead_time_grace_within_lead CHECK (
        at_risk_grace_business_days <= lead_time_business_days
    )
);

INSERT INTO public.accommodation_lead_times
    (accommodation_type, fulfiller, lead_time_business_days, at_risk_grace_business_days)
VALUES
    ('ASL_INTERPRETER',       'DISABILITY_SERVICES', 10, 5),
    ('CART_CAPTIONING',       'DISABILITY_SERVICES',  7, 4),
    ('ASSISTIVE_LISTENING',   'VENUE',                3, 2),
    ('WHEELCHAIR_SEATING',    'VENUE',                2, 1),
    ('COMPANION_SEAT',        'VENUE',                2, 1),
    ('PERSONAL_AIDE',         'ORGANISER',            3, 2),
    ('SERVICE_ANIMAL',        'ORGANISER',            1, 1),
    ('QUIET_ROOM',            'VENUE',                3, 2),
    ('LARGE_PRINT_MATERIALS', 'ORGANISER',            5, 2),
    ('DIETARY_MEDICAL',       'ORGANISER',            5, 3)
ON CONFLICT (accommodation_type) DO NOTHING;

-- 5. Campus non-working days, excluded from business-day counts. An office
--    shut for reading week cannot source an interpreter during it.
CREATE TABLE IF NOT EXISTS public.campus_non_working_days (
    day DATE PRIMARY KEY,
    label TEXT NOT NULL
);

-- 6. Business days strictly between two instants, excluding weekends and the
--    non-working days above. Mirrors businessDaysBetween() in the TypeScript
--    module; the start day is not credited, the end day is.
CREATE OR REPLACE FUNCTION public.accommodation_business_days_between(
    p_from TIMESTAMPTZ,
    p_to TIMESTAMPTZ
)
RETURNS INTEGER
LANGUAGE sql
STABLE
SET search_path = public
AS $$
    SELECT COALESCE(
        (
            SELECT COUNT(*)::INTEGER
            FROM generate_series(
                (LEAST(p_from, p_to))::DATE + 1,
                (GREATEST(p_from, p_to))::DATE,
                INTERVAL '1 day'
            ) AS d(day)
            WHERE EXTRACT(ISODOW FROM d.day) < 6
              AND NOT EXISTS (
                  SELECT 1 FROM public.campus_non_working_days n
                  WHERE n.day = d.day::DATE
              )
        ) * CASE WHEN p_to < p_from THEN -1 ELSE 1 END,
        0
    );
$$;

-- 7. The organiser-facing view: what has to be arranged and how many of it,
--    with no requester identity attached.
--
--    This is a deliberate privacy boundary rather than a convenience. An
--    organiser needs to book two interpreters; they do not need to know which
--    two students are deaf, and a student should not have to disclose that to
--    a peer as the price of attending.
CREATE OR REPLACE VIEW public.accommodation_fulfilment_summary AS
    SELECT
        r.event_id,
        r.accommodation_type,
        t.fulfiller,
        COUNT(*)::INTEGER AS request_count,
        COUNT(*) FILTER (WHERE r.state = 'ARRANGED')::INTEGER AS arranged_count,
        COUNT(*) FILTER (WHERE r.state = 'SUBMITTED')::INTEGER AS outstanding_count,
        MIN(r.submitted_at) AS first_requested_at
    FROM public.accommodation_requests r
    JOIN public.accommodation_lead_times t
        ON t.accommodation_type = r.accommodation_type
    WHERE r.state <> 'WITHDRAWN'
    GROUP BY r.event_id, r.accommodation_type, t.fulfiller;

-- 8. Open requests whose runway has run out, most urgent first. Without this
--    an unacknowledged request simply ages out in silence, which is the
--    failure mode the whole feature exists to prevent.
CREATE OR REPLACE FUNCTION public.get_accommodations_at_risk(p_event_id UUID DEFAULT NULL)
RETURNS TABLE (
    request_id UUID,
    event_id UUID,
    accommodation_type TEXT,
    fulfiller TEXT,
    business_days_remaining INTEGER,
    lead_time_business_days INTEGER
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT
        r.id,
        r.event_id,
        r.accommodation_type,
        t.fulfiller,
        public.accommodation_business_days_between(NOW(), e.start_date),
        t.lead_time_business_days
    FROM public.accommodation_requests r
    JOIN public.accommodation_lead_times t
        ON t.accommodation_type = r.accommodation_type
    JOIN public.events e ON e.id = r.event_id
    WHERE r.state = 'SUBMITTED'
      AND (p_event_id IS NULL OR r.event_id = p_event_id)
      AND public.accommodation_business_days_between(NOW(), e.start_date)
          < t.lead_time_business_days
    ORDER BY public.accommodation_business_days_between(NOW(), e.start_date) ASC, r.id ASC;
$$;

-- 9. Stamp the resolution automatically so the CHECK constraints above cannot
--    be satisfied by a caller writing an arbitrary timestamp.
CREATE OR REPLACE FUNCTION public.stamp_accommodation_resolution()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF NEW.state IN ('ARRANGED', 'DECLINED') AND OLD.state NOT IN ('ARRANGED', 'DECLINED') THEN
        NEW.resolved_at := NOW();
        NEW.resolved_by := COALESCE(NEW.resolved_by, auth.uid());
    END IF;

    -- Re-opening a resolved request must clear the stamp; a stale resolver on
    -- an open request is worse than no resolver at all.
    IF NEW.state NOT IN ('ARRANGED', 'DECLINED') THEN
        NEW.resolved_at := NULL;
        NEW.resolved_by := NULL;
        NEW.decline_reason := NULL;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stamp_accommodation_resolution ON public.accommodation_requests;
CREATE TRIGGER trg_stamp_accommodation_resolution
    BEFORE UPDATE ON public.accommodation_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.stamp_accommodation_resolution();

-- 10. Row level security.
--
--     An accommodation request reveals a disability, so the default has to be
--     that nobody sees it. Enforcing the organiser/office split here rather
--     than only in the UI is the point: a query that bypasses the summary view
--     must not be able to read requester identities.
ALTER TABLE public.accommodation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.standing_accommodations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venue_accommodation_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accommodation_lead_times ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campus_non_working_days ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Requesters manage their own accommodation requests"
    ON public.accommodation_requests;
CREATE POLICY "Requesters manage their own accommodation requests"
    ON public.accommodation_requests FOR ALL
    USING (requester_id = auth.uid())
    WITH CHECK (requester_id = auth.uid());

DROP POLICY IF EXISTS "Students manage their own standing accommodations"
    ON public.standing_accommodations;
CREATE POLICY "Students manage their own standing accommodations"
    ON public.standing_accommodations FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Lead times, venue resource counts and the campus calendar are not personal
-- data and are needed to render a request form, so they are readable by any
-- signed-in user and writable only by the service role.
DROP POLICY IF EXISTS "Lead times are readable" ON public.accommodation_lead_times;
CREATE POLICY "Lead times are readable"
    ON public.accommodation_lead_times FOR SELECT
    TO authenticated
    USING (TRUE);

DROP POLICY IF EXISTS "Venue resource counts are readable"
    ON public.venue_accommodation_resources;
CREATE POLICY "Venue resource counts are readable"
    ON public.venue_accommodation_resources FOR SELECT
    TO authenticated
    USING (TRUE);

DROP POLICY IF EXISTS "Campus non-working days are readable" ON public.campus_non_working_days;
CREATE POLICY "Campus non-working days are readable"
    ON public.campus_non_working_days FOR SELECT
    TO authenticated
    USING (TRUE);

-- The aggregate view carries no identities, so organisers reach it directly.
GRANT SELECT ON public.accommodation_fulfilment_summary TO authenticated;

COMMENT ON TABLE public.accommodation_requests IS
    'Per-attendee accessibility accommodation requests with a lead-time feasibility verdict (#3396).';
COMMENT ON TABLE public.standing_accommodations IS
    'Accommodations held on file so a permanent need is not re-declared for every event.';
COMMENT ON VIEW public.accommodation_fulfilment_summary IS
    'De-identified organiser view: what to arrange and how many, without revealing who needs it.';
COMMENT ON FUNCTION public.accommodation_business_days_between IS
    'Business days between two instants excluding weekends and campus non-working days. Mirrors businessDaysBetween() in src/lib/accommodationRequests.ts.';
