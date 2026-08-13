-- Migration: 20260904000000_hackathon_judging_assignments.sql
-- Description: Issue #3135 - Hackathon Judging Assignment Engine with Conflict-of-Interest Avoidance

-- 1. Projects entered into a hackathon bracket.
CREATE TABLE IF NOT EXISTS public.hackathon_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    topic_tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    -- Clubs the team is entered under; drives SAME_CLUB conflict detection.
    club_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
    slot_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT hackathon_projects_name_unique_per_event UNIQUE (event_id, name)
);

CREATE INDEX IF NOT EXISTS idx_hackathon_projects_event
    ON public.hackathon_projects (event_id);

-- 2. Team rosters. A judge appearing here can never assess the project.
CREATE TABLE IF NOT EXISTS public.hackathon_project_members (
    project_id UUID NOT NULL REFERENCES public.hackathon_projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (project_id, user_id)
);

-- 3. Judges registered for an event, with the expertise and availability the
--    allocation engine reads.
CREATE TABLE IF NOT EXISTS public.hackathon_judges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    expertise_tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    club_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
    -- Empty array means available for every slot.
    available_slot_ids TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    is_external BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT hackathon_judges_unique_per_event UNIQUE (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_hackathon_judges_event
    ON public.hackathon_judges (event_id);

-- 4. Declared conflicts of interest. Every blocked pairing records why, so an
--    organiser can show their working if a result is challenged.
CREATE TABLE IF NOT EXISTS public.judge_conflicts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    judge_id UUID NOT NULL REFERENCES public.hackathon_judges(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.hackathon_projects(id) ON DELETE CASCADE,
    reason TEXT NOT NULL CHECK (reason IN ('SAME_TEAM', 'SAME_CLUB', 'MENTOR', 'SELF_DECLARED')),
    detail TEXT,
    declared_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT judge_conflicts_unique UNIQUE (judge_id, project_id, reason)
);

CREATE INDEX IF NOT EXISTS idx_judge_conflicts_project
    ON public.judge_conflicts (project_id);

-- 5. The resulting allocation matrix.
CREATE TABLE IF NOT EXISTS public.judging_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.hackathon_projects(id) ON DELETE CASCADE,
    judge_id UUID NOT NULL REFERENCES public.hackathon_judges(id) ON DELETE CASCADE,
    slot_id TEXT NOT NULL,
    expertise_overlap INTEGER NOT NULL DEFAULT 0 CHECK (expertise_overlap >= 0),
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT judging_assignments_unique_pair UNIQUE (project_id, judge_id),
    -- A judge cannot hold two assignments in the same time slot. Enforced in
    -- the database as well as the engine, because the allocation can also be
    -- adjusted by hand from the organiser UI.
    CONSTRAINT judging_assignments_one_per_slot UNIQUE (judge_id, slot_id)
);

CREATE INDEX IF NOT EXISTS idx_judging_assignments_event
    ON public.judging_assignments (event_id);

CREATE INDEX IF NOT EXISTS idx_judging_assignments_judge
    ON public.judging_assignments (judge_id);

