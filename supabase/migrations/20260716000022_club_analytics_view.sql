-- ============================================================
-- Migration: 20260716000022_club_analytics_view.sql
-- Description: Creates the club_analytics database view to
-- aggregate active members, event counts, and average RSVPs per
-- event per club for administrative dashboards, with read access
-- restricted to authorized roles.
-- ============================================================

CREATE OR REPLACE VIEW club_analytics AS
WITH event_rsvps_count AS (
  SELECT 
    e.club_id,
    e.id AS event_id,
    COUNT(r.id) AS rsvp_count
  FROM events e
  LEFT JOIN event_rsvps r ON e.id = r.event_id
  GROUP BY e.club_id, e.id
),
club_events_stats AS (
  SELECT 
    club_id,
    COUNT(event_id) AS total_events,
    COALESCE(AVG(rsvp_count), 0)::NUMERIC(10, 2) AS average_rsvps
  FROM event_rsvps_count
  GROUP BY club_id
),
club_members_stats AS (
  SELECT 
    club_id,
    COUNT(id) AS active_members
  FROM club_members
  WHERE status = 'approved'
  GROUP BY club_id
)
SELECT 
  c.id AS club_id,
  c.name AS club_name,
  COALESCE(cm.active_members, 0) AS active_members,
  COALESCE(ces.total_events, 0) AS total_events,
  COALESCE(ces.average_rsvps, 0) AS average_rsvps
FROM clubs c
LEFT JOIN club_members_stats cm ON c.id = cm.club_id
LEFT JOIN club_events_stats ces ON c.id = ces.club_id;

-- Enable Security Invoker mode so that underlying RLS policies apply if queried
ALTER VIEW club_analytics SET (security_invoker = true);

-- Restrict read access to authorized roles
REVOKE ALL ON club_analytics FROM PUBLIC;
REVOKE ALL ON club_analytics FROM anon;

-- Grant access to authenticated users and service roles
GRANT SELECT ON club_analytics TO authenticated;
GRANT SELECT ON club_analytics TO service_role;
