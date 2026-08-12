-- Create a view to aggregate total weekly RSVPs for Platform Health
-- Includes the last 6 months, using generate_series to ensure zero-RSVP weeks are included.

CREATE OR REPLACE VIEW platform_weekly_rsvps AS
WITH calendar AS (
    -- Generate a continuous series of weeks for the last 6 months
    SELECT generate_series(
        date_trunc('week', NOW() - INTERVAL '6 months'),
        date_trunc('week', NOW()),
        '1 week'::interval
    ) AS week_start
),
rsvps AS (
    -- Aggregate RSVPs grouped by week over the same period
    SELECT
        date_trunc('week', rsvp_at) AS week_start,
        COUNT(id) AS total_rsvps
    FROM event_rsvps
    WHERE rsvp_at >= date_trunc('week', NOW() - INTERVAL '6 months')
    GROUP BY date_trunc('week', rsvp_at)
)
SELECT
    c.week_start,
    COALESCE(r.total_rsvps, 0) AS total_rsvps
FROM calendar c
LEFT JOIN rsvps r ON c.week_start = r.week_start
ORDER BY c.week_start ASC;
