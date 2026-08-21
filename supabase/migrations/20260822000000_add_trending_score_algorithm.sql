-- 1. Add trending_score column to events table
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS trending_score NUMERIC DEFAULT 0.0 NOT NULL;

-- Index for instant sorting on trending feed queries
CREATE INDEX IF NOT EXISTS idx_events_trending_score ON events(trending_score DESC);

-- 2. PostgreSQL function to compute HackerNews-style time decay score
CREATE OR REPLACE FUNCTION calculate_trending_score(
    p_rsvp_count INTEGER,
    p_comment_count INTEGER,
    p_created_at TIMESTAMPTZ,
    p_gravity NUMERIC DEFAULT 1.8
)
RETURNS NUMERIC AS $$
DECLARE
    v_age_hours NUMERIC;
    v_score NUMERIC;
BEGIN
    -- Calculate event age in hours
    v_age_hours := GREATEST(0.0, EXTRACT(EPOCH FROM (NOW() - p_created_at)) / 3600.0);

    -- Score = (RSVPs + Comments * 1.5) / (Age_in_Hours + 2)^Gravity
    v_score := (p_rsvp_count + (p_comment_count * 1.5)) / POWER(v_age_hours + 2.0, p_gravity);

    RETURN ROUND(v_score, 4);
END;
$$ LANGUAGE plpgsql STABLE;