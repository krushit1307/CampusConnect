-- Migration: Real-Time Gamification Leaderboard & Club Competition
-- Issue: #3894 - Build a 'Real-Time Gamification Leaderboard'
-- Description: Adds privacy opt-out column to profiles, and builds RPC functions
-- for real-time monthly user and club leaderboards.

-- 1. Add show_on_leaderboard column to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS show_on_leaderboard BOOLEAN DEFAULT TRUE;

-- 2. User Leaderboard RPC: Aggregate top 50 users by current month points
CREATE OR REPLACE FUNCTION public.get_top_users_monthly_leaderboard(p_limit INT DEFAULT 50)
RETURNS TABLE (
    user_id UUID,
    first_name TEXT,
    last_name TEXT,
    avatar_url TEXT,
    monthly_points NUMERIC,
    rank_position INT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH monthly_sums AS (
        SELECT 
            pl.user_id,
            COALESCE(SUM(pl.amount), 0)::NUMERIC AS points
        FROM public.points_ledger pl
        WHERE pl.created_at >= DATE_TRUNC('month', NOW())
          AND pl.created_at < DATE_TRUNC('month', NOW() + INTERVAL '1 month')
        GROUP BY pl.user_id
    )
    SELECT 
        p.id AS user_id,
        p.first_name,
        p.last_name,
        p.avatar_url,
        ms.points AS monthly_points,
        ROW_NUMBER() OVER (ORDER BY ms.points DESC, p.created_at ASC)::INT AS rank_position
    FROM public.profiles p
    JOIN monthly_sums ms ON ms.user_id = p.id
    WHERE p.show_on_leaderboard = TRUE
      AND ms.points > 0
    ORDER BY ms.points DESC, p.created_at ASC
    LIMIT p_limit;
END;
$$;

-- 3. Club Leaderboard RPC: Aggregate total points earned by all club members in the current month
CREATE OR REPLACE FUNCTION public.get_top_clubs_monthly_leaderboard(p_limit INT DEFAULT 50)
RETURNS TABLE (
    club_id UUID,
    club_name TEXT,
    logo_url TEXT,
    slug TEXT,
    monthly_points NUMERIC,
    rank_position INT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH member_monthly_points AS (
        -- Get monthly points per user
        SELECT 
            pl.user_id,
            SUM(pl.amount) AS points
        FROM public.points_ledger pl
        WHERE pl.created_at >= DATE_TRUNC('month', NOW())
          AND pl.created_at < DATE_TRUNC('month', NOW() + INTERVAL '1 month')
        GROUP BY pl.user_id
    ),
    club_aggregates AS (
        -- Aggregate member points per club
        SELECT 
            cm.club_id,
            COALESCE(SUM(mmp.points), 0)::NUMERIC AS points
        FROM public.club_members cm
        JOIN member_monthly_points mmp ON mmp.user_id = cm.user_id
        WHERE cm.status = 'approved'
        GROUP BY cm.club_id
    )
    SELECT 
        c.id AS club_id,
        c.name AS club_name,
        c.logo_url,
        c.slug,
        ca.points AS monthly_points,
        ROW_NUMBER() OVER (ORDER BY ca.points DESC, c.created_at ASC)::INT AS rank_position
    FROM public.clubs c
    JOIN club_aggregates ca ON ca.club_id = c.id
    WHERE c.status = 'ACTIVE'
      AND ca.points > 0
    ORDER BY ca.points DESC, c.created_at ASC
    LIMIT p_limit;
END;
$$;
