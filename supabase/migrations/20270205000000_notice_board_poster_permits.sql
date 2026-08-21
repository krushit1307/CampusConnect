-- ============================================================
-- Migration: 20270205000000_notice_board_poster_permits.sql
-- Issue: #3755 — Interactive Campus Notice Board Poster Permit &
--                Takedown System
--
-- Context
--   Campus notice boards are a finite, contested resource managed by
--   nobody. Two clubs claim the same space for the same week and
--   settle it by stapling over each other; dead posters are never
--   removed because removal has no owner; facilities' only tool is a
--   periodic purge that destroys live postings alongside expired ones.
--
-- Design notes
--   1. A board has a `slot_capacity` — the number of posters that
--      physically fit. Permits are intervals booked against it.
--   2. `starts_on` and `ends_on` are BOTH INCLUSIVE. A permit running
--      5–12 June occupies a slot on the 12th, so a permit ending on
--      the 12th and one starting on the 12th genuinely conflict —
--      both posters are on the board that day. The exclusion
--      constraint below uses `daterange(starts_on, ends_on, '[]')` to
--      express exactly that.
--   3. Capacity is per-day, not per-permit, so the grant decision is
--      "does every day in this range have room?" — a question the
--      client mirrors in src/lib/noticeBoardPermits.ts so a requester
--      gets an answer (and an alternative date) before submitting.
--   4. Every approved permit carries an expiry and a takedown owner.
--      A poster with no owner is a poster nobody removes.
-- ============================================================

BEGIN;

-- btree_gist lets an EXCLUDE constraint mix equality (board_id) with
-- range overlap (the date range) in a single index.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ─── 1. Enums ───────────────────────────────────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'poster_permit_status') THEN
        CREATE TYPE public.poster_permit_status AS ENUM (
            'pending',
            'approved',
            'rejected',
            'withdrawn',
            'taken_down'
        );
    END IF;
END$$;

-- ─── 2. Boards ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notice_boards (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    building        TEXT NOT NULL,
    location_detail TEXT,
    -- The physical constraint this whole feature exists to respect.
    slot_capacity   INTEGER NOT NULL DEFAULT 6,
    managed_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    requires_approval BOOLEAN NOT NULL DEFAULT TRUE,
    -- Policy knobs, per board: a high-traffic canteen board needs a
    -- tighter maximum duration than a departmental corridor.
    max_duration_days       INTEGER NOT NULL DEFAULT 21,
    max_concurrent_per_club INTEGER NOT NULL DEFAULT 2,
    takedown_reminder_days  INTEGER NOT NULL DEFAULT 2,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT notice_boards_capacity_positive CHECK (slot_capacity >= 1),
    CONSTRAINT notice_boards_name_not_blank CHECK (LENGTH(TRIM(name)) > 0),
    CONSTRAINT notice_boards_duration_positive CHECK (max_duration_days >= 1),
    CONSTRAINT notice_boards_concurrent_positive
        CHECK (max_concurrent_per_club >= 1),
    CONSTRAINT notice_boards_reminder_nonneg
        CHECK (takedown_reminder_days >= 0)
);

COMMENT ON COLUMN public.notice_boards.slot_capacity IS
    'How many posters physically fit. Permits are booked as intervals against this.';

CREATE INDEX IF NOT EXISTS idx_notice_boards_building
    ON public.notice_boards (building, is_active);

