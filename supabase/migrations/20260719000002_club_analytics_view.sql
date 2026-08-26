-- Create the club analytics view
CREATE OR REPLACE VIEW club_analytics AS
SELECT 
    c.id AS club_id,
    c.name AS club_name,
    c.slug AS club_slug,
    COALESCE(m.member_count, 0)::integer AS active_members_count,
    COALESCE(e.event_count, 0)::integer AS event_count,
    COALESCE(e.avg_rsvps, 0.0)::numeric(10,2) AS average_rsvps
FROM clubs c
LEFT JOIN (
    -- Count of approved members per club
    SELECT club_id, COUNT(*) AS member_count
    FROM club_members
    WHERE status = 'approved'
    GROUP BY club_id
) m ON m.club_id = c.id
LEFT JOIN (
    -- Event count and average RSVPs per event in each club
    SELECT 
        e.club_id,
        COUNT(DISTINCT e.id) AS event_count,
        AVG(COALESCE(r.rsvp_count, 0)) AS avg_rsvps
    FROM events e
    LEFT JOIN (
        -- Count RSVPs per event
        SELECT event_id, COUNT(*) AS rsvp_count
        FROM event_rsvps
        GROUP BY event_id
    ) r ON r.event_id = e.id
    GROUP BY e.club_id
) e ON e.club_id = c.id;

-- Revoke all permissions from PUBLIC and anon to restrict access
REVOKE ALL ON club_analytics FROM PUBLIC;
REVOKE ALL ON club_analytics FROM anon;

-- Grant select access only to authorized database roles
GRANT SELECT ON club_analytics TO service_role, authenticated;
