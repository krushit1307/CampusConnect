-- Enable PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create campus_zones table
CREATE TABLE IF NOT EXISTS public.campus_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    boundary GEOMETRY(Polygon, 4326) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Spatial index
CREATE INDEX IF NOT EXISTS campus_zones_boundary_idx ON public.campus_zones USING GIST (boundary);

-- Add zone_id to events
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS zone_id UUID REFERENCES public.campus_zones(id) ON DELETE SET NULL;

-- Seed 5 distinct campus zones
INSERT INTO public.campus_zones (id, name, description, boundary)
VALUES
    ('a0000000-0000-0000-0000-000000000001', 'North Campus Academic Zone', 'Area covering the main engineering labs and lecture halls.', ST_GeomFromText('POLYGON((10.0 10.0, 10.0 10.1, 10.1 10.1, 10.1 10.0, 10.0 10.0))', 4326))
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.campus_zones (id, name, description, boundary)
VALUES
    ('a0000000-0000-0000-0000-000000000002', 'South Campus Residential Complex', 'Area covering the residential dorms and student housing.', ST_GeomFromText('POLYGON((20.0 20.0, 20.0 20.1, 20.1 20.1, 20.1 20.0, 20.0 20.0))', 4326))
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.campus_zones (id, name, description, boundary)
VALUES
    ('a0000000-0000-0000-0000-000000000003', 'East Campus Athletic Fields', 'Area covering fields, courts, track, and gymnasium.', ST_GeomFromText('POLYGON((30.0 30.0, 30.0 30.1, 30.1 30.1, 30.1 30.0, 30.0 30.0))', 4326))
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.campus_zones (id, name, description, boundary)
VALUES
    ('a0000000-0000-0000-0000-000000000004', 'West Campus Innovation Hub', 'Area covering incubator spaces and design workshops.', ST_GeomFromText('POLYGON((40.0 40.0, 40.0 40.1, 40.1 40.1, 40.1 40.0, 40.0 40.0))', 4326))
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.campus_zones (id, name, description, boundary)
VALUES
    ('a0000000-0000-0000-0000-000000000005', 'Central Student Plaza', 'The central gathering area with dining hall and student center.', ST_GeomFromText('POLYGON((50.0 50.0, 50.0 50.1, 50.1 50.1, 50.1 50.0, 50.0 50.0))', 4326))
ON CONFLICT (name) DO NOTHING;

-- Create user_badges table
CREATE TABLE IF NOT EXISTS public.user_badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    badge_name TEXT NOT NULL,
    awarded_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, badge_name)
);

-- Enable RLS
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

-- Select policy
DROP POLICY IF EXISTS "User badges are viewable by everyone." ON public.user_badges;
CREATE POLICY "User badges are viewable by everyone."
ON public.user_badges FOR SELECT
USING (true);

-- Insert policy
DROP POLICY IF EXISTS "System admins or user can insert badges." ON public.user_badges;
CREATE POLICY "System admins or user can insert badges."
ON public.user_badges FOR INSERT
WITH CHECK (auth.uid() = user_id OR public.is_system_admin());

-- Trigger function for check-in badge evaluation
CREATE OR REPLACE FUNCTION public.check_checkin_badges()
RETURNS TRIGGER AS $$
DECLARE
    visited_zones_count INTEGER;
BEGIN
    -- Check if user checked-in changes to TRUE
    IF OLD.checked_in IS DISTINCT FROM TRUE AND NEW.checked_in = TRUE THEN
        -- Calculate distinct zones checked-in in the last 30 days
        SELECT COUNT(DISTINCT cz.id) INTO visited_zones_count
        FROM public.event_rsvps er
        JOIN public.events e ON e.id = er.event_id
        LEFT JOIN public.event_attendance_logs eal ON eal.rsvp_id = er.id
        JOIN public.campus_zones cz ON (
            e.zone_id = cz.id OR
            (e.latitude IS NOT NULL AND e.longitude IS NOT NULL AND ST_Contains(cz.boundary, ST_SetSRID(ST_Point(e.longitude, e.latitude), 4326)))
        )
        WHERE er.user_id = NEW.user_id
          AND er.checked_in = true
          AND COALESCE(eal.checked_in_at, NEW.updated_at, NOW()) >= NOW() - INTERVAL '30 days';

        -- If user has checked-in to 5 or more distinct zones, award badge
        IF visited_zones_count >= 5 THEN
            INSERT INTO public.user_badges (user_id, badge_name)
            VALUES (NEW.user_id, 'Campus Explorer')
            ON CONFLICT (user_id, badge_name) DO NOTHING;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger binding
DROP TRIGGER IF EXISTS trg_check_checkin_badges ON public.event_rsvps;
CREATE TRIGGER trg_check_checkin_badges
AFTER UPDATE OF checked_in ON public.event_rsvps
FOR EACH ROW
EXECUTE FUNCTION public.check_checkin_badges();
