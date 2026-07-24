-- Migration: Add Database Index on Event Start Dates
-- Issue #171: Optimize upcoming event queries filtered by start_date

-- 1. Create B-Tree index on start_date for filtering and sorting upcoming events
CREATE INDEX IF NOT EXISTS idx_events_start_time ON public.events(start_date ASC);

-- 2. Create composite partial index for active upcoming events query pattern
-- Optimizes queries: SELECT ... FROM events WHERE start_date >= NOW() ORDER BY start_date ASC
CREATE INDEX IF NOT EXISTS idx_events_upcoming_active 
ON public.events(start_date ASC) 
WHERE start_date IS NOT NULL;

-- 3. Document index purpose
COMMENT ON INDEX public.idx_events_start_time IS 'B-Tree index on start_date to optimize upcoming event filtering and timeline sorting (#171)';
