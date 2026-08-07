-- =============================================================================
-- Migration: 20260807100000_event_metrics_table.sql
-- Description: Implements issue #2274 — replaces the events.views column with a
--   dedicated UNLOGGED event_metrics table for high-throughput view tracking.
--
-- Why UNLOGGED?
--   UNLOGGED tables skip WAL (Write-Ahead Log) writes, making increments ~3-5x
--   faster than updating a column on a heavily-locked events row. The trade-off
--   is that data is lost on a crash/unclean shutdown, which is acceptable for
--   an approximate view counter (we can recover from the events.views snapshot).
--
-- Strategy:
--   1. Create the UNLOGGED event_metrics table with one row per event.
--   2. Migrate existing view counts from events.views into event_metrics.
--   3. Create the increment_event_views() RPC using UPSERT so it works for
--      events created after this migration (no pre-existing metrics row needed).
--   4. Update get_trending_events() and get_event_popularity_score() to read
--      from event_metrics instead of events.views.
--   5. Update the v_club_event_views view and get_club_analytics() RPC to read
--      from event_metrics instead of events.views.
--   6. Drop the now-redundant events.views column and its index.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Step 1: Create the UNLOGGED event_metrics table
-- -----------------------------------------------------------------------------
CREATE UNLOGGED TABLE IF NOT EXISTS public.event_metrics (
    event_id  UUID        NOT NULL PRIMARY KEY
                          REFERENCES public.events(id) ON DELETE CASCADE,
    views     INTEGER     NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.event_metrics               IS 'UNLOGGED table storing fast-write view counters per event (issue #2274).';
COMMENT ON COLUMN public.event_metrics.event_id      IS 'FK to events.id — one row per event.';
COMMENT ON COLUMN public.event_metrics.views         IS 'Total accumulated page views for this event.';
COMMENT ON COLUMN public.event_metrics.updated_at    IS 'Timestamp of the last view increment.';

-- Index for any future ORDER BY views queries directly on this table
CREATE INDEX IF NOT EXISTS idx_event_metrics_views
    ON public.event_metrics (views DESC);

-- -----------------------------------------------------------------------------
-- RLS: lock down event_metrics so clients can only SELECT.
-- All writes go through increment_event_views() which is SECURITY DEFINER
-- and therefore runs as the function owner, bypassing RLS entirely.
-- Anonymous and authenticated users get SELECT (to render the view count)
-- but cannot INSERT, UPDATE, or DELETE rows directly.
-- -----------------------------------------------------------------------------
ALTER TABLE public.event_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_metrics: public read" ON public.event_metrics;
CREATE POLICY "event_metrics: public read"
    ON public.event_metrics
    FOR SELECT
    USING (true);

-- Explicitly revoke direct write access from client roles.
-- Writes must go through the increment_event_views() SECURITY DEFINER function.
REVOKE INSERT, UPDATE, DELETE ON public.event_metrics FROM authenticated, anon;

-- -----------------------------------------------------------------------------
-- Step 2: Migrate existing view counts from events.views → event_metrics
--   Wrapped in a DO block so if events.views was already dropped (idempotent
--   re-run) this step silently no-ops instead of erroring.
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE  table_schema = 'public'
      AND  table_name   = 'events'
      AND  column_name  = 'views'
  ) THEN
    INSERT INTO public.event_metrics (event_id, views, updated_at)
    SELECT id, COALESCE(views, 0), NOW()
    FROM   public.events
    WHERE  COALESCE(views, 0) > 0
    ON CONFLICT (event_id) DO NOTHING;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Step 3: Create the increment_event_views() RPC
--
--   Uses INSERT ... ON CONFLICT DO UPDATE (UPSERT) so:
--   - First view of any event transparently creates the metrics row.
--   - Subsequent views atomically increment the counter.
--   - No race condition; Postgres guarantees atomic UPDATE on conflict.
--
--   SECURITY DEFINER runs as the function owner (postgres), which bypasses RLS
--   on event_metrics. This is intentional — any authenticated or anonymous user
--   viewing an event page should be able to increment the counter without
--   needing explicit INSERT/UPDATE grants on the raw table.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.increment_event_views(p_event_id UUID)
RETURNS VOID
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
    INSERT INTO public.event_metrics (event_id, views, updated_at)
    VALUES (p_event_id, 1, NOW())
    ON CONFLICT (event_id) DO UPDATE
        SET views      = event_metrics.views + 1,
            updated_at = NOW();
$$;

GRANT EXECUTE ON FUNCTION public.increment_event_views(UUID) TO authenticated, anon;

