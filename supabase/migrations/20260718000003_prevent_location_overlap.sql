-- ============================================================
-- Migration: 20260718000003_prevent_location_overlap.sql
-- Description:
-- Prevents double-bookings of physical locations at overlapping times.
-- ============================================================

CREATE OR REPLACE FUNCTION public.prevent_location_overlap()
RETURNS TRIGGER AS $$
BEGIN
    -- Only validate if all required fields are set and location is not empty/whitespace
    IF NEW.location IS NOT NULL AND TRIM(NEW.location) <> '' AND NEW.start_date IS NOT NULL AND NEW.end_date IS NOT NULL THEN
        IF EXISTS (
            SELECT 1 FROM public.events
            WHERE location = NEW.location
              AND start_date < NEW.end_date
              AND end_date > NEW.start_date
              AND (id <> NEW.id OR NEW.id IS NULL)
        ) THEN
            RAISE EXCEPTION 'An event is already scheduled at this location during the selected time range.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop the trigger if it already exists to ensure idempotency
DROP TRIGGER IF EXISTS trg_prevent_location_overlap ON public.events;

-- Bind the BEFORE INSERT OR UPDATE trigger
CREATE TRIGGER trg_prevent_location_overlap
BEFORE INSERT OR UPDATE ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.prevent_location_overlap();
