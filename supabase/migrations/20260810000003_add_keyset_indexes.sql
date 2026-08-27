-- =============================================================================
-- Migration: Add Compound Indexes for Keyset (Cursor) Pagination
-- Issue: #2734 - Implement Data Pagination using Keyset Pagination (Cursor-based)
-- Description: Creates highly optimized compound indexes on the events table 
-- to support instantaneous cursor-based pagination. Uses (created_at, id) 
-- to guarantee deterministic ordering even when timestamps collide.
-- =============================================================================

-- 1. Index for the main feed (Newest first)
-- Supports: ORDER BY created_at DESC, id DESC LIMIT 20
-- WHERE created_at < last_seen_date OR (created_at = last_seen_date AND id < last_seen_id)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_feed_cursor_desc 
ON public.events (created_at DESC, id DESC);

-- 2. Index for chronological views (Oldest first)
-- Supports: ORDER BY created_at ASC, id ASC LIMIT 20
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_feed_cursor_asc 
ON public.events (created_at ASC, id ASC);

-- 3. Index for filtering by club_id + cursor
-- Essential for club-specific feeds
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_club_cursor 
ON public.events (club_id, created_at DESC, id DESC);

-- 4. Index for filtering by status + cursor
-- Essential for admin dashboards showing only active events
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_status_cursor 
ON public.events (status, created_at DESC, id DESC);

-- =============================================================================
-- Cleanup: Drop old offset-based indexes if they exist
-- =============================================================================
-- DROP INDEX IF EXISTS idx_events_created_at; -- Example cleanup
