-- =============================================================================
-- Migration: Gamification Points Decay System
-- Issue: #3292 - Develop a 'Club Member Points Decay System'
-- Description: Creates RPCs to calculate time-weighted active scores and 
-- generate leaderboards. Uses gamification_points table.
-- =============================================================================

-- 1. RPC to get a specific user's Active Score and Lifetime Score
CREATE OR REPLACE FUNCTION public.get_user_scores(p_user_id UUID)
RETURNS TABLE (
    active_score INT,
    lifetime_score INT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(SUM(
            CASE 
                WHEN created_at >= NOW() - INTERVAL '3 months' THEN points * 1.0
                WHEN created_at >= NOW() - INTERVAL '6 months' THEN points * 0.5
                ELSE points * 0.1
            END
        ), 0)::INT AS active_score,
        COALESCE(SUM(points), 0)::INT AS lifetime_score
    FROM public.gamification_points
    WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. RPC to get the global active leaderboard
CREATE OR REPLACE FUNCTION public.get_active_leaderboard()
RETURNS TABLE (
    user_id UUID,
    full_name TEXT,
    handle TEXT,
    avatar_url TEXT,
    active_score INT,
    lifetime_score INT,
    rank INT
) AS $$
BEGIN
    RETURN QUERY
    WITH scores AS (
        SELECT 
            p.id AS user_id,
            p.full_name,
            p.handle,
            p.avatar_url,
            COALESCE(SUM(
                CASE 
                    WHEN gp.created_at >= NOW() - INTERVAL '3 months' THEN gp.points * 1.0
                    WHEN gp.created_at >= NOW() - INTERVAL '6 months' THEN gp.points * 0.5
                    ELSE gp.points * 0.1
                END
            ), 0)::INT AS active_score,
            COALESCE(SUM(gp.points), 0)::INT AS lifetime_score
        FROM public.profiles p
        JOIN public.gamification_points gp ON p.id = gp.user_id
        GROUP BY p.id
    )
    SELECT 
        s.user_id,
        s.full_name,
        s.handle,
        s.avatar_url,
        s.active_score,
        s.lifetime_score,
        (ROW_NUMBER() OVER (ORDER BY s.active_score DESC, s.lifetime_score DESC))::INT AS rank
    FROM scores s
    ORDER BY s.active_score DESC, s.lifetime_score DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
