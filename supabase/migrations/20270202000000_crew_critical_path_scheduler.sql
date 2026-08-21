-- ============================================================
-- Migration: 20270202000000_crew_critical_path_scheduler.sql
-- Issue: #3752 — Interactive Event Setup/Teardown Critical Path
--                Scheduler
--
-- Context
--   Setup and teardown are dependency graphs, not checklists. A
--   spreadsheet cannot express "the truss cannot fly until the floor
--   is marked", so crews discover ordering constraints by colliding
--   with them on the day.
--
-- Design notes
--   1. `crew_tasks` are nodes, `crew_task_dependencies` are
--      finish-to-start edges. Durations are stored in minutes; the
--      scheduler works in minutes-from-crew-call so nothing in the
--      maths has to reason about time zones.
--   2. Cycles make the schedule unsolvable. A trigger rejects any
--      edge that would close a loop *at insert time*, so a bad edge
--      can never reach the scheduler. The client-side detector in
--      src/lib/crewCriticalPath.ts is the second line of defence for
--      graphs assembled optimistically in the browser.
--   3. `crew_phases` carries the two anchors CPM needs: when the crew
--      is called, and the hard deadline (doors open). Slack is
--      meaningless without the latter.
--   4. Actual start/finish are recorded on the task so the projection
--      can be recomputed against reality, not just the plan.
-- ============================================================

BEGIN;

-- ─── 1. Enums ───────────────────────────────────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'crew_phase') THEN
        CREATE TYPE public.crew_phase AS ENUM ('setup', 'teardown');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'crew_task_status') THEN
        CREATE TYPE public.crew_task_status AS ENUM (
            'pending',
            'in_progress',
            'complete',
            'blocked',
            'skipped'
        );
    END IF;
END$$;

-- ─── 2. Phase anchors ───────────────────────────────────────────────
-- One row per (event, phase). `deadline_at` is the moment that must
-- not slip — doors open for setup, venue handback for teardown.
CREATE TABLE IF NOT EXISTS public.crew_phases (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id       UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    phase          public.crew_phase NOT NULL,
    crew_call_at   TIMESTAMPTZ NOT NULL,
    deadline_at    TIMESTAMPTZ NOT NULL,
    crew_available INTEGER NOT NULL DEFAULT 8,
    -- Slack at or below which a task is "near critical" — one slip away
    -- from determining the open time.
    near_critical_threshold_minutes INTEGER NOT NULL DEFAULT 15,
    created_by     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT crew_phases_unique UNIQUE (event_id, phase),
    CONSTRAINT crew_phases_window_positive CHECK (deadline_at > crew_call_at),
    CONSTRAINT crew_phases_crew_nonneg CHECK (crew_available >= 0),
    CONSTRAINT crew_phases_threshold_nonneg
        CHECK (near_critical_threshold_minutes >= 0)
);

COMMENT ON TABLE public.crew_phases IS
    'Issue #3752 — CPM anchors: crew call time and the hard deadline per event phase.';

-- ─── 3. Tasks ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.crew_tasks (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phase_id         UUID NOT NULL REFERENCES public.crew_phases(id) ON DELETE CASCADE,
    title            TEXT NOT NULL,
    description      TEXT,
    duration_minutes INTEGER NOT NULL,
    -- How many crew this task occupies while it runs. Two concurrent
    -- tasks each demanding the whole crew is a resource conflict even
    -- when the dependency graph is perfectly satisfied.
    crew_size        INTEGER NOT NULL DEFAULT 1,
    status           public.crew_task_status NOT NULL DEFAULT 'pending',
    assigned_crew    TEXT,
    assigned_lead    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    -- Reality, as opposed to the plan. Recomputing the projection
    -- against these is what makes the board useful mid-setup.
    actual_start_at  TIMESTAMPTZ,
    actual_finish_at TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT crew_tasks_duration_nonneg CHECK (duration_minutes >= 0),
    CONSTRAINT crew_tasks_crew_nonneg CHECK (crew_size >= 0),
    CONSTRAINT crew_tasks_title_not_blank CHECK (LENGTH(TRIM(title)) > 0),
    CONSTRAINT crew_tasks_actuals_ordered
        CHECK (actual_finish_at IS NULL
               OR actual_start_at IS NULL
               OR actual_finish_at >= actual_start_at)
);

