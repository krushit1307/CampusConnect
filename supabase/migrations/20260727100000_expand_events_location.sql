-- Zero-Downtime Schema Migration Framework (#1055)
-- Phase 1: Expand Phase
-- Creates new normalized event_venues table and dual-write triggers without locking tables.

SET lock_timeout = '3s';

-- 1. Create new target table for normalized venue data
CREATE TABLE IF NOT EXISTS public.event_venues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
    venue_name TEXT NOT NULL,
    address TEXT,
    city TEXT DEFAULT 'Main Campus',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.event_venues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Event venues are viewable by everyone" 
    ON public.event_venues FOR SELECT USING (true);

-- 2. Add nullable venue_id reference on events table for parallel usage
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS venue_id UUID REFERENCES public.event_venues(id) ON DELETE SET NULL;

-- 3. Create Dual-Write Trigger Function
CREATE OR REPLACE FUNCTION public.trg_sync_event_location_expand()
RETURNS TRIGGER AS $$
BEGIN
    -- Replicate location changes to event_venues in real-time
    IF NEW.location IS NOT NULL AND NEW.location <> '' THEN
        INSERT INTO public.event_venues (event_id, venue_name, address)
        VALUES (NEW.id, NEW.location, NEW.location)
        ON CONFLICT (id) DO UPDATE 
        SET venue_name = EXCLUDED.venue_name, updated_at = now();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger
DROP TRIGGER IF EXISTS sync_event_location_expand_trg ON public.events;
CREATE TRIGGER sync_event_location_expand_trg
AFTER INSERT OR UPDATE OF location ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.trg_sync_event_location_expand();
