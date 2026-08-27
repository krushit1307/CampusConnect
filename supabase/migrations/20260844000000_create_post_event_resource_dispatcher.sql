-- 1. Ensure event_resources table has dispatch tracking status
ALTER TABLE event_resources
ADD COLUMN IF NOT EXISTS is_dispatched BOOLEAN DEFAULT FALSE NOT NULL,
ADD COLUMN IF NOT EXISTS dispatched_at TIMESTAMPTZ;

-- 2. Create function to fetch events that concluded ~1 hour ago needing resource dispatch
CREATE OR REPLACE FUNCTION get_events_pending_resource_dispatch(
    p_now TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
    event_id UUID,
    event_title TEXT,
    end_time TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT e.id, e.title, e.end_time
    FROM events e
    WHERE e.end_time <= (p_now - INTERVAL '1 hour')
      AND EXISTS (
          SELECT 1 FROM event_resources er
          WHERE er.event_id = e.id AND er.is_dispatched = FALSE
      )
    GROUP BY e.id, e.title, e.end_time;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;