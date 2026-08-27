-- =============================================================================
-- Migration: Club Meeting Quorum & Proxy Delegation
-- Description: Adds meeting records, per-member attendance and proxy
--              delegations so that quorum can be computed from data rather
--              than counted by hand at the start of every meeting.
-- =============================================================================

-- 1. Meetings ----------------------------------------------------------------

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'quorum_rule_type') THEN
        CREATE TYPE public.quorum_rule_type AS ENUM (
            'simple_majority',
            'percentage',
            'fixed_count'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'meeting_status') THEN
        CREATE TYPE public.meeting_status AS ENUM (
            'scheduled',
            'open',
            'closed',
            'cancelled'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'meeting_attendance_status') THEN
        CREATE TYPE public.meeting_attendance_status AS ENUM (
            'present',
            'absent',
            'excused'
        );
    END IF;
END$$;

CREATE TABLE IF NOT EXISTS public.club_meetings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    agenda TEXT,
    scheduled_for TIMESTAMPTZ NOT NULL,
    status public.meeting_status NOT NULL DEFAULT 'scheduled',
    quorum_rule public.quorum_rule_type NOT NULL DEFAULT 'simple_majority',
    -- Percentage for 'percentage' rules, absolute voting power for 'fixed_count'.
    quorum_threshold NUMERIC(6, 2),
    max_proxies_per_delegate SMALLINT NOT NULL DEFAULT 2,
    max_chain_depth SMALLINT NOT NULL DEFAULT 3,
    count_excused_in_base BOOLEAN NOT NULL DEFAULT TRUE,
    -- Optional per-club tier weights, e.g. {"executive": 3, "general": 1}.
    tier_weights JSONB,
    opened_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT club_meetings_threshold_required CHECK (
        quorum_rule = 'simple_majority' OR quorum_threshold IS NOT NULL
    ),
    CONSTRAINT club_meetings_threshold_positive CHECK (
        quorum_threshold IS NULL OR quorum_threshold >= 0
    ),
    CONSTRAINT club_meetings_percentage_range CHECK (
        quorum_rule <> 'percentage' OR quorum_threshold <= 100
    ),
    CONSTRAINT club_meetings_chain_depth CHECK (max_chain_depth BETWEEN 1 AND 10),
    CONSTRAINT club_meetings_proxy_cap CHECK (max_proxies_per_delegate BETWEEN 0 AND 20)
);

CREATE INDEX IF NOT EXISTS idx_club_meetings_club_schedule
    ON public.club_meetings (club_id, scheduled_for DESC);

-- 2. Attendance --------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.meeting_attendance (
    meeting_id UUID NOT NULL REFERENCES public.club_meetings(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status public.meeting_attendance_status NOT NULL DEFAULT 'absent',
    checked_in_at TIMESTAMPTZ,
    recorded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (meeting_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_meeting_attendance_status
    ON public.meeting_attendance (meeting_id, status);

-- 3. Proxy delegations -------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.meeting_proxies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID NOT NULL REFERENCES public.club_meetings(id) ON DELETE CASCADE,
    delegator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    delegate_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    revoked BOOLEAN NOT NULL DEFAULT FALSE,
    revoked_at TIMESTAMPTZ,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- A member may only hand their vote to one person per meeting. Cycles and
    -- delegation caps are resolved in the application layer, which has to walk
    -- the whole chain to decide them.
    CONSTRAINT meeting_proxies_unique_delegator UNIQUE (meeting_id, delegator_id),
    CONSTRAINT meeting_proxies_no_self CHECK (delegator_id <> delegate_id)
);

CREATE INDEX IF NOT EXISTS idx_meeting_proxies_meeting
    ON public.meeting_proxies (meeting_id) WHERE revoked = FALSE;

-- 4. Row level security ------------------------------------------------------

ALTER TABLE public.club_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_proxies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Club members can view meetings" ON public.club_meetings;
CREATE POLICY "Club members can view meetings"
ON public.club_meetings FOR SELECT
USING (public.is_club_member(club_id, auth.uid()));

DROP POLICY IF EXISTS "Club officers manage meetings" ON public.club_meetings;
CREATE POLICY "Club officers manage meetings"
ON public.club_meetings FOR ALL
USING (public.is_club_admin(club_id, auth.uid()))
WITH CHECK (public.is_club_admin(club_id, auth.uid()));

DROP POLICY IF EXISTS "Club members can view attendance" ON public.meeting_attendance;
CREATE POLICY "Club members can view attendance"
ON public.meeting_attendance FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.club_meetings m
        WHERE m.id = meeting_attendance.meeting_id
          AND public.is_club_member(m.club_id, auth.uid())
    )
);

