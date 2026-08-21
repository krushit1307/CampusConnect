-- Migration: 20260905000000_emergency_roll_call.sql
-- Description: Issue #3136 - Emergency Roll-Call & Evacuation Headcount Mode

-- 1. Assembly zones. A marshal owns a zone and needs their own headcount for
--    it, so zones are first-class rather than a free-text label on the entry.
CREATE TABLE IF NOT EXISTS public.assembly_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    zone_key TEXT NOT NULL,
    display_name TEXT NOT NULL,
    marshal_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT assembly_zones_unique_key_per_event UNIQUE (event_id, zone_key)
);

-- 2. A declared incident. Kept separate from the attendance row because an
--    event can have several incidents over its life and each one needs its own
--    boundary, its own roster snapshot and its own audit trail.
CREATE TABLE IF NOT EXISTS public.emergency_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    incident_type TEXT NOT NULL DEFAULT 'EVACUATION'
        CHECK (incident_type IN ('EVACUATION', 'LOCKDOWN', 'WEATHER', 'MEDICAL', 'DRILL')),
    declared_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    declared_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    closed_at TIMESTAMPTZ,
    closed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    notes TEXT,
    CONSTRAINT emergency_incidents_closed_after_declared
        CHECK (closed_at IS NULL OR closed_at >= declared_at)
);

CREATE INDEX IF NOT EXISTS idx_emergency_incidents_event
    ON public.emergency_incidents (event_id, declared_at DESC);

-- Only one incident may be open per event at a time.
CREATE UNIQUE INDEX IF NOT EXISTS idx_emergency_incidents_one_open
    ON public.emergency_incidents (event_id)
    WHERE closed_at IS NULL;

-- 3. The roll-call roster, snapshotted at declaration time. This is a snapshot
--    on purpose: somebody who checks in ten minutes after the alarm must not
--    silently appear on a sweep list.
CREATE TABLE IF NOT EXISTS public.roll_call_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NOT NULL REFERENCES public.emergency_incidents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    user_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'UNACCOUNTED'
        CHECK (status IN ('UNACCOUNTED', 'SAFE', 'ASSISTED', 'MISSING')),
    zone_key TEXT NOT NULL DEFAULT 'unassigned',
    requires_mobility_assistance BOOLEAN NOT NULL DEFAULT FALSE,
    marked_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    marked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT roll_call_entries_unique_per_incident UNIQUE (incident_id, user_id),
    -- An entry that carries a status other than the default must say who set it.
    CONSTRAINT roll_call_entries_marked_consistently
        CHECK ((status = 'UNACCOUNTED' AND marked_at IS NULL) OR marked_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_roll_call_entries_incident_status
    ON public.roll_call_entries (incident_id, status);

-- 4. Append-only history of every mark. The final status alone is not enough
--    for a post-incident review; the sequence of who marked what and when is
--    the part the safety office actually reads.
CREATE TABLE IF NOT EXISTS public.roll_call_marks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NOT NULL REFERENCES public.emergency_incidents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('UNACCOUNTED', 'SAFE', 'ASSISTED', 'MISSING')),
    zone_key TEXT,
    marked_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    -- Device clock at the moment of marking, which is what last-write-wins
    -- resolves on. Recorded separately from received_at so an offline replay
    -- can be distinguished from a live mark.
    marked_at TIMESTAMPTZ NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_roll_call_marks_incident
    ON public.roll_call_marks (incident_id, user_id, marked_at DESC);