CREATE INDEX IF NOT EXISTS idx_crew_tasks_phase
    ON public.crew_tasks (phase_id);
CREATE INDEX IF NOT EXISTS idx_crew_tasks_status
    ON public.crew_tasks (phase_id, status);

-- ─── 4. Dependencies (finish-to-start edges) ────────────────────────
CREATE TABLE IF NOT EXISTS public.crew_task_dependencies (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id       UUID NOT NULL REFERENCES public.crew_tasks(id) ON DELETE CASCADE,
    depends_on_id UUID NOT NULL REFERENCES public.crew_tasks(id) ON DELETE CASCADE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT crew_task_deps_unique UNIQUE (task_id, depends_on_id),
    -- The trivial cycle, caught cheaply without walking the graph.
    CONSTRAINT crew_task_deps_no_self CHECK (task_id <> depends_on_id)
);

CREATE INDEX IF NOT EXISTS idx_crew_task_deps_task
    ON public.crew_task_dependencies (task_id);
CREATE INDEX IF NOT EXISTS idx_crew_task_deps_depends_on
    ON public.crew_task_dependencies (depends_on_id);

-- ─── 5. Cycle rejection ─────────────────────────────────────────────
-- Refuses any edge that would make the graph unschedulable. We walk
-- forward from the proposed prerequisite: if the task we are adding
-- the dependency *to* is already reachable, the new edge closes a
-- loop. The error names the two tasks, because "your graph has a
-- cycle" is useless to an organiser staring at forty rows.
CREATE OR REPLACE FUNCTION public.reject_crew_dependency_cycle()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_creates_cycle BOOLEAN;
    v_task_title    TEXT;
    v_dep_title     TEXT;
BEGIN
    -- Cross-phase edges would let one phase's schedule depend on
    -- another's, which the scheduler does not model.
    IF (SELECT phase_id FROM public.crew_tasks WHERE id = NEW.task_id)
       IS DISTINCT FROM
       (SELECT phase_id FROM public.crew_tasks WHERE id = NEW.depends_on_id) THEN
        RAISE EXCEPTION
            'Crew task dependencies must stay within a single phase';
    END IF;

    WITH RECURSIVE reachable AS (
        -- Start at the prerequisite and walk to everything it, in turn,
        -- depends on.
        SELECT d.depends_on_id AS node
        FROM public.crew_task_dependencies d
        WHERE d.task_id = NEW.depends_on_id

        UNION

        SELECT d.depends_on_id
        FROM public.crew_task_dependencies d
        JOIN reachable r ON d.task_id = r.node
    )
    SELECT EXISTS (SELECT 1 FROM reachable WHERE node = NEW.task_id)
    INTO v_creates_cycle;

    IF v_creates_cycle THEN
        SELECT title INTO v_task_title FROM public.crew_tasks WHERE id = NEW.task_id;
        SELECT title INTO v_dep_title FROM public.crew_tasks WHERE id = NEW.depends_on_id;
        RAISE EXCEPTION
            'Cannot make "%" depend on "%": that would create a dependency loop',
            COALESCE(v_task_title, NEW.task_id::TEXT),
            COALESCE(v_dep_title, NEW.depends_on_id::TEXT);
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_crew_dependency_cycle ON public.crew_task_dependencies;
CREATE TRIGGER trg_crew_dependency_cycle
    BEFORE INSERT OR UPDATE ON public.crew_task_dependencies
    FOR EACH ROW EXECUTE FUNCTION public.reject_crew_dependency_cycle();

