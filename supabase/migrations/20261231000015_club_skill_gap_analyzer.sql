-- Migration: 20261231000015_club_skill_gap_analyzer.sql
-- Description: Adds a Postgres RPC to aggregate skills of all club executive board members 
-- for the Skill Gap Analyzer feature (Issue #3718).

CREATE OR REPLACE FUNCTION public.get_club_board_skills(p_club_id UUID)
RETURNS TABLE (
  skill TEXT,
  count INT
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT 
    TRIM(unnested_skill) AS skill,
    COUNT(*)::INT AS count
  FROM club_members cm
  JOIN club_roles cr ON cm.role_id = cr.id
  JOIN profiles p ON cm.user_id = p.id
  CROSS JOIN LATERAL UNNEST(p.skills) AS unnested_skill
  WHERE cm.club_id = p_club_id
    AND cr.permissions_level >= 100 -- Ensure we only look at "Admin" roles or Executive Board equivalent
    AND cm.status = 'approved'
  GROUP BY TRIM(unnested_skill)
  ORDER BY count DESC, skill ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_club_board_skills(UUID) TO authenticated;
