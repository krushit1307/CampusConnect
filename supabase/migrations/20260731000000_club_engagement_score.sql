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
  FROM ( ... event/rsvp/post subqueries with the 40/30/30 weights ... ) sub
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