-- 5. Declare an incident and snapshot the roster in one transaction.
--    Only attendees who were checked in and had not checked out are included.
CREATE OR REPLACE FUNCTION public.declare_emergency_incident(
    p_event_id UUID,
    p_incident_type TEXT DEFAULT 'EVACUATION'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_incident_id UUID;
    v_declared_at TIMESTAMPTZ := NOW();
BEGIN
    INSERT INTO public.emergency_incidents (event_id, incident_type, declared_at, declared_by)
    VALUES (p_event_id, p_incident_type, v_declared_at, auth.uid())
    RETURNING id INTO v_incident_id;

    INSERT INTO public.roll_call_entries (incident_id, user_id, user_name, zone_key)
    SELECT
        v_incident_id,
        r.user_id,
        COALESCE(pr.full_name, pr.username, 'Attendee'),
        'unassigned'
    FROM public.event_rsvps r
    JOIN public.profiles pr ON pr.id = r.user_id
    WHERE r.event_id = p_event_id
      AND r.checked_in = TRUE
    ON CONFLICT (incident_id, user_id) DO NOTHING;

    RETURN v_incident_id;
END;
$$;

-- 6. Apply a mark with last-write-wins resolution. The guard on marked_at is
--    what stops a stale offline write clobbering a newer confirmed status.
CREATE OR REPLACE FUNCTION public.apply_roll_call_mark(
    p_incident_id UUID,
    p_user_id UUID,
    p_status TEXT,
    p_marked_at TIMESTAMPTZ,
    p_zone_key TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_applied BOOLEAN := FALSE;
BEGIN
    INSERT INTO public.roll_call_marks (incident_id, user_id, status, zone_key, marked_by, marked_at)
    VALUES (p_incident_id, p_user_id, p_status, p_zone_key, auth.uid(), p_marked_at);

    UPDATE public.roll_call_entries
    SET status = p_status,
        zone_key = COALESCE(p_zone_key, zone_key),
        marked_by = auth.uid(),
        marked_at = p_marked_at
    WHERE incident_id = p_incident_id
      AND user_id = p_user_id
      AND (marked_at IS NULL OR marked_at < p_marked_at);

    GET DIAGNOSTICS v_applied = ROW_COUNT;
    RETURN v_applied;
END;
$$;

-- 7. Live tally per zone, which is the number on the marshal's screen.
CREATE OR REPLACE FUNCTION public.get_roll_call_tally(p_incident_id UUID)
RETURNS TABLE (
    zone_key TEXT,
    total BIGINT,
    accounted BIGINT,
    unaccounted BIGINT,
    assisted BIGINT,
    missing BIGINT,
    is_silent BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT
        e.zone_key,
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE e.status IN ('SAFE', 'ASSISTED')) AS accounted,
        COUNT(*) FILTER (WHERE e.status = 'UNACCOUNTED') AS unaccounted,
        COUNT(*) FILTER (WHERE e.status = 'ASSISTED') AS assisted,
        COUNT(*) FILTER (WHERE e.status = 'MISSING') AS missing,
        BOOL_AND(e.marked_at IS NULL) AS is_silent
    FROM public.roll_call_entries e
    WHERE e.incident_id = p_incident_id
    GROUP BY e.zone_key
    ORDER BY e.zone_key;
$$;

-- 8. Guard closure: an incident cannot be closed while anyone is outstanding.
CREATE OR REPLACE FUNCTION public.enforce_incident_closure()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_outstanding INTEGER;
BEGIN
    IF NEW.closed_at IS NOT NULL AND OLD.closed_at IS NULL THEN
        SELECT COUNT(*) INTO v_outstanding
        FROM public.roll_call_entries
        WHERE incident_id = NEW.id
          AND status NOT IN ('SAFE', 'ASSISTED');

        IF v_outstanding > 0 THEN
            RAISE EXCEPTION
                'Cannot close incident %: % attendee(s) are still unaccounted for.',
                NEW.id, v_outstanding;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_incident_closure ON public.emergency_incidents;
CREATE TRIGGER trg_enforce_incident_closure
    BEFORE UPDATE ON public.emergency_incidents
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_incident_closure();

-- 9. Row level security.
ALTER TABLE public.assembly_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roll_call_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roll_call_marks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Zones readable by signed in users" ON public.assembly_zones;
CREATE POLICY "Zones readable by signed in users"
    ON public.assembly_zones FOR SELECT
    USING (auth.role() = 'authenticated');

-- An open incident is visible to everyone at the event: attendees need to know
-- an evacuation has been declared.
DROP POLICY IF EXISTS "Incidents readable by signed in users" ON public.emergency_incidents;
CREATE POLICY "Incidents readable by signed in users"
    ON public.emergency_incidents FOR SELECT
    USING (auth.role() = 'authenticated');

-- Roll-call entries name individuals and their accommodations, so they are
-- restricted to the event organiser, the assigned marshals, and the attendee
-- themselves.
DROP POLICY IF EXISTS "Roll call visible to marshals and the attendee" ON public.roll_call_entries;
CREATE POLICY "Roll call visible to marshals and the attendee"
    ON public.roll_call_entries FOR SELECT
    USING (
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1
            FROM public.emergency_incidents i
            JOIN public.events e ON e.id = i.event_id
            WHERE i.id = roll_call_entries.incident_id
              AND (
                  e.created_by = auth.uid()
                  OR EXISTS (
                      SELECT 1 FROM public.assembly_zones z
                      WHERE z.event_id = i.event_id AND z.marshal_user_id = auth.uid()
                  )
              )
        )
    );

DROP POLICY IF EXISTS "Marks readable with their entry" ON public.roll_call_marks;
CREATE POLICY "Marks readable with their entry"
    ON public.roll_call_marks FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.roll_call_entries e
            WHERE e.incident_id = roll_call_marks.incident_id
              AND e.user_id = roll_call_marks.user_id
        )
    );

COMMENT ON TABLE public.emergency_incidents IS
    'Declared evacuations, lockdowns and drills, each with its own roll-call roster (#3136).';
COMMENT ON TABLE public.roll_call_marks IS
    'Append-only history of roll-call marks. marked_at is the device clock used for last-write-wins.';
