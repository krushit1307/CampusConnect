-- Migration: Add get_trending_hashtags function to extract and count recent hashtags

CREATE OR REPLACE FUNCTION public.get_trending_hashtags()
RETURNS TABLE (hashtag TEXT, count BIGINT)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    LOWER((regexp_matches(content, '#([a-zA-Z0-9_]+)', 'g'))[1]) AS hashtag,
    COUNT(*) AS count
  FROM public.posts
  WHERE created_at > NOW() - INTERVAL '48 hours'
  GROUP BY hashtag
  ORDER BY count DESC, hashtag ASC
  LIMIT 10;
$$;

GRANT EXECUTE ON FUNCTION public.get_trending_hashtags() TO authenticated, anon;
