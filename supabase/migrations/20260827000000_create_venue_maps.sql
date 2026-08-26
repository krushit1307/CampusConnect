-- Migration: Create venue_maps and map_nodes tables with RLS and triggers
-- Target: public.venue_maps and public.map_nodes

CREATE TABLE IF NOT EXISTS public.venue_maps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE UNIQUE,
    background_image_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.map_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    map_id UUID NOT NULL REFERENCES public.venue_maps(id) ON DELETE CASCADE,
    entity_name TEXT,
    type TEXT NOT NULL CHECK (type IN ('table', 'stage', 'boundary', 'booth')),
    x_coord NUMERIC NOT NULL CHECK (x_coord >= 0 AND x_coord <= 100),
    y_coord NUMERIC NOT NULL CHECK (y_coord >= 0 AND y_coord <= 100),
    width NUMERIC NOT NULL CHECK (width > 0 AND width <= 100),
    height NUMERIC NOT NULL CHECK (height > 0 AND height <= 100),
    rotation INTEGER NOT NULL DEFAULT 0 CHECK (rotation IN (0, 90, 180, 270)),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.venue_maps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.map_nodes ENABLE ROW LEVEL SECURITY;

-- 1. SELECT Policies (Viewable by anyone who can view the event)
CREATE POLICY "Venue maps are viewable by anyone who can view the event." ON public.venue_maps
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.events
    WHERE events.id = venue_maps.event_id
  )
);

CREATE POLICY "Map nodes are viewable by anyone who can view the event." ON public.map_nodes
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.venue_maps
    JOIN public.events ON events.id = venue_maps.event_id
    WHERE venue_maps.id = map_nodes.map_id
  )
);

-- 2. INSERT Policies (Club admins of the hosting club)
CREATE POLICY "Club admins can insert venue maps." ON public.venue_maps
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.events
    WHERE events.id = venue_maps.event_id
      AND (
        public.is_club_admin(events.club_id, auth.uid()) OR
        EXISTS (SELECT 1 FROM public.clubs WHERE id = events.club_id AND created_by = auth.uid())
      )
  )
);

CREATE POLICY "Club admins can insert map nodes." ON public.map_nodes
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.venue_maps
    JOIN public.events ON events.id = venue_maps.event_id
    WHERE venue_maps.id = map_nodes.map_id
      AND (
        public.is_club_admin(events.club_id, auth.uid()) OR
        EXISTS (SELECT 1 FROM public.clubs WHERE id = events.club_id AND created_by = auth.uid())
      )
  )
);

-- 3. UPDATE Policies (Club admins of the hosting club)
CREATE POLICY "Club admins can update venue maps." ON public.venue_maps
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.events
    WHERE events.id = venue_maps.event_id
      AND (
        public.is_club_admin(events.club_id, auth.uid()) OR
        EXISTS (SELECT 1 FROM public.clubs WHERE id = events.club_id AND created_by = auth.uid())
      )
  )
);

CREATE POLICY "Club admins can update map nodes." ON public.map_nodes
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.venue_maps
    JOIN public.events ON events.id = venue_maps.event_id
    WHERE venue_maps.id = map_nodes.map_id
      AND (
        public.is_club_admin(events.club_id, auth.uid()) OR
        EXISTS (SELECT 1 FROM public.clubs WHERE id = events.club_id AND created_by = auth.uid())
      )
  )
);

-- 4. DELETE Policies (Club admins of the hosting club)
CREATE POLICY "Club admins can delete venue maps." ON public.venue_maps
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.events
    WHERE events.id = venue_maps.event_id
      AND (
        public.is_club_admin(events.club_id, auth.uid()) OR
        EXISTS (SELECT 1 FROM public.clubs WHERE id = events.club_id AND created_by = auth.uid())
      )
  )
);

CREATE POLICY "Club admins can delete map nodes." ON public.map_nodes
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.venue_maps
    JOIN public.events ON events.id = venue_maps.event_id
    WHERE venue_maps.id = map_nodes.map_id
      AND (
        public.is_club_admin(events.club_id, auth.uid()) OR
        EXISTS (SELECT 1 FROM public.clubs WHERE id = events.club_id AND created_by = auth.uid())
      )
  )
);

-- Triggers for updated_at
CREATE TRIGGER set_updated_at_venue_maps
BEFORE UPDATE ON public.venue_maps
FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

CREATE TRIGGER set_updated_at_map_nodes
BEFORE UPDATE ON public.map_nodes
FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();
