CREATE OR REPLACE FUNCTION get_events_by_subscriptions(p_user_id UUID)
RETURNS SETOF events AS $$
BEGIN
    RETURN QUERY
    SELECT e.*
    FROM events e
    JOIN clubs c ON e.club_id = c.id
    JOIN club_members cm ON c.id = cm.club_id
    WHERE cm.user_id = p_user_id
      AND cm.status = 'approved'
      AND e.deleted_at IS NULL
      AND c.deleted_at IS NULL
      AND e.event_date >= NOW() -- Only show upcoming events
    ORDER BY e.event_date ASC;
END;
$$ LANGUAGE plpgsql;
