-- =============================================================================
-- Migration: 20270904000000_underdog_catchup_engine.sql
-- Feature: Underdog Catch-Up Engine
-- Description:
--   Provides structural catch-up mechanics for clubs ranked in the bottom 10%
--   of the leaderboard.  Three interlocking systems are implemented:
--     1. underdog_bounties  -- time-limited quest table for bottom-10% clubs.
--     2. generate_underdog_bounties() -- idempotent generator called nightly by
--        pg_cron; identifies bottom 10% clubs and creates one active bounty per
--        club.
--     3. progress_underdog_bounty() -- trigger function fired on every
--        event_rsvp check-in for a club that owns an active bounty; increments
--        progress and claims the reward (points_ledger insert) when the target
--        is met.
--     4. trg_underdog_multiplier_on_points -- trigger on points_ledger that
--        applies a dynamic rank-based multiplier to incoming point amounts for
--        users whose club is in the bottom 50% of the leaderboard.
--     5. get_user_underdog_multiplier(p_user_id uuid) -- public RPC helper that
--        returns the current multiplier for a given user (used by the frontend).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------------
-- 1. underdog_bounties table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.underdog_bounties (
    id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    club_id          UUID        NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    -- The specific goal: how many guest check-ins are required to claim this bounty
    target_checkins  INTEGER     NOT NULL DEFAULT 10 CHECK (target_checkins > 0),
    -- Running progress counter - updated by trigger
    current_checkins INTEGER     NOT NULL DEFAULT 0  CHECK (current_checkins >= 0),
    -- Reward credited to every member of the club upon claiming
    reward_points    INTEGER     NOT NULL DEFAULT 200 CHECK (reward_points > 0),
    -- Window during which this bounty is active
    expires_at       TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    claimed_at       TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookups per club
CREATE INDEX IF NOT EXISTS idx_underdog_bounties_club_id
    ON public.underdog_bounties (club_id);

-- Index to quickly find open bounties
CREATE INDEX IF NOT EXISTS idx_underdog_bounties_unclaimed
    ON public.underdog_bounties (claimed_at)
    WHERE claimed_at IS NULL;

-- ---------------------------------------------------------------------------
-- 2. Row-Level Security for underdog_bounties
-- ---------------------------------------------------------------------------
ALTER TABLE public.underdog_bounties ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read bounties (leaderboard is public)
DROP POLICY IF EXISTS "underdog_bounties_select_authenticated" ON public.underdog_bounties;
CREATE POLICY "underdog_bounties_select_authenticated"
    ON public.underdog_bounties
    FOR SELECT
    TO authenticated
    USING (true);

-- Only service-role (edge functions / pg_cron) can insert bounties
DROP POLICY IF EXISTS "underdog_bounties_insert_service" ON public.underdog_bounties;
CREATE POLICY "underdog_bounties_insert_service"
    ON public.underdog_bounties
    FOR INSERT
    TO service_role
    WITH CHECK (true);

-- Only service-role can update bounties (progress + claim)
DROP POLICY IF EXISTS "underdog_bounties_update_service" ON public.underdog_bounties;
CREATE POLICY "underdog_bounties_update_service"
    ON public.underdog_bounties
    FOR UPDATE
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 3. generate_underdog_bounties()
--    Identifies clubs in the bottom 10% of the leaderboard (by total_score)
--    and creates one active bounty for each that does not already have one.
--    Safe to call multiple times (idempotent via WHERE NOT EXISTS guard).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_underdog_bounties()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_total_clubs      INTEGER;
    v_cutoff_rank      INTEGER;
    v_club_id          UUID;
    v_rank_pos         BIGINT;
BEGIN
    -- Count total ranked clubs
    SELECT COUNT(*) INTO v_total_clubs FROM public.club_leaderboard_scores;

    IF v_total_clubs = 0 THEN
        RETURN;
    END IF;

    -- Bottom 10% threshold: clubs whose rank_pos > 90% of total are in bottom 10%
    v_cutoff_rank := GREATEST(1, FLOOR(v_total_clubs * 0.90)::INTEGER);

    -- Iterate over clubs in the bottom 10%
    FOR v_club_id, v_rank_pos IN
        SELECT
            cls.club_id,
            ROW_NUMBER() OVER (ORDER BY cls.total_score DESC) AS rank_pos
        FROM public.club_leaderboard_scores cls
        ORDER BY cls.total_score DESC
    LOOP
        -- Skip clubs NOT in the bottom 10%
        IF v_rank_pos <= v_cutoff_rank THEN
            CONTINUE;
        END IF;

        -- Create bounty only if the club has no current active, unexpired bounty
        INSERT INTO public.underdog_bounties (
            club_id,
            target_checkins,
            reward_points,
            expires_at
        )
        SELECT
            v_club_id,
            10,
            200,
            NOW() + INTERVAL '7 days'
        WHERE NOT EXISTS (
            SELECT 1
            FROM public.underdog_bounties ub
            WHERE ub.club_id    = v_club_id
              AND ub.claimed_at IS NULL
              AND ub.expires_at > NOW()
        );
    END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. progress_underdog_bounty() - trigger function
--    Fires AFTER INSERT OR UPDATE on public.event_rsvps when checked_in = TRUE.
--    Finds the club that owns the event, looks up the club's active bounty, and
--    increments current_checkins.  When the target is reached it claims the
--    bounty and inserts reward rows into points_ledger for every approved member.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.progress_underdog_bounty()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_club_id          UUID;
    v_bounty_id        UUID;
    v_new_checkins     INTEGER;
    v_target           INTEGER;
    v_reward_points    INTEGER;
    v_member_user_id   UUID;
BEGIN
    -- Resolve the club that hosted the checked-in event
    SELECT e.club_id INTO v_club_id
    FROM public.events e
    WHERE e.id = NEW.event_id;

    IF v_club_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Find and lock the active (unclaimed, non-expired) bounty for this club
    SELECT id, target_checkins, current_checkins, reward_points
    INTO v_bounty_id, v_target, v_new_checkins, v_reward_points
    FROM public.underdog_bounties
    WHERE club_id    = v_club_id
      AND claimed_at IS NULL
      AND expires_at > NOW()
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF NOT FOUND THEN
        RETURN NEW;
    END IF;

    -- Increment check-in progress
    v_new_checkins := v_new_checkins + 1;

    UPDATE public.underdog_bounties
    SET current_checkins = v_new_checkins
    WHERE id = v_bounty_id;

    -- Check if the bounty target is now met
    IF v_new_checkins >= v_target THEN
        -- Mark as claimed
        UPDATE public.underdog_bounties
        SET claimed_at = NOW()
        WHERE id = v_bounty_id;

        -- Award reward_points to every approved club member via points_ledger
        FOR v_member_user_id IN
            SELECT cm.user_id
            FROM public.club_members cm
            WHERE cm.club_id = v_club_id
              AND cm.status  = 'approved'
        LOOP
            INSERT INTO public.points_ledger (user_id, amount, reason)
            VALUES (
                v_member_user_id,
                v_reward_points,
                'Underdog Bounty Claimed - Club Catch-Up Reward'
            );
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$;

-- Attach trigger to event_rsvps
DROP TRIGGER IF EXISTS trg_progress_underdog_bounty ON public.event_rsvps;
CREATE TRIGGER trg_progress_underdog_bounty
    AFTER INSERT OR UPDATE ON public.event_rsvps
    FOR EACH ROW
    WHEN (
        NEW.checked_in = TRUE
        AND (TG_OP = 'INSERT' OR OLD.checked_in IS DISTINCT FROM TRUE)
    )
    EXECUTE FUNCTION public.progress_underdog_bounty();

-- ---------------------------------------------------------------------------
-- 5. apply_underdog_multiplier_on_points() - BEFORE INSERT trigger on points_ledger
--    Dynamically scales the incoming `amount` upward for users whose club sits
--    in the bottom 50% of the leaderboard.
--
--    Multiplier tiers:
--      Bottom 10%   -> x2.0
--      Bottom 11-30% -> x1.5
--      Bottom 31-50% -> x1.25
--      Top 50% / no club -> x1.0 (no change)
--
--    Note: Points inserted with a reason containing 'Underdog' are excluded to
--    prevent recursive amplification of bounty reward inserts.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_underdog_multiplier_on_points()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_total_clubs INTEGER;
    v_club_rank   BIGINT;
    v_rank_pct    NUMERIC;
    v_multiplier  NUMERIC := 1.0;
BEGIN
    -- Skip bounty-reward inserts to prevent recursive amplification
    IF NEW.reason LIKE '%Underdog%' THEN
        RETURN NEW;
    END IF;

    SELECT COUNT(*) INTO v_total_clubs FROM public.club_leaderboard_scores;

    IF v_total_clubs = 0 THEN
        RETURN NEW;
    END IF;

    -- Find rank of the user's worst-performing club (maximises fairness boost)
    SELECT rk.rank_pos INTO v_club_rank
    FROM (
        SELECT
            cm.user_id,
            ROW_NUMBER() OVER (ORDER BY cls.total_score DESC) AS rank_pos
        FROM public.club_members cm
        JOIN public.club_leaderboard_scores cls ON cls.club_id = cm.club_id
        WHERE cm.user_id = NEW.user_id
          AND cm.status  = 'approved'
        ORDER BY cls.total_score ASC
        LIMIT 1
    ) rk;

    IF v_club_rank IS NULL THEN
        RETURN NEW;
    END IF;

    -- Percentile from the bottom (1.0 = last place)
    v_rank_pct := v_club_rank::NUMERIC / v_total_clubs::NUMERIC;

    IF v_rank_pct >= 0.90 THEN
        v_multiplier := 2.0;
    ELSIF v_rank_pct >= 0.70 THEN
        v_multiplier := 1.5;
    ELSIF v_rank_pct >= 0.50 THEN
        v_multiplier := 1.25;
    END IF;

    IF v_multiplier > 1.0 THEN
        NEW.amount := ROUND(NEW.amount::NUMERIC * v_multiplier)::INTEGER;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_underdog_multiplier_on_points ON public.points_ledger;
CREATE TRIGGER trg_underdog_multiplier_on_points
    BEFORE INSERT ON public.points_ledger
    FOR EACH ROW
    EXECUTE FUNCTION public.apply_underdog_multiplier_on_points();

-- ---------------------------------------------------------------------------
-- 6. get_user_underdog_multiplier(p_user_id uuid)  -  public RPC helper
--    Returns the current effective multiplier for a user (1.0 if not boosted).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_underdog_multiplier(p_user_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_total_clubs INTEGER;
    v_club_rank   BIGINT;
    v_rank_pct    NUMERIC;
BEGIN
    SELECT COUNT(*) INTO v_total_clubs FROM public.club_leaderboard_scores;

    IF v_total_clubs = 0 THEN
        RETURN 1.0;
    END IF;

    SELECT rk.rank_pos INTO v_club_rank
    FROM (
        SELECT
            cm.user_id,
            ROW_NUMBER() OVER (ORDER BY cls.total_score DESC) AS rank_pos
        FROM public.club_members cm
        JOIN public.club_leaderboard_scores cls ON cls.club_id = cm.club_id
        WHERE cm.user_id = p_user_id
          AND cm.status  = 'approved'
        ORDER BY cls.total_score ASC
        LIMIT 1
    ) rk;

    IF v_club_rank IS NULL THEN
        RETURN 1.0;
    END IF;

    v_rank_pct := v_club_rank::NUMERIC / v_total_clubs::NUMERIC;

    IF v_rank_pct >= 0.90 THEN
        RETURN 2.0;
    ELSIF v_rank_pct >= 0.70 THEN
        RETURN 1.5;
    ELSIF v_rank_pct >= 0.50 THEN
        RETURN 1.25;
    END IF;

    RETURN 1.0;
END;
$$;

-- Allow authenticated users to call the RPC helper
GRANT EXECUTE ON FUNCTION public.get_user_underdog_multiplier(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- 7. Schedule nightly bounty generation via pg_cron (02:00 UTC daily)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        PERFORM extensions.cron.schedule(
            'generate-underdog-bounties',
            '0 2 * * *',
            'SELECT public.generate_underdog_bounties();'
        );
    END IF;
END $$;
