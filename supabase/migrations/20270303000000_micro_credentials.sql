-- Migration: 20270303000000_micro_credentials.sql
-- Description: Add fields and scheduling for University Registrar micro-credential syncing.

-- 1. Add credit eligibility to event_series
ALTER TABLE public.event_series ADD COLUMN IF NOT EXISTS is_credit_eligible BOOLEAN DEFAULT false NOT NULL;

-- 2. Add registrar sync timestamp to issued_certificates
ALTER TABLE public.issued_certificates ADD COLUMN IF NOT EXISTS registrar_exported_at TIMESTAMPTZ DEFAULT NULL;

-- 3. Stored procedure to aggregate completions and trigger edge function
CREATE OR REPLACE FUNCTION public.aggregate_micro_credentials()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_resp net.http_response_id;
  v_edge_url TEXT;
  v_service_key TEXT;
BEGIN
  -- Retrieve system configurations or fall back to localhost defaults
  SELECT COALESCE(
    (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'edge_function_url' LIMIT 1),
    current_setting('app.settings.edge_function_url', true),
    'http://localhost:54321/functions/v1'
  ) INTO v_edge_url;

  SELECT COALESCE(
    (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1),
    current_setting('app.settings.service_role_key', true),
    ''
  ) INTO v_service_key;

  -- Make asynchronous request via pg_net
  SELECT net.http_post(
    url := v_edge_url || '/export-micro-credentials',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_key
    ),
    body := '{}'::jsonb
  ) INTO v_resp;
END;
$$;

-- Grant permissions to authenticate roles and service_role
GRANT EXECUTE ON FUNCTION public.aggregate_micro_credentials() TO service_role, authenticated;

-- 4. Schedule cron jobs for end of semester aggregates (Dec 15th & May 15th at midnight)
-- Clean existing jobs to ensure clean migration runs
DELETE FROM cron.job WHERE jobname IN ('aggregate-micro-credentials-dec', 'aggregate-micro-credentials-may');

SELECT cron.schedule('aggregate-micro-credentials-dec', '0 0 15 12 *', 'SELECT public.aggregate_micro_credentials();');
SELECT cron.schedule('aggregate-micro-credentials-may', '0 0 15 5 *', 'SELECT public.aggregate_micro_credentials();');
