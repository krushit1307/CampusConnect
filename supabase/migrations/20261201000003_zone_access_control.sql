-- =============================================================================
-- Migration: Dynamic "VIP/Sponsor" Access Control
-- Issue: #4047 - Develop a 'Dynamic "VIP/Sponsor" Access Control'
-- Description: Adds ticket tiers and zone definitions to enforce granular 
-- access control at different entry points (e.g., Main Gate vs Backstage).
-- =============================================================================

-- 1. Define Ticket Tier Enum
CREATE TYPE ticket_tier AS ENUM ('general', 'vip', 'sponsor', 'staff');

-- 2. Update tickets table
ALTER TABLE public.tickets
ADD COLUMN IF NOT EXISTS tier ticket_tier NOT NULL DEFAULT 'general';

-- 3. Define Access Zones
CREATE TABLE IF NOT EXISTS public.access_zones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- e.g., "Main Gate", "Backstage Lounge"
  min_required_tier ticket_tier NOT NULL DEFAULT 'general',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_access_zones_event ON public.access_zones(event_id);

COMMENT ON COLUMN public.access_zones.min_required_tier IS 
  'The minimum ticket tier required to scan into this zone.';

-- =============================================================================
-- Row Level Security (RLS)
-- =============================================================================
ALTER TABLE public.access_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organizers manage access zones"
ON public.access_zones FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.events e
    JOIN public.club_members cm ON e.club_id = cm.club_id
    WHERE e.id = access_zones.event_id
      AND cm.user_id = auth.uid() AND cm.role IN ('admin', 'president')
  )
);

CREATE POLICY "Scanners can read access zones"
ON public.access_zones FOR SELECT USING (true);
