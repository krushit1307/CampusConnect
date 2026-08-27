-- Migration: 20261231000011_venue_acoustics_profiling.sql
-- Interactive Venue Sound/Acoustics Map (#3588)

-- 1. Create acoustic profile enum type if not exists
DO $$ BEGIN
    CREATE TYPE public.acoustic_profile_type AS ENUM ('echo_heavy', 'soundproof', 'moderate', 'loud_ambient');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Alter venues table to add acoustic_profile, ambient_db_avg, and noise_notes
ALTER TABLE public.venues
ADD COLUMN IF NOT EXISTS acoustic_profile public.acoustic_profile_type DEFAULT 'moderate',
ADD COLUMN IF NOT EXISTS ambient_db_avg NUMERIC(5,2) DEFAULT 45.00,
ADD COLUMN IF NOT EXISTS acoustic_notes TEXT;

-- 3. Create table for crowdsourced decibel measurements
CREATE TABLE IF NOT EXISTS public.venue_sound_measurements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    decibel_reading NUMERIC(5,2) NOT NULL CHECK (decibel_reading >= 0 AND decibel_reading <= 150),
    sample_duration_seconds INT NOT NULL DEFAULT 5,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_venue_sound_venue ON public.venue_sound_measurements(venue_id);

-- Enable RLS
ALTER TABLE public.venue_sound_measurements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view sound measurements"
    ON public.venue_sound_measurements
    FOR SELECT
    TO authenticated, anon
    USING (true);

CREATE POLICY "Authenticated users can submit sound measurements"
    ON public.venue_sound_measurements
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Trigger to recalculate average ambient DB on new measurement
CREATE OR REPLACE FUNCTION public.update_venue_ambient_db()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.venues
    SET ambient_db_avg = (
        SELECT ROUND(AVG(decibel_reading), 2)
        FROM public.venue_sound_measurements
        WHERE venue_id = NEW.venue_id
    )
    WHERE id = NEW.venue_id;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_venue_ambient_db ON public.venue_sound_measurements;
CREATE TRIGGER trg_update_venue_ambient_db
AFTER INSERT ON public.venue_sound_measurements
FOR EACH ROW
EXECUTE FUNCTION public.update_venue_ambient_db();
