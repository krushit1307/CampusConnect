-- Migration: Add pagination composite index on events for event_date range queries
-- Issue #20: Implement infinite scroll or pagination for events

-- Index on events table for event_date ascending order pagination
CREATE INDEX IF NOT EXISTS idx_events_pagination_date_id 
ON events (event_date ASC, id ASC);

-- Index on events table for event_date descending order pagination
CREATE INDEX IF NOT EXISTS idx_events_pagination_date_desc_id 
ON events (event_date DESC, id ASC);

-- Comment for schema documentation
COMMENT ON INDEX idx_events_pagination_date_id IS 'Optimizes range pagination queries on events by date ascending (Issue #20)';
COMMENT ON INDEX idx_events_pagination_date_desc_id IS 'Optimizes range pagination queries on events by date descending (Issue #20)';