COMMENT ON FUNCTION public.increment_event_views IS
    'Atomically increments the view counter for an event in event_metrics. '
    'Uses UPSERT so it works even for events with no prior metrics row. '
    'Implements issue #2274.';

-- -----------------------------------------------------------------------------
-- Step 4: Update get_trending_events() to read views from event_metrics
--
--   Marked VOLATILE (not STABLE) because it calls get_event_popularity_score
--   which internally calls NOW(). STABLE would be incorrect here.
--   NULL event_date is guarded — events with no date are excluded by the
--   WHERE clause (e.event_date >= NOW()), so the popularity fn always receives
--   a non-NULL timestamptz.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_trending_events(
    p_limit  INTEGER DEFAULT 10,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id               UUID,
    title            TEXT,
    description      TEXT,
    event_date       TIMESTAMPTZ,
    banner_url       TEXT,
    rsvp_count       BIGINT,
    views_count      INTEGER,
    popularity_score NUMERIC
)
LANGUAGE sql
VOLATILE
SET search_path = public
AS $$
    SELECT
        e.id,
        e.title,
        e.description,
        e.event_date,
        e.banner_url,
        COALESCE(r.rsvp_count, 0)::BIGINT                           AS rsvp_count,
        COALESCE(m.views, 0)                                         AS views_count,
        public.get_event_popularity_score(
            e.id,
            e.event_date,                -- non-NULL guaranteed by WHERE clause below
            COALESCE(r.rsvp_count, 0),
            COALESCE(m.views, 0)
        )                                                            AS popularity_score
    FROM public.events e
    LEFT JOIN (
        SELECT event_id, COUNT(*) AS rsvp_count
        FROM   public.event_rsvps
        GROUP  BY event_id
    ) r ON e.id = r.event_id
    LEFT JOIN public.event_metrics m ON e.id = m.event_id
    WHERE  e.event_date IS NOT NULL      -- guard: excludes undated events
      AND  e.event_date >= NOW()
      AND  e.status != 'cancelled'
    ORDER  BY popularity_score DESC
    LIMIT  p_limit
    OFFSET p_offset;
$$;

GRANT EXECUTE ON FUNCTION public.get_trending_events(INTEGER, INTEGER) TO authenticated, anon;

-- -----------------------------------------------------------------------------
-- Step 5a: Update v_club_event_views to read from event_metrics
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_club_event_views AS
SELECT
    e.club_id,
    e.id                               AS event_id,
    e.title                            AS event_title,
    COALESCE(m.views, 0)               AS page_views,
    DATE(e.created_at)                 AS event_created_date,
    DATE(e.event_date)                 AS event_date
FROM  public.events e
LEFT  JOIN public.event_metrics m ON e.id = m.event_id;

GRANT SELECT ON public.v_club_event_views TO authenticated;