-- ─── 3. Permits ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.poster_permits (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    board_id       UUID NOT NULL REFERENCES public.notice_boards(id) ON DELETE CASCADE,
    club_id        UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    requested_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    title          TEXT NOT NULL,
    description    TEXT,
    -- Both inclusive. See the design note at the top of this file.
    starts_on      DATE NOT NULL,
    ends_on        DATE NOT NULL,
    slots_requested INTEGER NOT NULL DEFAULT 1,
    status         public.poster_permit_status NOT NULL DEFAULT 'pending',
    approved_by    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    approved_at    TIMESTAMPTZ,
    rejection_reason TEXT,
    -- Removal needs a named owner or it does not happen.
    takedown_owner UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    taken_down_at  TIMESTAMPTZ,
    taken_down_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT poster_permits_dates_ordered CHECK (ends_on >= starts_on),
    CONSTRAINT poster_permits_slots_positive CHECK (slots_requested >= 1),
    CONSTRAINT poster_permits_title_not_blank CHECK (LENGTH(TRIM(title)) > 0),
    -- A rejection without a reason gives the requesting club nothing
    -- to act on.
    CONSTRAINT poster_permits_rejection_has_reason
        CHECK (status <> 'rejected'
               OR LENGTH(TRIM(COALESCE(rejection_reason, ''))) > 0),
    CONSTRAINT poster_permits_approved_has_approver
        CHECK (status <> 'approved' OR approved_by IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_poster_permits_board_dates
    ON public.poster_permits (board_id, starts_on, ends_on);
CREATE INDEX IF NOT EXISTS idx_poster_permits_club
    ON public.poster_permits (club_id, status);
-- Drives the overdue-takedown sweep.
CREATE INDEX IF NOT EXISTS idx_poster_permits_expiry
    ON public.poster_permits (ends_on)
    WHERE status = 'approved' AND taken_down_at IS NULL;

-- ─── 4. Capacity enforcement ────────────────────────────────────────
-- The exclusion constraint alone cannot express "at most N overlapping
-- permits" — it only expresses "no two overlap". A single-slot board
-- is the special case where they coincide, so capacity is enforced by
-- a trigger that checks every day in the requested range.
--
-- `daterange(starts_on, ends_on, '[]')` makes both bounds inclusive,
-- so a permit ending on the 12th and one starting on the 12th are
-- correctly seen as overlapping.
CREATE OR REPLACE FUNCTION public.enforce_poster_permit_capacity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_capacity     INTEGER;
    v_max_days     INTEGER;
    v_max_club     INTEGER;
    v_is_active    BOOLEAN;
    v_board_name   TEXT;
    v_worst_day    DATE;
    v_worst_usage  INTEGER;
    v_club_count   INTEGER;
    v_duration     INTEGER;
BEGIN
    -- Only approved permits occupy the board. A pending request may sit
    -- against a full board; it simply cannot be approved.
    IF NEW.status <> 'approved' THEN
        RETURN NEW;
    END IF;

    SELECT b.slot_capacity, b.max_duration_days, b.max_concurrent_per_club,
           b.is_active, b.name
    INTO v_capacity, v_max_days, v_max_club, v_is_active, v_board_name
    FROM public.notice_boards b
    WHERE b.id = NEW.board_id;

    IF v_capacity IS NULL THEN
        RAISE EXCEPTION 'Notice board % not found', NEW.board_id;
    END IF;

    IF NOT v_is_active THEN
        RAISE EXCEPTION '% is not currently accepting postings', v_board_name;
    END IF;

    IF NEW.slots_requested > v_capacity THEN
        RAISE EXCEPTION
            '% has only % slot(s); % were requested',
            v_board_name, v_capacity, NEW.slots_requested;
    END IF;

    v_duration := (NEW.ends_on - NEW.starts_on) + 1;
    IF v_duration > v_max_days THEN
        RAISE EXCEPTION
            'Permits on % may run for at most % days; this one runs %',
            v_board_name, v_max_days, v_duration;
    END IF;

    -- Per-club concurrency cap across overlapping approved permits.
    SELECT COUNT(*)
    INTO v_club_count
    FROM public.poster_permits p
    WHERE p.board_id = NEW.board_id
      AND p.club_id = NEW.club_id
      AND p.id <> NEW.id
      AND p.status = 'approved'
      AND p.taken_down_at IS NULL
      AND DATERANGE(p.starts_on, p.ends_on, '[]')
          && DATERANGE(NEW.starts_on, NEW.ends_on, '[]');

    IF v_club_count >= v_max_club THEN
        RAISE EXCEPTION
            'This club already holds % overlapping permit(s) on %; the limit is %',
            v_club_count, v_board_name, v_max_club;
    END IF;

    -- The capacity check proper: walk every day in the range and find
    -- the worst one. Reporting the specific date is what lets the
    -- requester pick a different week rather than guess.
    SELECT d.day, SUM(p.slots_requested)::INTEGER + NEW.slots_requested
    INTO v_worst_day, v_worst_usage
    FROM GENERATE_SERIES(NEW.starts_on, NEW.ends_on, INTERVAL '1 day') AS d(day)
    LEFT JOIN public.poster_permits p
           ON p.board_id = NEW.board_id
          AND p.id <> NEW.id
          AND p.status = 'approved'
          AND p.taken_down_at IS NULL
          AND d.day BETWEEN p.starts_on AND p.ends_on
    GROUP BY d.day
    HAVING COALESCE(SUM(p.slots_requested), 0) + NEW.slots_requested > v_capacity
    ORDER BY SUM(p.slots_requested) DESC
    LIMIT 1;

    IF v_worst_day IS NOT NULL THEN
        RAISE EXCEPTION
            '% is full on % (% of % slots needed)',
            v_board_name, v_worst_day, v_worst_usage, v_capacity;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_poster_permit_capacity ON public.poster_permits;
CREATE TRIGGER trg_poster_permit_capacity
    BEFORE INSERT OR UPDATE ON public.poster_permits
    FOR EACH ROW EXECUTE FUNCTION public.enforce_poster_permit_capacity();

-- ─── 5. Takedown bookkeeping ────────────────────────────────────────
-- Recording a takedown must also close the permit out, or the board
-- keeps showing the slot as occupied.
CREATE OR REPLACE FUNCTION public.sync_poster_permit_takedown()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := NOW();

    IF NEW.taken_down_at IS NOT NULL AND OLD.taken_down_at IS NULL THEN
        NEW.status := 'taken_down';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_poster_permit_takedown ON public.poster_permits;
CREATE TRIGGER trg_poster_permit_takedown
    BEFORE UPDATE ON public.poster_permits
    FOR EACH ROW EXECUTE FUNCTION public.sync_poster_permit_takedown();

CREATE OR REPLACE FUNCTION public.touch_notice_board_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notice_boards_touch ON public.notice_boards;
CREATE TRIGGER trg_notice_boards_touch
    BEFORE UPDATE ON public.notice_boards
    FOR EACH ROW EXECUTE FUNCTION public.touch_notice_board_updated_at();

-- ─── 6. Access predicates ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_board_manager(p_board_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.notice_boards b
        WHERE b.id = p_board_id AND b.managed_by = p_user_id
    );
$$;

CREATE OR REPLACE FUNCTION public.is_club_officer(p_club_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.club_members cm
        WHERE cm.club_id = p_club_id
          AND cm.user_id = p_user_id
          AND cm.status::TEXT = 'approved'
          -- Cast to TEXT: the member_role enum differs across
          -- deployments, and an enum-literal comparison against a
          -- value the local enum lacks raises rather than returning
          -- false.
          AND cm.role::TEXT IN ('owner', 'admin', 'officer')
    );
$$;

-- ─── 7. Occupancy RPC ───────────────────────────────────────────────
-- Day-by-day occupancy for a board, so managers can see exactly what
-- is authorised to be up on any given date — and so a purge removes
-- only what is genuinely expired.
CREATE OR REPLACE FUNCTION public.get_board_occupancy(
    p_board_id UUID,
    p_from     DATE,
    p_to       DATE
)
RETURNS TABLE (
    day         DATE,
    slots_used  INTEGER,
    capacity    INTEGER,
    permit_ids  UUID[]
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_capacity INTEGER;
BEGIN
    SELECT b.slot_capacity INTO v_capacity
    FROM public.notice_boards b WHERE b.id = p_board_id;

    IF v_capacity IS NULL THEN
        RAISE EXCEPTION 'Notice board % not found', p_board_id;
    END IF;

    IF p_to < p_from THEN
        RAISE EXCEPTION 'Date range ends before it begins';
    END IF;

    RETURN QUERY
    SELECT
        d.day::DATE,
        COALESCE(SUM(p.slots_requested), 0)::INTEGER,
        v_capacity,
        COALESCE(ARRAY_AGG(p.id) FILTER (WHERE p.id IS NOT NULL), ARRAY[]::UUID[])
    FROM GENERATE_SERIES(p_from, p_to, INTERVAL '1 day') AS d(day)
    LEFT JOIN public.poster_permits p
           ON p.board_id = p_board_id
          AND p.status = 'approved'
          AND p.taken_down_at IS NULL
          AND d.day BETWEEN p.starts_on AND p.ends_on
    GROUP BY d.day
    ORDER BY d.day;
END;
$$;

-- ─── 8. Overdue takedown RPC ────────────────────────────────────────
-- Posters still up past their permit, attributed to a named owner.
-- This is the list facilities works from instead of stripping a board.
CREATE OR REPLACE FUNCTION public.get_overdue_takedowns(p_board_id UUID DEFAULT NULL)
RETURNS TABLE (
    permit_id      UUID,
    board_id       UUID,
    board_name     TEXT,
    club_id        UUID,
    club_name      TEXT,
    title          TEXT,
    ends_on        DATE,
    days_overdue   INTEGER,
    owner_name     TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        p.id,
        p.board_id,
        b.name,
        p.club_id,
        c.name,
        p.title,
        p.ends_on,
        (CURRENT_DATE - p.ends_on)::INTEGER,
        owner.full_name
    FROM public.poster_permits p
    JOIN public.notice_boards b ON b.id = p.board_id
    JOIN public.clubs c ON c.id = p.club_id
    LEFT JOIN public.profiles owner ON owner.id = p.takedown_owner
    WHERE p.status = 'approved'
      AND p.taken_down_at IS NULL
      AND p.ends_on < CURRENT_DATE
      AND (p_board_id IS NULL OR p.board_id = p_board_id)
    ORDER BY p.ends_on ASC;
$$;

-- ─── 9. Row Level Security ──────────────────────────────────────────
ALTER TABLE public.notice_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poster_permits ENABLE ROW LEVEL SECURITY;

-- Boards themselves are public information — knowing where the notice
-- boards are is not sensitive.
DROP POLICY IF EXISTS "Anyone reads notice boards" ON public.notice_boards;
CREATE POLICY "Anyone reads notice boards"
    ON public.notice_boards FOR SELECT
    USING (TRUE);

DROP POLICY IF EXISTS "Managers maintain notice boards" ON public.notice_boards;
CREATE POLICY "Managers maintain notice boards"
    ON public.notice_boards FOR ALL
    USING (managed_by = auth.uid())
    WITH CHECK (managed_by = auth.uid());

-- Approved permits are public: anyone should be able to see what is
-- authorised to be on a board. Pending and rejected requests are
-- visible only to the requesting club and the board manager.
DROP POLICY IF EXISTS "Anyone reads approved permits" ON public.poster_permits;
CREATE POLICY "Anyone reads approved permits"
    ON public.poster_permits FOR SELECT
    USING (status IN ('approved', 'taken_down'));

DROP POLICY IF EXISTS "Clubs read own permits" ON public.poster_permits;
CREATE POLICY "Clubs read own permits"
    ON public.poster_permits FOR SELECT
    USING (public.is_club_officer(club_id, auth.uid()));

DROP POLICY IF EXISTS "Managers read board permits" ON public.poster_permits;
CREATE POLICY "Managers read board permits"
    ON public.poster_permits FOR SELECT
    USING (public.is_board_manager(board_id, auth.uid()));

DROP POLICY IF EXISTS "Clubs request permits" ON public.poster_permits;
CREATE POLICY "Clubs request permits"
    ON public.poster_permits FOR INSERT
    WITH CHECK (
        public.is_club_officer(club_id, auth.uid())
        -- A club can request, never self-approve.
        AND status = 'pending'
    );

DROP POLICY IF EXISTS "Clubs withdraw own permits" ON public.poster_permits;
CREATE POLICY "Clubs withdraw own permits"
    ON public.poster_permits FOR UPDATE
    USING (public.is_club_officer(club_id, auth.uid()))
    WITH CHECK (public.is_club_officer(club_id, auth.uid()));

DROP POLICY IF EXISTS "Managers decide permits" ON public.poster_permits;
CREATE POLICY "Managers decide permits"
    ON public.poster_permits FOR UPDATE
    USING (public.is_board_manager(board_id, auth.uid()))
    WITH CHECK (public.is_board_manager(board_id, auth.uid()));

-- ─── 10. Grants ─────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notice_boards TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.poster_permits TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_board_occupancy(UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_overdue_takedowns(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_board_manager(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_club_officer(UUID, UUID) TO authenticated;

COMMIT;
