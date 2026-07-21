-- Remove stale pending membership requests older than 30 days
CREATE OR REPLACE FUNCTION cleanup_stale_membership_requests()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    DELETE FROM club_members
    WHERE status = 'pending'
      AND joined_at < NOW() - INTERVAL '30 days';
END;
$$;

-- Schedule daily cleanup at midnight
-- Note: Requires pg_cron extension to be enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
    'cleanup-stale-membership-requests',
    '0 0 * * *',
    $$SELECT cleanup_stale_membership_requests();$$
);
