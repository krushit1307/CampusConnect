-- ============================================================
-- Migration: 20260730000000_content_reports_rate_limit.sql
-- Description: Limit content reports to 5 per user per hour
-- ============================================================

-- Function that enforces report rate limiting
CREATE OR REPLACE FUNCTION public.check_content_report_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    report_count INTEGER;
BEGIN
    SELECT COUNT(*)
      INTO report_count
      FROM public.content_reports
     WHERE reporter_id = NEW.reporter_id
       AND created_at >= NOW() - INTERVAL '1 hour';

    IF report_count >= 5 THEN
        RAISE EXCEPTION
            'You have submitted too many reports recently. Please try again later.'
            USING ERRCODE = 'P0001';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_content_report_rate_limit
ON public.content_reports;

CREATE TRIGGER trg_content_report_rate_limit
BEFORE INSERT
ON public.content_reports
FOR EACH ROW
EXECUTE FUNCTION public.check_content_report_rate_limit();