-- ─── 6. updated_at maintenance ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.touch_crew_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_crew_tasks_touch ON public.crew_tasks;
CREATE TRIGGER trg_crew_tasks_touch
    BEFORE UPDATE ON public.crew_tasks
    FOR EACH ROW EXECUTE FUNCTION public.touch_crew_updated_at();

DROP TRIGGER IF EXISTS trg_crew_phases_touch ON public.crew_phases;
CREATE TRIGGER trg_crew_phases_touch
    BEFORE UPDATE ON public.crew_phases
    FOR EACH ROW EXECUTE FUNCTION public.touch_crew_updated_at();

-- ─── 7. Access predicates ───────────────────────────────────────────
-- Anyone approved in the owning club can *see* the run sheet — crew
-- members need it on their phones. Only officers can restructure it.
CREATE OR REPLACE FUNCTION public.can_view_crew_phase(p_phase_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.crew_phases p
        JOIN public.events e ON e.id = p.event_id
        JOIN public.club_members cm ON cm.club_id = e.club_id
        WHERE p.id = p_phase_id
          AND cm.user_id = p_user_id
          AND cm.status::TEXT = 'approved'
    );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_crew_phase(p_phase_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.crew_phases p
        JOIN public.events e ON e.id = p.event_id
        JOIN public.club_members cm ON cm.club_id = e.club_id
        WHERE p.id = p_phase_id
          AND cm.user_id = p_user_id
          AND cm.status::TEXT = 'approved'
          -- Cast to TEXT: the member_role enum differs across
          -- deployments, and comparing against a literal the local
          -- enum lacks raises rather than returning false.
          AND cm.role::TEXT IN ('owner', 'admin', 'officer')
    );
$$;