DROP POLICY IF EXISTS "Club officers record attendance" ON public.meeting_attendance;
CREATE POLICY "Club officers record attendance"
ON public.meeting_attendance FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.club_meetings m
        WHERE m.id = meeting_attendance.meeting_id
          AND public.is_club_admin(m.club_id, auth.uid())
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.club_meetings m
        WHERE m.id = meeting_attendance.meeting_id
          AND public.is_club_admin(m.club_id, auth.uid())
    )
);

DROP POLICY IF EXISTS "Club members can view proxies" ON public.meeting_proxies;
CREATE POLICY "Club members can view proxies"
ON public.meeting_proxies FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.club_meetings m
        WHERE m.id = meeting_proxies.meeting_id
          AND public.is_club_member(m.club_id, auth.uid())
    )
);

-- Members grant their own proxy; officers may record one on their behalf when a
-- member submits a paper form.
DROP POLICY IF EXISTS "Members grant their own proxy" ON public.meeting_proxies;
CREATE POLICY "Members grant their own proxy"
ON public.meeting_proxies FOR INSERT
WITH CHECK (
    delegator_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM public.club_meetings m
        WHERE m.id = meeting_proxies.meeting_id
          AND public.is_club_admin(m.club_id, auth.uid())
    )
);

DROP POLICY IF EXISTS "Members revoke their own proxy" ON public.meeting_proxies;
CREATE POLICY "Members revoke their own proxy"
ON public.meeting_proxies FOR UPDATE
USING (
    delegator_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM public.club_meetings m
        WHERE m.id = meeting_proxies.meeting_id
          AND public.is_club_admin(m.club_id, auth.uid())
    )
);

-- 5. Opening a meeting freezes the roll --------------------------------------
--
-- Attendance rows are created for every approved member the moment the meeting
-- opens, so that "absent" is an explicit record rather than a missing one.
CREATE OR REPLACE FUNCTION public.open_club_meeting(p_meeting_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_club_id UUID;
BEGIN
    SELECT club_id INTO v_club_id FROM public.club_meetings WHERE id = p_meeting_id;

    IF v_club_id IS NULL THEN
        RAISE EXCEPTION 'Meeting % does not exist', p_meeting_id;
    END IF;

    IF NOT public.is_club_admin(v_club_id, auth.uid()) THEN
        RAISE EXCEPTION 'Only club officers may open a meeting';
    END IF;

    INSERT INTO public.meeting_attendance (meeting_id, user_id, status)
    SELECT p_meeting_id, cm.user_id, 'absent'::public.meeting_attendance_status
    FROM public.club_members cm
    WHERE cm.club_id = v_club_id
      AND cm.status = 'approved'
    ON CONFLICT (meeting_id, user_id) DO NOTHING;

    UPDATE public.club_meetings
    SET status = 'open', opened_at = COALESCE(opened_at, NOW())
    WHERE id = p_meeting_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.open_club_meeting(UUID) TO authenticated;

-- 6. Realtime ----------------------------------------------------------------

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.meeting_attendance;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_object THEN NULL;
END$$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.meeting_proxies;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_object THEN NULL;
END$$;
