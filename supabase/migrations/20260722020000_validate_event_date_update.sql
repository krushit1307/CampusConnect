-- Migration: 20260722020000_validate_event_date_update.sql
-- Description: Extends the existing event_date validation trigger to enforce future dates on both INSERT and UPDATE operations.

-- 1. Redefine the trigger to fire on INSERT OR UPDATE
DROP TRIGGER IF EXISTS trg_validate_event_date ON public.events;

CREATE TRIGGER trg_validate_event_date
BEFORE INSERT OR UPDATE ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.validate_event_date();
