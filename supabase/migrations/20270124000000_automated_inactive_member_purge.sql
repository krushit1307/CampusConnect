-- ============================================================
-- Migration: 20270124000000_automated_inactive_member_purge.sql
-- Issue: #3682 — Implement 'Automated "Inactive Member" Purge'
--
-- Goals
--   1. Add an 'archived' value to the `join_status` enum so a
--      member's row is preserved (audit trail) but they no longer
--      count as active. Avoids hard-deleting rows from club_members.
--   2. Add a `last_activity_at` column to club_members (denormalised
--      cache of the most recent RSVP check-in) so the purge query
--      can avoid a join with event_rsvps for every member.
--   3. Build the `prune_club_rosters()` SECURITY DEFINER function:
--        - finds approved members whose last attended RSVP (or
--          joined_at, if they never RSVP'd) is older than 18 months
--        - flips their status from 'approved' to 'archived'
--        - returns a JSON summary for the cron log
--   4. Build `get_club_prune_report(p_club_id)` so the Club President
--      can fetch the latest purge summary for their club.
--   5. Extend the existing `handle_club_member_change()` trigger so
--      an `approved → archived` transition decrements `member_count`,
--      ensuring archived members no longer count toward the public
--      "Total Members" badge.
--   6. Schedule a nightly pg_cron job `prune-club-rosters` that
--      calls the function. The schedule is guarded by `pg_extension`
--      so the migration still applies cleanly on Supabase projects
--      that don't have pg_cron enabled yet.
--   7. RLS: archived members can still read their own archived
--      membership row (so they can see "you were archived for
--      inactivity" and re-request to join), but they cannot create
--      RSVPs / posts until they're approved again.
-- ============================================================

-- ─── 1. Add 'archived' to the join_status enum ─────────────────────
-- Run OUTSIDE the BEGIN/COMMIT block below. In PostgreSQL 12+,
-- `ALTER TYPE ... ADD VALUE` is allowed inside a transaction, BUT the
-- new enum value cannot be USED in the same transaction. Since this
-- migration references 'archived'::join_status in the trigger function
-- and the purge function below, the ALTER TYPE must run in its own
-- implicit transaction. Matches the pattern in migration
-- 20261022000002_add_club_hibernation_status.sql.
ALTER TYPE public.join_status ADD VALUE IF NOT EXISTS 'archived';

BEGIN;

-- ─── 2. Add `last_activity_at` to club_members ─────────────────────
-- Cached timestamp of the member's most recent RSVP check-in for
-- this club. Updated by a trigger on event_rsvps (defined below).
-- Nullable so the column can be added without a backfill lock; the
-- purge function treats NULL last_activity_at as "use joined_at".
ALTER TABLE public.club_members
    ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ;

-- Backfill from event_rsvps in one statement. We coalesce to
-- joined_at so a member who never RSVP'd but joined 3 years ago
-- is still picked up by the purge query.
UPDATE public.club_members cm
SET last_activity_at = COALESCE(
    (
        SELECT MAX(r.rsvp_at)
          FROM public.event_rsvps r
          JOIN public.events e ON e.id = r.event_id
         WHERE r.user_id = cm.user_id
           AND e.club_id = cm.club_id
           AND r.checked_in = TRUE
    ),
    cm.joined_at
)
WHERE cm.last_activity_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_club_members_last_activity
    ON public.club_members (last_activity_at)
    WHERE status = 'approved';

-- ─── 3. Trigger to keep last_activity_at fresh on every check-in ──
CREATE OR REPLACE FUNCTION public.touch_member_last_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$ DECLARE
    v_club_id UUID;
BEGIN
    -- Only update on INSERT or when checked_in flips to TRUE.
    IF TG_OP = 'INSERT' THEN
        v_club_id := NEW.club_id;
    ELSIF TG_OP = 'UPDATE' AND NEW.checked_in = TRUE AND (OLD.checked_in IS DISTINCT FROM NEW.checked_in) THEN
        v_club_id := NEW.club_id;
    ELSE
        RETURN NEW;
    END IF;

    UPDATE public.club_members
       SET last_activity_at = NOW()
     WHERE club_id = v_club_id
       AND user_id = NEW.user_id
       AND status = 'approved';
    RETURN NEW;
END;
 $$;

DROP TRIGGER IF EXISTS trg_touch_member_last_activity ON public.event_rsvps;
CREATE TRIGGER trg_touch_member_last_activity
    AFTER INSERT OR UPDATE OF checked_in ON public.event_rsvps
    FOR EACH ROW
    EXECUTE FUNCTION public.touch_member_last_activity();

-- ─── 4. Extend handle_club_member_change to handle 'archived' ──────
-- The original trigger (migration 20260716000005) only handles the
-- `pending ↔ approved` transition. We need to also decrement
-- `member_count` when a member goes `approved → archived` and
-- increment it when they're restored `archived → approved`.
CREATE OR REPLACE FUNCTION public.handle_club_member_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$ BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.status = 'approved' THEN
            UPDATE public.clubs
            SET member_count = member_count + 1
            WHERE id = NEW.club_id;
        END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.club_id != NEW.club_id THEN
            IF OLD.status = 'approved' THEN
                UPDATE public.clubs
                SET member_count = GREATEST(member_count - 1, 0)
                WHERE id = OLD.club_id;
            END IF;
            IF NEW.status = 'approved' THEN
                UPDATE public.clubs
                SET member_count = member_count + 1
                WHERE id = NEW.club_id;
            END IF;
        ELSE
            -- pending → approved: increment
            IF OLD.status = 'pending' AND NEW.status = 'approved' THEN
                UPDATE public.clubs
                SET member_count = member_count + 1
                WHERE id = NEW.club_id;
            -- approved → pending: decrement (existing behaviour)
            ELSIF OLD.status = 'approved' AND NEW.status = 'pending' THEN
                UPDATE public.clubs
                SET member_count = GREATEST(member_count - 1, 0)
                WHERE id = NEW.club_id;
            -- ── NEW (Issue #3682): approved → archived: decrement ──
            ELSIF OLD.status = 'approved' AND NEW.status = 'archived' THEN
                UPDATE public.clubs
                SET member_count = GREATEST(member_count - 1, 0)
                WHERE id = NEW.club_id;
            -- ── NEW (Issue #3682): archived → approved: increment ──
            ELSIF OLD.status = 'archived' AND NEW.status = 'approved' THEN
                UPDATE public.clubs
                SET member_count = member_count + 1
                WHERE id = NEW.club_id;
            END IF;
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        IF OLD.status = 'approved' THEN
            UPDATE public.clubs
            SET member_count = GREATEST(member_count - 1, 0)
            WHERE id = OLD.club_id;
        END IF;
    END IF;
    RETURN NULL;
END;
 $$;

-- ─── 5. club_prune_reports table (President's report source) ──────
-- Created BEFORE the prune function so the function body can reference
-- it without a parse-time error.
CREATE TABLE IF NOT EXISTS public.club_prune_reports (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id            BIGINT NOT NULL,
    club_id           UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    members_archived  INTEGER NOT NULL,
    dry_run           BOOLEAN NOT NULL DEFAULT FALSE,
    ran_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_club_prune_reports_club_run
    ON public.club_prune_reports (club_id, run_id DESC);

ALTER TABLE public.club_prune_reports ENABLE ROW LEVEL SECURITY;

-- Club admins can read their own club's prune reports.
CREATE POLICY "Club admins can read their club's prune reports"
    ON public.club_prune_reports FOR SELECT
    USING (public.is_club_admin(club_id, auth.uid()));

-- Only the service_role (cron) can insert.
CREATE POLICY "Service role can insert prune reports"
    ON public.club_prune_reports FOR INSERT
    TO service_role
    WITH CHECK (TRUE);

-- ─── 6. prune_club_rosters() — the cron entry point ───────────────
-- Returns a JSON summary so the cron log + the President's report
-- share the same source of truth.
--
-- Definition of "inactive" (per the issue):
--   - status = 'approved'
--   - AND ( last_activity_at IS NULL OR
--          last_activity_at < NOW() - INTERVAL '18 months' )
--   - AND joined_at < NOW() - INTERVAL '18 months'
--       (members who joined less than 18 months ago are never purged,
--        even if they have no activity — they get a grace period).
--
-- Admins are exempt. We never archive a club admin because removing
-- the only admin would orphan the club.
CREATE OR REPLACE FUNCTION public.prune_club_rosters(
    p_dry_run BOOLEAN DEFAULT FALSE,
    p_inactivity_threshold_months INTEGER DEFAULT 18
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$ DECLARE
    v_cutoff TIMESTAMPTZ := NOW() - make_interval(months => p_inactivity_threshold_months);
    v_total_archived INTEGER := 0;
    v_clubs_touched INTEGER := 0;
    v_new_run_id BIGINT := 0;
    v_summary JSON;
BEGIN
    -- ── 5a. Per-club summary of who WOULD be archived (dry-run aware) ──
    -- We capture the per-club count BEFORE the UPDATE so the report
    -- reflects exactly what the cron is about to do (or just did).
    DROP TABLE IF EXISTS _prune_plan;
    CREATE TEMP TABLE _prune_plan (
        club_id UUID,
        club_name TEXT,
        members_to_archive INTEGER
    ) ON COMMIT DROP;

    INSERT INTO _prune_plan (club_id, club_name, members_to_archive)
    SELECT
        c.id,
        c.name,
        COUNT(cm.user_id)::INTEGER
    FROM public.club_members cm
    JOIN public.clubs c ON c.id = cm.club_id
    WHERE cm.status = 'approved'
      AND cm.role <> 'admin'   -- never archive admins
      AND cm.joined_at < v_cutoff
      AND COALESCE(cm.last_activity_at, cm.joined_at) < v_cutoff
    GROUP BY c.id, c.name;

    -- ── 5b. The actual purge ─────────────────────────────────────────
    -- UPDATE ... FROM is the row-counting way to flip many rows in one
    -- statement. The WHERE clause re-checks the cutoff so a concurrent
    -- INSERT can't slip through.
    IF p_dry_run = FALSE THEN
        UPDATE public.club_members AS cm
           SET status = 'archived'::join_status,
               last_activity_at = COALESCE(cm.last_activity_at, cm.joined_at)
          FROM _prune_plan pp
         WHERE cm.club_id = pp.club_id
           AND cm.status = 'approved'
           AND cm.role <> 'admin'
           AND cm.joined_at < v_cutoff
           AND COALESCE(cm.last_activity_at, cm.joined_at) < v_cutoff;

        GET DIAGNOSTICS v_total_archived = ROW_COUNT;
        SELECT COUNT(*) INTO v_clubs_touched FROM _prune_plan WHERE members_to_archive > 0;
    ELSE
        SELECT COALESCE(SUM(members_to_archive), 0)::INTEGER
          INTO v_total_archived
          FROM _prune_plan;
        SELECT COUNT(*) INTO v_clubs_touched FROM _prune_plan WHERE members_to_archive > 0;
    END IF;

    -- ── 5c. Per-club report rows (persisted so Presidents can fetch it) ─
    -- Compute the new run_id once (MAX + 1, or 1 on first ever run) and
    -- insert every row of this run with that single value. This keeps
    -- the historical report rows intact so the President can see trends.
    SELECT COALESCE(MAX(run_id), 0) + 1
      INTO v_new_run_id
      FROM public.club_prune_reports;

    INSERT INTO public.club_prune_reports (run_id, club_id, members_archived, dry_run, ran_at)
    SELECT
        v_new_run_id,
        pp.club_id,
        pp.members_to_archive,
        p_dry_run,
        NOW()
    FROM _prune_plan
    WHERE pp.members_to_archive > 0;

    v_summary := json_build_object(
        'dry_run', p_dry_run,
        'inactivity_threshold_months', p_inactivity_threshold_months,
        'cutoff', v_cutoff,
        'total_archived', v_total_archived,
        'clubs_touched', v_clubs_touched,
        'per_club', COALESCE(
            (SELECT json_agg(json_build_object(
                'club_id', club_id,
                'club_name', club_name,
                'members_archived', members_to_archive
            )) FROM _prune_plan WHERE members_to_archive > 0),
            '[]'::json
        )
    );

    DROP TABLE _prune_plan;
    RETURN v_summary;
END;
 $$;

GRANT EXECUTE ON FUNCTION public.prune_club_rosters(BOOLEAN, INTEGER)
    TO authenticated, service_role;

-- ─── 7. get_club_prune_report(p_club_id) — the President's API ─────
-- Returns the most recent run's summary for the specified club.
CREATE OR REPLACE FUNCTION public.get_club_prune_report(p_club_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$ DECLARE
    v_is_admin BOOLEAN;
    v_latest JSON;
BEGIN
    SELECT public.is_club_admin(p_club_id, auth.uid()) INTO v_is_admin;
    IF NOT v_is_admin THEN
        RAISE EXCEPTION 'Unauthorized: only club admins can view the prune report.';
    END IF;

    SELECT json_build_object(
        'club_id', r.club_id,
        'members_archived', r.members_archived,
        'dry_run', r.dry_run,
        'ran_at', r.ran_at,
        'run_id', r.run_id
    ) INTO v_latest
    FROM public.club_prune_reports r
    WHERE r.club_id = p_club_id
    ORDER BY r.ran_at DESC
    LIMIT 1;

    RETURN COALESCE(v_latest, json_build_object(
        'club_id', p_club_id,
        'members_archived', 0,
        'message', 'No purge has run yet.'
    ));
END;
 $$;

GRANT EXECUTE ON FUNCTION public.get_club_prune_report(UUID)
    TO authenticated;

-- ─── 8. Schedule the nightly cron job ──────────────────────────────
-- Runs at 03:00 UTC every night. The function is idempotent —
-- re-running it on members who were already archived is a no-op
-- because the WHERE clause filters on status = 'approved'.
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'prune-club-rosters') THEN
            PERFORM cron.unschedule('prune-club-rosters');
        END IF;

        PERFORM cron.schedule(
            'prune-club-rosters',
            '0 3 * * *',  -- 03:00 UTC daily
            $_$SELECT public.prune_club_rosters(FALSE, 18);$_$         );
    END IF;
END
 $$;

-- ─── 9. RLS amendment: archived members can't create new RSVPs ────
-- They can still READ events (public) and read their own archived
-- membership row (so they can see "you were archived" and re-request
-- to join). The existing INSERT policy on event_rsvps is replaced
-- with one that requires approved status.
DROP POLICY IF EXISTS "Authenticated users can RSVP" ON public.event_rsvps;
CREATE POLICY "Authenticated users can RSVP"
    ON public.event_rsvps FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.club_members cm
             WHERE cm.club_id = event_rsvps.club_id
               AND cm.user_id = auth.uid()
               AND cm.status = 'approved'
        )
        OR public.is_club_admin(event_rsvps.club_id, auth.uid())
    );

COMMIT;

-- ============================================================
-- Verification (manual):
--   SELECT * FROM prune_club_rosters(TRUE, 18);  -- dry-run
--   SELECT * FROM prune_club_rosters(FALSE, 18); -- live
--   SELECT * FROM get_club_prune_report('<club-uuid>');
-- ============================================================