-- 6. Eligible judges for a project. Mirrors detectConflicts() in
--    src/lib/judgeAssignment.ts: team membership, shared club affiliation,
--    mentorship and self-declared recusals all remove a judge.
CREATE OR REPLACE FUNCTION public.get_eligible_judges_for_project(p_project_id UUID)
RETURNS TABLE (
    judge_id UUID,
    user_id UUID,
    expertise_tags TEXT[],
    expertise_overlap INTEGER
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    WITH target AS (
        SELECT id, event_id, topic_tags, club_ids, slot_id
        FROM public.hackathon_projects
        WHERE id = p_project_id
    )
    SELECT
        j.id AS judge_id,
        j.user_id,
        j.expertise_tags,
        (
            SELECT COUNT(*)::INTEGER
            FROM UNNEST(j.expertise_tags) AS jt
            WHERE LOWER(TRIM(jt)) IN (
                SELECT LOWER(TRIM(pt)) FROM UNNEST(t.topic_tags) AS pt
            )
        ) AS expertise_overlap
    FROM public.hackathon_judges j
    CROSS JOIN target t
    WHERE j.event_id = t.event_id
      -- Not on the team.
      AND NOT EXISTS (
          SELECT 1 FROM public.hackathon_project_members m
          WHERE m.project_id = t.id AND m.user_id = j.user_id
      )
      -- No shared club affiliation.
      AND NOT (j.club_ids && t.club_ids)
      -- No recorded mentorship or self-declared recusal.
      AND NOT EXISTS (
          SELECT 1 FROM public.judge_conflicts c
          WHERE c.judge_id = j.id AND c.project_id = t.id
      )
      -- Available for the project's slot.
      AND (
          CARDINALITY(j.available_slot_ids) = 0
          OR t.slot_id = ANY (j.available_slot_ids)
      )
    ORDER BY expertise_overlap DESC, j.id ASC;
$$;

-- 7. Coverage report: which projects fall short of the required judge count.
CREATE OR REPLACE FUNCTION public.get_judging_coverage(p_event_id UUID, p_required INTEGER DEFAULT 2)
RETURNS TABLE (
    project_id UUID,
    project_name TEXT,
    assigned_count BIGINT,
    required_count INTEGER,
    is_covered BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT
        p.id AS project_id,
        p.name AS project_name,
        COUNT(a.id) AS assigned_count,
        p_required AS required_count,
        COUNT(a.id) >= p_required AS is_covered
    FROM public.hackathon_projects p
    LEFT JOIN public.judging_assignments a ON a.project_id = p.id
    WHERE p.event_id = p_event_id
    GROUP BY p.id, p.name
    ORDER BY assigned_count ASC, p.name ASC;
$$;

-- 8. Row level security.
ALTER TABLE public.hackathon_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hackathon_project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hackathon_judges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.judge_conflicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.judging_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Bracket is readable by signed in users" ON public.hackathon_projects;
CREATE POLICY "Bracket is readable by signed in users"
    ON public.hackathon_projects FOR SELECT
    USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Rosters are readable by signed in users" ON public.hackathon_project_members;
CREATE POLICY "Rosters are readable by signed in users"
    ON public.hackathon_project_members FOR SELECT
    USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Judge list is readable by signed in users" ON public.hackathon_judges;
CREATE POLICY "Judge list is readable by signed in users"
    ON public.hackathon_judges FOR SELECT
    USING (auth.role() = 'authenticated');

-- Conflicts are only visible to organisers and to the judge they concern. A
-- judge's recusal can be personal, so it is not published to the whole event.
DROP POLICY IF EXISTS "Conflicts visible to organisers and the judge" ON public.judge_conflicts;
CREATE POLICY "Conflicts visible to organisers and the judge"
    ON public.judge_conflicts FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM public.hackathon_judges j
            JOIN public.events e ON e.id = j.event_id
            WHERE j.id = judge_conflicts.judge_id
              AND (j.user_id = auth.uid() OR e.created_by = auth.uid())
        )
    );

-- A judge may always declare their own recusal.
DROP POLICY IF EXISTS "Judges may declare their own recusal" ON public.judge_conflicts;
CREATE POLICY "Judges may declare their own recusal"
    ON public.judge_conflicts FOR INSERT
    WITH CHECK (
        reason = 'SELF_DECLARED'
        AND EXISTS (
            SELECT 1 FROM public.hackathon_judges j
            WHERE j.id = judge_conflicts.judge_id AND j.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Assignments readable by signed in users" ON public.judging_assignments;
CREATE POLICY "Assignments readable by signed in users"
    ON public.judging_assignments FOR SELECT
    USING (auth.role() = 'authenticated');

COMMENT ON TABLE public.judge_conflicts IS
    'Audit trail of every judge/project pairing blocked by a conflict of interest (#3135).';
COMMENT ON CONSTRAINT judging_assignments_one_per_slot ON public.judging_assignments IS
    'A judge cannot hold two assignments in the same time slot.';
