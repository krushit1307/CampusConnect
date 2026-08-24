-- Migration: 20260849000000_club_lookalike_audience.sql
-- Description: Automated Lookalike Audience Marketing Engine with demographic centroid matching and privacy opt-out (#3585)

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS opt_out_targeted_marketing BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.profiles.opt_out_targeted_marketing IS 'User privacy toggle to opt out of targeted club marketing notifications';

-- RPC: Calculate lookalike audience for a club based on member demographics & attendance tags
CREATE OR REPLACE FUNCTION public.generate_lookalike_audience(
  p_club_id UUID,
  p_limit INT DEFAULT 20
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_top_major TEXT;
  v_top_tags TEXT[];
  v_opt_out_count INT;
  v_result JSONB;
BEGIN
  -- Count total opted-out non-members for privacy stats
  SELECT COUNT(*) INTO v_opt_out_count
  FROM public.profiles p
  WHERE p.opt_out_targeted_marketing IS TRUE
    AND p.id NOT IN (SELECT user_id FROM public.club_members WHERE club_id = p_club_id);

  -- Extract primary major of active club members
  SELECT p.major INTO v_top_major
  FROM public.club_members cm
  JOIN public.profiles p ON cm.user_id = p.id
  WHERE cm.club_id = p_club_id AND p.major IS NOT NULL
  GROUP BY p.major
  ORDER BY COUNT(*) DESC
  LIMIT 1;

  -- Extract top attended event tags for this club
  SELECT ARRAY(
    SELECT unnest(e.tags)
    FROM public.events e
    WHERE e.club_id = p_club_id AND e.tags IS NOT NULL
    GROUP BY 1
    ORDER BY COUNT(*) DESC
    LIMIT 5
  ) INTO v_top_tags;

  -- Match non-member profiles with highest demographic and tag similarity
  WITH non_members AS (
    SELECT 
      p.id AS user_id,
      p.full_name,
      p.handle,
      p.avatar_url,
      p.major,
      p.graduation_year,
      (
        CASE WHEN p.major = v_top_major THEN 40 ELSE 10 END +
        CASE WHEN p.interests && v_top_tags THEN 40 ELSE 10 END +
        10
      ) AS match_score
    FROM public.profiles p
    WHERE p.id NOT IN (SELECT user_id FROM public.club_members WHERE club_id = p_club_id)
      AND COALESCE(p.opt_out_targeted_marketing, false) IS FALSE
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'user_id', nm.user_id,
        'full_name', nm.full_name,
        'handle', nm.handle,
        'avatar_url', nm.avatar_url,
        'major', nm.major,
        'graduation_year', nm.graduation_year,
        'similarity_score', LEAST(100, nm.match_score),
        'matching_reasons', jsonb_build_array(
          CASE WHEN nm.major = v_top_major THEN 'Matches Primary Club Major (' || nm.major || ')' ELSE 'Cross-disciplinary interest' END,
          'Shared Event Interest Tags'
        )
      )
      ORDER BY nm.match_score DESC
      LIMIT p_limit
    ),
    '[]'::jsonb
  ) INTO v_result
  FROM non_members nm;

  RETURN jsonb_build_object(
    'club_id', p_club_id,
    'top_major', v_top_major,
    'opt_out_count', v_opt_out_count,
    'matches', v_result
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_lookalike_audience(UUID, INT) TO authenticated, anon;
