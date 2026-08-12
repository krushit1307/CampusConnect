-- Migration: Prevent venue double-booking using a BEFORE INSERT OR UPDATE trigger on events

-- 1. Add venue_id column to public.events table if it does not already exist
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS venue_id UUID;

-- 2. Create index on venue_id to speed up constraint checks and queries
CREATE INDEX IF NOT EXISTS idx_events_venue_id ON public.events(venue_id) WHERE venue_id IS NOT NULL;

-- 3. Create function to check for overlapping venue times
CREATE OR REPLACE FUNCTION public.prevent_venue_double_booking()
RETURNS TRIGGER AS $$
BEGIN
    -- Only validate if venue_id, start_date and end_date are set
    IF NEW.venue_id IS NOT NULL AND NEW.start_date IS NOT NULL AND NEW.end_date IS NOT NULL THEN
        IF EXISTS (
            SELECT 1 FROM public.events
            WHERE venue_id = NEW.venue_id
              AND start_date < NEW.end_date
              AND end_date > NEW.start_date
              AND (id <> NEW.id OR NEW.id IS NULL)
        ) THEN
            RAISE EXCEPTION 'A double-booking has been detected for venue_id: % at this time.', NEW.venue_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. Drop trigger if it already exists
DROP TRIGGER IF EXISTS trg_prevent_venue_double_booking ON public.events;

-- 5. Bind the BEFORE INSERT OR UPDATE trigger
CREATE TRIGGER trg_prevent_venue_double_booking
BEFORE INSERT OR UPDATE ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.prevent_venue_double_booking();
