-- 1. Create B-Tree index on start_time for date range filtering
CREATE INDEX IF NOT EXISTS idx_events_start_time ON events(start_time);

-- 2. Create B-Tree index on category
CREATE INDEX IF NOT EXISTS idx_events_category ON events(category);

-- 3. Create B-Tree index on boolean flags (e.g. has_free_food)
CREATE INDEX IF NOT EXISTS idx_events_has_free_food ON events(has_free_food);

-- 4. Composite index for common feed query combinations
CREATE INDEX IF NOT EXISTS idx_events_feed_faceted ON events(category, has_free_food, start_time);