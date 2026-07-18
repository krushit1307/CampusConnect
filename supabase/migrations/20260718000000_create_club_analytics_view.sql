-- Create the club analytics view for events and attendee counts
CREATE OR REPLACE VIEW club_analytics_view AS
SELECT 
    e.id,
    e.club_id,
    e.title,
    e.description,
    e.banner_url,
    e.event_date,
    e.start_date,
    e.end_date,
    e.location,
    e.created_by,
    e.created_at,
    e.updated_at,
    COALESCE(COUNT(r.id), 0)::integer AS attendee_count
FROM events e
LEFT JOIN event_rsvps r ON e.id = r.event_id
GROUP BY e.id;

-- Grant select access to authenticated and anonymous roles
GRANT SELECT ON club_analytics_view TO authenticated, anon;
