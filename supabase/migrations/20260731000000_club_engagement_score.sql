ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS engagement_score NUMERIC;
  CREATE INDEX IF NOT EXISTS idx_events_club_id_start_date
  ON public.events (club_id, start_date);

CREATE INDEX IF NOT EXISTS idx_posts_club_id_created_at
  ON public.posts (club_id, created_at)
  WHERE deleted_at IS NULL;
  CREATE OR REPLACE FUNCTION public.calculate_engagement_score()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.clubs c
  SET engagement_score = ROUND(sub.score, 2)
  FROM (
    WITH club_metrics AS (
      SELECT
        cl.id AS club_id,
        COALESCE((SELECT COUNT(*) FROM public.events e WHERE e.club_id = cl.id AND e.created_at >= NOW() - INTERVAL '30 days'), 0) AS event_count,
        COALESCE((SELECT COUNT(*) FROM public.event_rsvps r JOIN public.events e ON e.id = r.event_id WHERE e.club_id = cl.id AND r.created_at >= NOW() - INTERVAL '30 days'), 0) AS rsvp_count,
        COALESCE((SELECT COUNT(*) FROM public.posts p WHERE p.club_id = cl.id AND p.created_at >= NOW() - INTERVAL '30 days' AND p.deleted_at IS NULL), 0) AS post_count
      FROM public.clubs cl
    )
    SELECT
      club_id,
      (event_count * 4.0) + (rsvp_count * 3.0) + (post_count * 3.0) AS score
    FROM club_metrics
  ) sub
  WHERE c.id = sub.club_id
    AND c.created_at < NOW() - INTERVAL '30 days';  -- grace period
END;
$$;
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'calculate-engagement-score-nightly',
  '0 2 * * *',
  $$SELECT public.calculate_engagement_score();$$
);