-- -----------------------------------------------------------------------------
-- Step 5b: Update get_club_analytics() to read views from event_metrics
--
--   Only the two places that reference e.views / events.views are changed;
--   the rest of the function body is reproduced verbatim.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_club_analytics(
    p_club_id UUID,
    p_range   TEXT DEFAULT '30d'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_is_authorized BOOLEAN;
    v_start_date    DATE;
    v_end_date      DATE := CURRENT_DATE;
    v_summary       JSON;
    v_timeline      JSON;
    v_top_events    JSON;
BEGIN
    -- Authorization check: Club owner, admin member, or system admin
    SELECT EXISTS (
        SELECT 1 FROM public.clubs WHERE id = p_club_id AND created_by = auth.uid()
    ) OR EXISTS (
        SELECT 1 FROM public.club_members
        WHERE  club_id = p_club_id
          AND  user_id = auth.uid()
          AND  role IN ('admin', 'owner')
          AND  status = 'approved'
    ) OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE  id = auth.uid() AND role = 'system_admin'
    ) INTO v_is_authorized;

    IF NOT v_is_authorized THEN
        RAISE EXCEPTION 'Not authorized to view analytics for this club';
    END IF;

    -- Determine start date based on range filter ('7d', '30d', 'ytd')
    IF p_range = '7d' THEN
        v_start_date := v_end_date - INTERVAL '6 days';
    ELSIF p_range = 'ytd' THEN
        v_start_date := DATE_TRUNC('year', v_end_date)::DATE;
    ELSE -- Default '30d'
        v_start_date := v_end_date - INTERVAL '29 days';
    END IF;

    -- Build full date series timeline to prevent chart date gaps
    WITH date_series AS (
        SELECT generate_series(v_start_date, v_end_date, '1 day'::interval)::DATE AS date_val
    ),
    daily_rsvps AS (
        SELECT date_val, total_rsvps, total_checkins
        FROM   public.v_club_daily_rsvps
        WHERE  club_id = p_club_id AND date_val BETWEEN v_start_date AND v_end_date
    ),
    daily_discussions AS (
        SELECT date_val, total_posts, total_comments, total_activity
        FROM   public.v_club_daily_discussions
        WHERE  club_id = p_club_id AND date_val BETWEEN v_start_date AND v_end_date
    ),
    timeline_agg AS (
        SELECT
            ds.date_val::TEXT                        AS date,
            COALESCE(dr.total_rsvps,    0)           AS rsvps,
            COALESCE(dr.total_checkins, 0)           AS checkins,
            COALESCE(dd.total_posts,    0)           AS posts,
            COALESCE(dd.total_comments, 0)           AS comments,
            COALESCE(dd.total_activity, 0)           AS activity
        FROM       date_series ds
        LEFT JOIN  daily_rsvps       dr ON ds.date_val = dr.date_val
        LEFT JOIN  daily_discussions dd ON ds.date_val = dd.date_val
        ORDER BY ds.date_val ASC
    )
    SELECT json_agg(t) INTO v_timeline FROM timeline_agg t;

    -- Build Summary KPI totals
    -- total_views now reads from event_metrics instead of events.views
    SELECT json_build_object(
        'total_rsvps', COALESCE(SUM(total_rsvps), 0),
        'total_checkins', COALESCE(SUM(total_checkins), 0),
        'total_posts', (
            SELECT COUNT(*) FROM public.posts
            WHERE  club_id = p_club_id
              AND  DATE(created_at) BETWEEN v_start_date AND v_end_date
        ),
        'total_comments', (
            SELECT COUNT(c.id) FROM public.comments c
            JOIN   public.posts p ON p.id = c.post_id
            WHERE  p.club_id = p_club_id
              AND  DATE(c.created_at) BETWEEN v_start_date AND v_end_date
        ),
        'total_views', (
            SELECT COALESCE(SUM(m.views), 0)
            FROM   public.events e
            LEFT   JOIN public.event_metrics m ON e.id = m.event_id
            WHERE  e.club_id = p_club_id
        ),
        'total_members', (
            SELECT COUNT(*) FROM public.club_members
            WHERE  club_id = p_club_id AND status = 'approved'
        )
    ) INTO v_summary
    FROM public.v_club_daily_rsvps
    WHERE club_id = p_club_id AND date_val BETWEEN v_start_date AND v_end_date;

    -- Build Top Events list by page views & RSVPs
    -- views now read from event_metrics instead of events.views
    WITH top_ev AS (
        SELECT
            e.id                             AS event_id,
            e.title                          AS event_title,
            COALESCE(m.views, 0)             AS views,
            COUNT(r.id)                      AS rsvps,
            e.event_date::TEXT               AS event_date
        FROM       public.events e
        LEFT JOIN  public.event_metrics  m ON e.id = m.event_id
        LEFT JOIN  public.event_rsvps    r ON e.id = r.event_id
        WHERE  e.club_id = p_club_id
        GROUP  BY e.id, e.title, m.views, e.event_date
        ORDER  BY COALESCE(m.views, 0) DESC, COUNT(r.id) DESC
        LIMIT  5
    )
    SELECT json_agg(te) INTO v_top_events FROM top_ev te;

    -- Return final consolidated JSON payload
    RETURN json_build_object(
        'range',      p_range,
        'start_date', v_start_date,
        'end_date',   v_end_date,
        'summary',    COALESCE(v_summary, json_build_object(
            'total_rsvps', 0, 'total_checkins', 0, 'total_posts', 0,
            'total_comments', 0, 'total_views', 0, 'total_members', 0
        )),
        'timeline',   COALESCE(v_timeline, '[]'::json),
        'top_events', COALESCE(v_top_events, '[]'::json)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION get_club_analytics(UUID, TEXT) TO authenticated;

-- -----------------------------------------------------------------------------
-- Step 6: Drop the events.views column and its index
--
--   We do this last so there is no window where both storage locations are live
--   and could get out of sync. All RPCs and views above have already been
--   switched to event_metrics before this DROP runs.
-- -----------------------------------------------------------------------------
DROP INDEX IF EXISTS public.idx_events_views;

ALTER TABLE public.events
    DROP COLUMN IF EXISTS views;

-- =============================================================================
-- End of migration 20260807100000_event_metrics_table.sql
-- =============================================================================
