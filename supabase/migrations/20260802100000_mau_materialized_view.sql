-- Migration: Create mau_materialized_view for rolling 30-day MAU metrics and last_active_at tracking

-- Ensure session_logs table exists
CREATE TABLE IF NOT EXISTS session_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_logs_created_at_user_id ON session_logs (created_at, user_id);

-- Create Materialized View for rolling 30-day MAU metrics
CREATE MATERIALIZED VIEW IF NOT EXISTS mau_materialized_view AS
SELECT
    date_trunc('day', created_at)::date AS date,
    COUNT(DISTINCT user_id)::int AS mau
FROM session_logs
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY 1;

-- Unique index to support REFRESH MATERIALIZED VIEW CONCURRENTLY
CREATE UNIQUE INDEX IF NOT EXISTS idx_mau_materialized_view_date ON mau_materialized_view (date);

-- Function to refresh the materialized view
CREATE OR REPLACE FUNCTION refresh_mau_materialized_view()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mau_materialized_view;
END;
$$;

-- Schedule pg_cron job to refresh materialized view every midnight if pg_cron is available
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        PERFORM cron.schedule(
            'refresh-mau-materialized-view',
            '0 0 * * *',
            'SELECT refresh_mau_materialized_view();'
        );
    END IF;
END $$;

-- RPC to update user last_active_at column during routine requests (debounced max once per hour)
CREATE OR REPLACE FUNCTION touch_user_last_active(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE profiles
    SET last_active_at = NOW()
    WHERE id = p_user_id
      AND (last_active_at IS NULL OR last_active_at < NOW() - INTERVAL '1 hour');

    -- Insert activity log entry
    INSERT INTO session_logs (user_id, created_at)
    VALUES (p_user_id, NOW());
END;
$$;
