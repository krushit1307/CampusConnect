-- Create the sponsorship zones table with PostGIS geometry
CREATE TABLE public.sponsorship_zones (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID NOT NULL, -- Assuming this links to your main events table
    sponsor_name TEXT NOT NULL,
    notification_message TEXT NOT NULL, -- e.g., "Stop by for a free energy drink!"
    
    -- PostGIS geometry type for storing the polygon using standard GPS coordinates (SRID 4326)
    zone_polygon geometry(Polygon, 4326) NOT NULL,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.sponsorship_zones ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read the zones (so the mobile app can fetch them)
CREATE POLICY "Zones are viewable by everyone" 
ON public.sponsorship_zones FOR SELECT USING (true);

-- Create a spatial index to make the intersection math lightning fast
CREATE INDEX sponsorship_zones_polygon_idx ON public.sponsorship_zones USING GIST (zone_polygon);
