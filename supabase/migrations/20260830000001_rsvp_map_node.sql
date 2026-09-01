-- Add assigned table/node to RSVPs for seat selection
ALTER TABLE public.event_rsvps
ADD COLUMN assigned_map_node_id UUID REFERENCES public.map_nodes(id) ON DELETE SET NULL;