-- ─── 8. Run sheet RPC ───────────────────────────────────────────────
-- Returns the phase's tasks with their dependency lists and minutes-
-- from-crew-call actuals, ready for the CPM pass in
-- src/lib/crewCriticalPath.ts. The scheduling maths deliberately does
-- NOT live here: the Gantt view re-runs it locally on every drag, and
-- a round trip per interaction would make the UI unusable.
CREATE OR REPLACE FUNCTION public.get_crew_run_sheet(p_phase_id UUID)
RETURNS TABLE (
    task_id                UUID,
    title                  TEXT,
    description            TEXT,
    duration_minutes       INTEGER,
    crew_size              INTEGER,
    status                 TEXT,
    assigned_crew          TEXT,
    depends_on             UUID[],
    actual_start_minutes   NUMERIC,
    actual_finish_minutes  NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_call_at TIMESTAMPTZ;
BEGIN
    IF NOT public.can_view_crew_phase(p_phase_id, auth.uid()) THEN
        RAISE EXCEPTION 'Not authorised to view this crew run sheet';
    END IF;

    SELECT p.crew_call_at INTO v_call_at
    FROM public.crew_phases p WHERE p.id = p_phase_id;

    RETURN QUERY
    SELECT
        t.id,
        t.title,
        t.description,
        t.duration_minutes,
        t.crew_size,
        t.status::TEXT,
        t.assigned_crew,
        COALESCE(
            ARRAY(
                SELECT d.depends_on_id
                FROM public.crew_task_dependencies d
                WHERE d.task_id = t.id
                ORDER BY d.depends_on_id
            ),
            ARRAY[]::UUID[]
        ),
        CASE WHEN t.actual_start_at IS NULL THEN NULL
             ELSE ROUND(EXTRACT(EPOCH FROM (t.actual_start_at - v_call_at)) / 60.0, 2)
        END,
        CASE WHEN t.actual_finish_at IS NULL THEN NULL
             ELSE ROUND(EXTRACT(EPOCH FROM (t.actual_finish_at - v_call_at)) / 60.0, 2)
        END
    FROM public.crew_tasks t
    WHERE t.phase_id = p_phase_id
    ORDER BY t.created_at;
END;
$$;

-- ─── 9. Task progress RPC ───────────────────────────────────────────
-- Records a start/finish against a task. Kept as an RPC rather than a
-- bare UPDATE so the timestamp is always server-side — a crew phone
-- with a skewed clock would otherwise poison the whole projection.
CREATE OR REPLACE FUNCTION public.report_crew_task_progress(
    p_task_id UUID,
    p_status  TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_phase_id UUID;
BEGIN
    SELECT phase_id INTO v_phase_id FROM public.crew_tasks WHERE id = p_task_id;
    IF v_phase_id IS NULL THEN
        RAISE EXCEPTION 'Crew task % not found', p_task_id;
    END IF;

    -- Any approved club member on the crew can tick a task off; that is
    -- the point of a run sheet on a phone.
    IF NOT public.can_view_crew_phase(v_phase_id, auth.uid()) THEN
        RAISE EXCEPTION 'Not authorised to update this crew task';
    END IF;

    IF p_status = 'in_progress' THEN
        UPDATE public.crew_tasks
        SET status = 'in_progress',
            actual_start_at = COALESCE(actual_start_at, NOW())
        WHERE id = p_task_id;
    ELSIF p_status = 'complete' THEN
        UPDATE public.crew_tasks
        SET status = 'complete',
            actual_start_at = COALESCE(actual_start_at, NOW()),
            actual_finish_at = NOW()
        WHERE id = p_task_id;
    ELSIF p_status IN ('pending', 'blocked', 'skipped') THEN
        UPDATE public.crew_tasks
        SET status = p_status::public.crew_task_status
        WHERE id = p_task_id;
    ELSE
        RAISE EXCEPTION 'Unknown crew task status: %', p_status;
    END IF;
END;
$$;

-- ─── 10. Row Level Security ─────────────────────────────────────────
ALTER TABLE public.crew_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crew_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crew_task_dependencies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members read crew phases" ON public.crew_phases;
CREATE POLICY "Members read crew phases"
    ON public.crew_phases FOR SELECT
    USING (public.can_view_crew_phase(id, auth.uid()));

DROP POLICY IF EXISTS "Officers manage crew phases" ON public.crew_phases;
CREATE POLICY "Officers manage crew phases"
    ON public.crew_phases FOR ALL
    USING (public.can_manage_crew_phase(id, auth.uid()))
    WITH CHECK (public.can_manage_crew_phase(id, auth.uid()));

DROP POLICY IF EXISTS "Members read crew tasks" ON public.crew_tasks;
CREATE POLICY "Members read crew tasks"
    ON public.crew_tasks FOR SELECT
    USING (public.can_view_crew_phase(phase_id, auth.uid()));

DROP POLICY IF EXISTS "Officers manage crew tasks" ON public.crew_tasks;
CREATE POLICY "Officers manage crew tasks"
    ON public.crew_tasks FOR ALL
    USING (public.can_manage_crew_phase(phase_id, auth.uid()))
    WITH CHECK (public.can_manage_crew_phase(phase_id, auth.uid()));

DROP POLICY IF EXISTS "Members read crew dependencies" ON public.crew_task_dependencies;
CREATE POLICY "Members read crew dependencies"
    ON public.crew_task_dependencies FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.crew_tasks t
            WHERE t.id = task_id
              AND public.can_view_crew_phase(t.phase_id, auth.uid())
        )
    );

DROP POLICY IF EXISTS "Officers manage crew dependencies" ON public.crew_task_dependencies;
CREATE POLICY "Officers manage crew dependencies"
    ON public.crew_task_dependencies FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.crew_tasks t
            WHERE t.id = task_id
              AND public.can_manage_crew_phase(t.phase_id, auth.uid())
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.crew_tasks t
            WHERE t.id = task_id
              AND public.can_manage_crew_phase(t.phase_id, auth.uid())
        )
    );

-- ─── 11. Grants ─────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crew_phases TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crew_tasks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crew_task_dependencies TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_crew_run_sheet(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_crew_task_progress(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_crew_phase(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_crew_phase(UUID, UUID) TO authenticated;

COMMIT;
