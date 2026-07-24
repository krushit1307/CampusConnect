-- ============================================================
-- Migration: 20260724030000_trending_clubs_rpc.sql
-- Description:
-- Adds a get_trending_clubs() RPC function that ranks clubs by
-- a "hotness" score based on recent member growth and post
-- activity within the last 7 days. Calculation is handled
-- purely on the database layer for speed (#1082).
--
-- Note: member growth and post counts are aggregated in
-- separate subqueries before being joined to clubs, rather than
-- joining club_members and posts directly to clubs in one go.
-- A direct three-way JOIN would fan out (duplicate rows) for
-- any club with more than one recent member AND more than one
-- recent post, producing inflated/incorrect counts.
-- ============================================================

CREATE OR REPLACE FUNCTION get_trending_clubs()
RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  description TEXT,
  banner_url TEXT,
  logo_url TEXT,
  member_count INTEGER,
  new_members_last_7_days BIGINT,
  new_posts_last_7_days BIGINT,
  hotness_score NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.name,
    c.slug,
    c.description,
    c.banner_url,
    c.logo_url,
    c.member_count,
    COALESCE(recent_members.new_count, 0) AS new_members_last_7_days,
    COALESCE(recent_posts.new_count, 0) AS new_posts_last_7_days,
    (
      COALESCE(recent_members.new_count, 0) * 5
      + COALESCE(recent_posts.new_count, 0) * 2
    )::NUMERIC AS hotness_score
  FROM clubs c
  LEFT JOIN (
    SELECT club_id, COUNT(*) AS new_count
    FROM club_members
    WHERE joined_at >= NOW() - INTERVAL '7 days'
    GROUP BY club_id
  ) recent_members ON recent_members.club_id = c.id
  LEFT JOIN (
    SELECT club_id, COUNT(*) AS new_count
    FROM posts
    WHERE created_at >= NOW() - INTERVAL '7 days'
    GROUP BY club_id
  ) recent_posts ON recent_posts.club_id = c.id
  ORDER BY hotness_score DESC, c.member_count DESC;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_trending_clubs() IS
'Returns clubs ranked by a "hotness" score = (new members in last 7 days * 5) + (new posts in last 7 days * 2). Powers the "Trending Clubs" dashboard feature (#1082). Exposed automatically by PostgREST as /rpc/get_trending_clubs.';

-- ------------------------------------------------------------
-- Permissions
-- ------------------------------------------------------------
-- No SECURITY DEFINER needed: clubs, club_members, and posts
-- already have public SELECT RLS policies (see 001_initial_schema.sql),
-- so this function only surfaces data any authenticated or
-- anonymous caller could already read directly.

GRANT EXECUTE ON FUNCTION get_trending_clubs() TO authenticated, anon;

-- ------------------------------------------------------------
-- End of migration
-- ------------------------------------------------------------
