-- 1. Create B-Tree index on start_date for date range filtering
CREATE INDEX IF NOT EXISTS idx_events_start_date ON events(start_date);

-- 2. Create B-Tree index on category_id
CREATE INDEX IF NOT EXISTS idx_events_category ON events(category_id);

-- 3. Composite index for common feed query combinations
CREATE INDEX IF NOT EXISTS idx_events_feed_faceted ON events(category_id, start_date);