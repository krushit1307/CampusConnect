-- Migration: 20260726000000_orphaned_users_view.sql
-- Description: Create a view identifying 'Orphaned Users' for re-engagement (issue #1299)

CREATE OR REPLACE VIEW orphaned_users AS
SELECT
    p.id,
    u.email::TEXT,
    (p.first_name || ' ' || p.last_name) AS name,
    p.created_at
FROM profiles p
JOIN auth.users u ON p.id = u.id
LEFT JOIN club_members cm ON cm.user_id = p.id
LEFT JOIN event_rsvps er ON er.user_id = p.id
WHERE cm.user_id IS NULL
  AND er.user_id IS NULL
  AND p.created_at < NOW() - INTERVAL '6 months';
