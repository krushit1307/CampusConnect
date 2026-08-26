-- =============================================================================
-- Migration: Cross-Club Leaderboard & Gamification Scoring
-- Issue: #2971 - Develop a 'Cross-Club Leaderboard' (Gamification)
-- Description: Creates a materialized view that calculates club scores based 
-- on event activity, normalized engagement (percentage of members attending), 
-- and quality (feedback scores). Includes logic to prevent gaming via minimum 
-- attendee thresholds.
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- 1. Materialized View for Leaderboard Scores
-- Recalculated nightly via pg_cron or an Edge Function
CREATE MATERIALIZED VIEW IF NOT EXISTS public.club_leaderboard_scores AS WITH club_metrics AS (
    SELECT c.id AS club_id,
        c.name AS club_name,
        c.logo_url,
        c.slug,
        -- Total Members (for normalization)
        COALESCE(
            (
                SELECT COUNT(*)
                FROM public.club_members cm
                WHERE cm.club_id = c.id
                    AND cm.status = 'approved'
            ),
            1
        ) AS total_members,
        -- Events Hosted (Must have > 5 attendees to count towards score to prevent gaming)
        COALESCE(
            (
                SELECT COUNT(DISTINCT e.id)
                FROM public.events e
                    JOIN public.event_rsvps er ON e.id = er.event_id
                WHERE e.club_id = c.id
                    AND e.status = 'COMPLETED'
                    AND e.event_date >= NOW() - INTERVAL '6 months' -- Semester window
                GROUP BY e.id
                HAVING COUNT(er.id) >= 5
            ),
            0
        ) AS valid_events_hosted,
        -- Unique Attendees (Normalized later)
        COALESCE(
            (
                SELECT COUNT(DISTINCT er.user_id)
                FROM public.events e
                    JOIN public.event_rsvps er ON e.id = er.event_id
                WHERE e.club_id = c.id
                    AND e.status = 'COMPLETED'
                    AND er.checked_in = TRUE
                    AND e.event_date >= NOW() - INTERVAL '6 months'
            ),
            0
        ) AS unique_attendees,
        -- Average Feedback Score (Assuming a feedback_ratings table exists)
        COALESCE(
            (
                SELECT AVG(fr.score)
                FROM public.events e
                    JOIN public.feedback_ratings fr ON e.id = fr.event_id
                WHERE e.club_id = c.id
                    AND e.event_date >= NOW() - INTERVAL '6 months'
            ),
            0
        ) AS avg_feedback_score
    FROM public.clubs c
    WHERE c.status = 'ACTIVE'
)
SELECT club_id,
    club_name,
    logo_url,
    slug,
    valid_events_hosted,
    unique_attendees,
    total_members,
    avg_feedback_score,
    -- SCORING ALGORITHM:
    -- +10 points per valid event hosted
    -- +1 point per unique attendee (Normalized by dividing by total members to reward % engagement)
    -- +50 points if average feedback > 4.5
    (
        (valid_events_hosted * 10) + (
            (
                unique_attendees::NUMERIC / GREATEST(total_members, 1)
            ) * 100
        ) + -- Normalized engagement score (max 100 pts if 100% attendance)
        (
            CASE
                WHEN avg_feedback_score >= 4.5 THEN 50
                ELSE 0
            END
        )
    )::INT AS total_score
FROM club_metrics
ORDER BY total_score DESC;
-- Create unique index for concurrent refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_club_leaderboard_club_id ON public.club_leaderboard_scores(club_id);
-- 2. Table to store historical snapshots for "Trending" calculations
CREATE TABLE IF NOT EXISTS public.leaderboard_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    score INT NOT NULL,
    rank INT NOT NULL,
    snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
    UNIQUE(club_id, snapshot_date)
);
-- 3. Function to refresh the materialized view and record snapshots
CREATE OR REPLACE FUNCTION public.refresh_leaderboard() RETURNS VOID AS $$ BEGIN -- Refresh the materialized view concurrently to avoid locking reads
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.club_leaderboard_scores;
-- Insert today's snapshot for trending calculations
INSERT INTO public.leaderboard_snapshots (club_id, score, rank, snapshot_date)
SELECT club_id,
    total_score,
    ROW_NUMBER() OVER (
        ORDER BY total_score DESC
    )::INT,
    CURRENT_DATE
FROM public.club_leaderboard_scores ON CONFLICT (club_id, snapshot_date) DO
UPDATE
SET score = EXCLUDED.score,
    rank = EXCLUDED.rank;
END;
$$ LANGUAGE plpgsql;
