-- Alter report_target_type and report_status enums to support new targets and dismissed status.
-- Use COMMIT/BEGIN to run these commands outside of a transaction if the driver executes migrations inside transactions.
COMMIT;
ALTER TYPE public.report_target_type ADD VALUE IF NOT EXISTS 'club';
ALTER TYPE public.report_target_type ADD VALUE IF NOT EXISTS 'event';
ALTER TYPE public.report_status ADD VALUE IF NOT EXISTS 'dismissed';
BEGIN;

-- Update reports table schema
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS details TEXT;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS note TEXT;
