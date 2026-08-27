-- Migration: 20270831000000_issue_3887_inventory_checkout_reminders.sql
-- Issue: #3887 - Automated Inventory Checkout Reminders
-- Description: Adds notification-tracking columns to asset_loans, a
--   SECURITY DEFINER RPC that finds loans due for a reminder or an
--   overdue escalation, and a daily pg_cron job that invokes the
--   'audit-inventory-returns' edge function.

-- 1. Track notification state per loan so the cron job never double-sends
ALTER TABLE public.asset_loans
  ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS overdue_notified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS overdue_notification_count INT NOT NULL DEFAULT 0;

-- 2. RPC used by the cron-triggered edge function to fetch due work and
--    atomically mark it as handled (SKIP LOCKED avoids duplicate sends if
--    a run overlaps a slow previous invocation).
CREATE OR REPLACE FUNCTION public.audit_inventory_returns()
RETURNS TABLE (
  loan_id UUID,
  item_id UUID,
  item_name TEXT,
  borrower_id UUID,
  borrower_email TEXT,
  borrower_phone TEXT,
  borrower_first_name TEXT,
  due_date TIMESTAMPTZ,
  notice_type TEXT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_reminder_ids UUID[];
  v_overdue_ids UUID[];
BEGIN
  -- Loans due within the next 24 hours that have not been reminded yet
  SELECT ARRAY(
    SELECT l.id FROM public.asset_loans l
    WHERE l.status = 'active'
      AND l.reminder_sent_at IS NULL
      AND l.due_date <= NOW() + INTERVAL '24 hours'
      AND l.due_date > NOW()
    FOR UPDATE SKIP LOCKED
  ) INTO v_reminder_ids;

  IF array_length(v_reminder_ids, 1) > 0 THEN
    UPDATE public.asset_loans SET reminder_sent_at = NOW()
    WHERE id = ANY(v_reminder_ids);
  END IF;

  -- Active loans past due; re-escalate at most once every 24 hours
  SELECT ARRAY(
    SELECT l.id FROM public.asset_loans l
    WHERE l.status = 'active'
      AND l.due_date < NOW()
      AND (l.overdue_notified_at IS NULL OR l.overdue_notified_at < NOW() - INTERVAL '24 hours')
    FOR UPDATE SKIP LOCKED
  ) INTO v_overdue_ids;

  IF array_length(v_overdue_ids, 1) > 0 THEN
    UPDATE public.asset_loans
    SET overdue_notified_at = NOW(),
        overdue_notification_count = overdue_notification_count + 1
    WHERE id = ANY(v_overdue_ids);
  END IF;

  RETURN QUERY
  SELECT
    l.id, i.id, i.name, l.borrower_id,
    u.email::TEXT, p.phone_number::TEXT, p.first_name::TEXT,
    l.due_date,
    CASE WHEN l.id = ANY(v_reminder_ids) THEN 'reminder' ELSE 'overdue' END
  FROM public.asset_loans l
  JOIN public.inventory_items i ON i.id = l.item_id
  JOIN auth.users u ON u.id = l.borrower_id
  JOIN public.profiles p ON p.id = l.borrower_id
  WHERE l.id = ANY(v_reminder_ids) OR l.id = ANY(v_overdue_ids);
END;
$$;

REVOKE ALL ON FUNCTION public.audit_inventory_returns() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.audit_inventory_returns() FROM anon;
REVOKE ALL ON FUNCTION public.audit_inventory_returns() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.audit_inventory_returns() TO service_role;

-- 3. Schedule the daily cron job (07:00 UTC) that invokes the edge function
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'audit-inventory-returns') THEN
    PERFORM cron.unschedule('audit-inventory-returns');
  END IF;
END
$$;

SELECT cron.schedule(
  'audit-inventory-returns',
  '0 7 * * *',
  $$
  SELECT net.http_post(
    url := 'http://localhost:54321/functions/v1/audit-inventory-returns',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);