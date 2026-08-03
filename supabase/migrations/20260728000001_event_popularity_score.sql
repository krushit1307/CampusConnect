-- Migration: Event Popularity Score
-- Description: Implements a dynamic popularity score for events based on RSVP count,
-- comment count (from club posts), and exponential time decay using event age.
-- Follows the existing pattern used in trending_posts_view.sql

-- 1. Create the popularity calculation function
CREATE OR REPLACE FUNCTION public.calculate_event_popularity(event_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rsvp_count BIGINT;
  v_comment_count BIGINT;
  v_hours_since_creation NUMERIC;
  v_popularity_score NUMERIC;
BEGIN
  -- Count RSVPs for this event
  SELECT COUNT(*)
  INTO v_rsvp_count
  FROM public.event_rsvps
  WHERE event_rsvps.event_id = calculate_event_popularity.event_id;

  -- Count comments on posts within the same club as this event
  SELECT COUNT(DISTINCT c.id)
  INTO v_comment_count
  FROM public.comments c
  JOIN public.posts p ON c.post_id = p.id
  JOIN public.events e ON e.club_id = p.club_id
  WHERE e.id = calculate_event_popularity.event_id;

  -- Calculate hours since event creation (add 2 to avoid division by very small numbers)
  SELECT EXTRACT(EPOCH FROM (NOW() - e.created_at)) / 3600 + 2
  INTO v_hours_since_creation
  FROM public.events e
  WHERE e.id = calculate_event_popularity.event_id;

  -- Calculate popularity score using exponential time decay
  -- Formula: (RSVPs + Comments * 2) / (hours_since_creation ^ 1.5)
  -- This gives more weight to comments and decays older events
  v_popularity_score := (
    (v_rsvp_count + (v_comment_count * 2))::NUMERIC
    /
    POWER(v_hours_since_creation, 1.5)
  );

  RETURN v_popularity_score;
END;
$$;

GRANT EXECUTE ON FUNCTION public.calculate_event_popularity(UUID) TO authenticated;

-- 2. Create materialized view for event popularity scores
DROP MATERIALIZED VIEW IF EXISTS event_popularity;

CREATE MATERIALIZED VIEW event_popularity AS
SELECT
  e.id,
  e.title,
  e.club_id,
  e.start_date,
  e.created_at,
  e.status,
  public.calculate_event_popularity(e.id) AS popularity_score,
  -- Include counts for reference
  (SELECT COUNT(*) FROM public.event_rsvps WHERE event_id = e.id) AS rsvp_count,
  (SELECT COUNT(DISTINCT c.id)
   FROM public.comments c
   JOIN public.posts p ON c.post_id = p.id
   WHERE p.club_id = e.club_id) AS comment_count
FROM public.events e;

-- 3. Create indexes for fast sorting and lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_event_popularity_id
ON event_popularity(id);

CREATE INDEX IF NOT EXISTS idx_event_popularity_score
ON event_popularity(popularity_score DESC);

CREATE INDEX IF NOT EXISTS idx_event_popularity_club_id
ON event_popularity(club_id);

-- 4. Grant select access
GRANT SELECT ON event_popularity TO authenticated, anon;

-- 5. Create refresh function
CREATE OR REPLACE FUNCTION refresh_event_popularity()
RETURNS void
LANGUAGE sql
AS $$
  REFRESH MATERIALIZED VIEW CONCURRENTLY event_popularity;
$$;

-- 6. Schedule cron job to refresh every 15 minutes (following existing pattern)
SELECT cron.schedule(
  'refresh-event-popularity',
  '*/15 * * * *',
  $$ REFRESH MATERIALIZED VIEW CONCURRENTLY event_popularity; $$
);
